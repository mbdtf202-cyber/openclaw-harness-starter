import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { createDiscordLiveDriver } from "./providers/discord.js";
import { createMattermostLiveDriver } from "./providers/mattermost.js";
import { createSlackLiveDriver } from "./providers/slack.js";
import { createTelegramLiveDriver } from "./providers/telegram.js";
import { createLiveArtifactsDir, writeLiveArtifact, writeLiveSummary } from "./transcript.js";
import type { LiveChannel, LiveDriver, LiveRunSummary, LiveStepResult } from "./types.js";
import { runOpenClawCli } from "../openclaw-cli.js";
import { spawnOpenClawGateway, stopOpenClawGateway } from "../openclaw-gateway.js";
import { waitForTextInTranscripts } from "../transcripts.js";

function resolveLiveDriver(channel: LiveChannel): LiveDriver {
  switch (channel) {
    case "discord":
      return createDiscordLiveDriver();
    case "telegram":
      return createTelegramLiveDriver();
    case "slack":
      return createSlackLiveDriver();
    case "mattermost":
      return createMattermostLiveDriver();
  }
}

async function readLiveConfigOverride(): Promise<Record<string, unknown>> {
  const configJson = process.env.OPENCLAW_LIVE_CONFIG_JSON;
  const configFile = process.env.OPENCLAW_LIVE_CONFIG_FILE;
  if (configJson?.trim()) {
    return JSON.parse(configJson) as Record<string, unknown>;
  }
  if (configFile?.trim()) {
    return JSON.parse(await fs.readFile(configFile, "utf8")) as Record<string, unknown>;
  }
  throw new Error("Set OPENCLAW_LIVE_CONFIG_JSON or OPENCLAW_LIVE_CONFIG_FILE.");
}

export async function runLiveRoundtrip(channel: LiveChannel): Promise<LiveRunSummary> {
  const driver = resolveLiveDriver(channel);
  const artifactsDir = await createLiveArtifactsDir(channel);
  const configOverride = await readLiveConfigOverride();
  const outboundNonce = `harness-live-outbound-${channel}-${randomUUID()}`;
  const inboundNonce = `harness-live-inbound-${channel}-${randomUUID()}`;
  const steps: LiveStepResult[] = [];
  const cleanupMessageIds: string[] = [];
  let observationMode = "unknown";

  const gateway = await spawnOpenClawGateway({
    name: `${channel}-live`,
    configOverride,
    env: {
      OPENCLAW_HIDE_BANNER: "1",
      OPENCLAW_SUPPRESS_NOTES: "1",
    },
    mode: "full",
  });

  const sharedCliEnv = {
    HOME: gateway.homeDir,
    OPENCLAW_CONFIG_PATH: gateway.configPath,
    OPENCLAW_STATE_DIR: gateway.stateDir,
    OPENCLAW_HIDE_BANNER: "1",
    OPENCLAW_SUPPRESS_NOTES: "1",
  };

  async function runStep(
    name: LiveStepResult["name"],
    work: () => Promise<Record<string, unknown> | undefined>,
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const details = await work();
      steps.push({
        name,
        ok: true,
        durationMs: Date.now() - startedAt,
        details,
      });
    } catch (error) {
      steps.push({
        name,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  try {
    let sendJson: unknown;
    await runStep("send", async () => {
      const sendResult = await runOpenClawCli({
        args: [
          "message",
          "send",
          "--channel",
          channel,
          "--target",
          driver.target,
          "--message",
          outboundNonce,
          "--json",
        ],
        env: sharedCliEnv,
      });
      sendJson = sendResult.json;
      await writeLiveArtifact(artifactsDir, "send.stdout.log", sendResult.stdout);
      await writeLiveArtifact(artifactsDir, "send.stderr.log", sendResult.stderr);
      return {
        target: driver.target,
      };
    });

    await runStep("observe", async () => {
      const outbound = await driver.observeOutbound(outboundNonce, sendJson);
      observationMode = outbound.mode;
      if (outbound.messageId) {
        cleanupMessageIds.push(outbound.messageId);
      }
      return outbound;
    });

    await runStep("inject", async () => {
      const inbound = await driver.injectInbound(inboundNonce);
      if (inbound.messageId) {
        cleanupMessageIds.push(inbound.messageId);
      }
      return inbound;
    });

    let transcriptMatches: Awaited<ReturnType<typeof waitForTextInTranscripts>> = [];
    await runStep("readback", async () => {
      transcriptMatches = await waitForTextInTranscripts({
        stateDir: gateway.stateDir,
        needle: inboundNonce,
        timeoutMs: 60_000,
      });
      await writeLiveArtifact(
        artifactsDir,
        "readback.matches.json",
        `${JSON.stringify(transcriptMatches, null, 2)}\n`,
      );
      return { matches: transcriptMatches.length };
    });

    await runStep("cleanup", async () => {
      await driver.cleanup(cleanupMessageIds);
      return { cleaned: cleanupMessageIds.length };
    });

    const summary: LiveRunSummary = {
      channel,
      ok: true,
      observationMode,
      outboundNonce,
      inboundNonce,
      artifactsDir,
      transcriptMatches: transcriptMatches.map((match) => match.file),
      steps,
    };
    await writeLiveSummary(artifactsDir, summary);
    return summary;
  } catch (error) {
    const summary: LiveRunSummary = {
      channel,
      ok: false,
      observationMode,
      outboundNonce,
      inboundNonce,
      artifactsDir,
      transcriptMatches: [],
      steps,
    };
    await writeLiveSummary(artifactsDir, summary);
    throw error;
  } finally {
    try {
      await stopOpenClawGateway(gateway);
    } catch {
      // Preserve the original test failure if teardown also fails.
    }
  }
}
