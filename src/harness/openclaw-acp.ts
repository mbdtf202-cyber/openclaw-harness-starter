import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
} from "@agentclientprotocol/sdk";
import { resolveOpenClawRepo } from "./openclaw-repo.js";

const ACP_STOP_TIMEOUT_MS = 1_500;

function selectPermissionOption(params: RequestPermissionRequest): RequestPermissionResponse {
  const allowOption = params.options.find(
    (option) => option.kind === "allow_once" || option.kind === "allow_always",
  );
  if (allowOption) {
    return { outcome: { outcome: "selected", optionId: allowOption.optionId } };
  }
  return { outcome: { outcome: "cancelled" } };
}

export type AcpPromptResult = {
  stopReason: string;
  text: string;
  updates: SessionNotification[];
};

export type OpenClawAcpClientHandle = {
  client: ClientSideConnection;
  child: ChildProcessWithoutNullStreams;
  sessionId: string;
  updates: SessionNotification[];
  waitForUpdate: (
    predicate: (update: SessionNotification) => boolean,
    timeoutMs?: number,
  ) => Promise<SessionNotification>;
  promptText: (text: string) => Promise<AcpPromptResult>;
  close: () => Promise<void>;
};

function readAgentMessageChunkText(update: SessionNotification): string {
  const sessionUpdate = update.update;
  if (!("sessionUpdate" in sessionUpdate)) {
    return "";
  }
  if (sessionUpdate.sessionUpdate !== "agent_message_chunk") {
    return "";
  }
  if (sessionUpdate.content?.type !== "text") {
    return "";
  }
  return sessionUpdate.content.text;
}

export async function createOpenClawAcpClient(params: {
  gatewayUrl: string;
  gatewayToken: string;
  cwd?: string;
  repoDir?: string;
  sessionKey?: string;
}): Promise<OpenClawAcpClientHandle> {
  const repo = await resolveOpenClawRepo({
    cwd: process.cwd(),
    env: process.env,
    repoDir: params.repoDir,
  });
  const cwd = params.cwd ?? process.cwd();
  const tempDir = await fs.mkdtemp(path.join(cwd, ".openclaw-acp-"));
  const tokenFile = path.join(tempDir, "gateway.token");
  await fs.writeFile(tokenFile, params.gatewayToken, "utf8");

  const args = [
    repo.entryPath,
    "acp",
    "--url",
    params.gatewayUrl,
    "--token-file",
    tokenFile,
    "--session",
    params.sessionKey ?? "agent:main:acp-harness",
  ];

  const child = spawn("node", args, {
    cwd: repo.repoDir,
    env: {
      ...process.env,
      OPENCLAW_HIDE_BANNER: "1",
      OPENCLAW_SUPPRESS_NOTES: "1",
      OPENCLAW_SHELL: "acp-client",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (!child.stdin || !child.stdout) {
    throw new Error("Failed to create ACP stdio pipes.");
  }

  child.stderr.setEncoding("utf8");

  const updates: SessionNotification[] = [];
  const input = Writable.toWeb(child.stdin);
  const output = Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>;
  const stream = ndJsonStream(input, output);

  const client = new ClientSideConnection(
    () => ({
      sessionUpdate: async (update: SessionNotification) => {
        updates.push(update);
      },
      requestPermission: async (request: RequestPermissionRequest) => {
        return selectPermissionOption(request);
      },
    }),
    stream,
  );

  await client.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
    clientInfo: {
      name: "starter-acp-harness",
      version: "1.0.0",
    },
  });

  const session = await client.newSession({
    cwd,
    mcpServers: [],
  });

  const waitForUpdate = async (
    predicate: (update: SessionNotification) => boolean,
    timeoutMs = 15_000,
  ): Promise<SessionNotification> => {
    const existing = updates.find(predicate);
    if (existing) {
      return existing;
    }

    return await new Promise<SessionNotification>((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const match = updates.find(predicate);
        if (match) {
          clearInterval(timer);
          resolve(match);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          reject(new Error("Timed out waiting for ACP session update."));
        }
      }, 20);
    });
  };

  const close = async (): Promise<void> => {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
    const exited = await Promise.race([
      new Promise<boolean>((resolve) => {
        if (child.exitCode !== null) {
          return resolve(true);
        }
        child.once("exit", () => resolve(true));
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ACP_STOP_TIMEOUT_MS)),
    ]);
    if (!exited && child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  };

  return {
    client,
    child,
    sessionId: session.sessionId,
    updates,
    waitForUpdate,
    promptText: async (text: string): Promise<AcpPromptResult> => {
      const startIndex = updates.length;
      const response = await client.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text }],
      });
      const promptUpdates = updates.slice(startIndex);
      const collectedText = promptUpdates.map((update) => readAgentMessageChunkText(update)).join("");
      return {
        stopReason: response.stopReason,
        text: collectedText,
        updates: promptUpdates,
      };
    },
    close,
  };
}
