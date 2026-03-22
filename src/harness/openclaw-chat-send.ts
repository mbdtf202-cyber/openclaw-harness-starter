import { spawn } from "node:child_process";
import path from "node:path";
import { resolveOpenClawRepo } from "./openclaw-repo.js";

export async function runGatewayChatSendHarness(params: {
  gatewayUrl: string;
  gatewayToken: string;
  sessionKey: string;
  message: string;
  runId: string;
  cwd?: string;
  repoDir?: string;
  stateDir?: string;
}): Promise<{
  sendRes?: { runId?: string; status?: string };
  finalChatEvent?: { runId?: string; sessionKey?: string; state?: string; message?: unknown };
  seenEvents?: string[];
  stdout: string;
  stderr: string;
}> {
  const cwd = params.cwd ?? process.cwd();
  const repo = await resolveOpenClawRepo({
    cwd,
    env: process.env,
    repoDir: params.repoDir,
  });
  const runnerPath = path.join(cwd, "src", "harness", "openclaw-chat-send-runner.ts");

  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", runnerPath], {
      cwd: repo.repoDir,
      env: {
        ...process.env,
        OPENCLAW_REPO_DIR: repo.repoDir,
        OPENCLAW_GATEWAY_URL: params.gatewayUrl,
        OPENCLAW_GATEWAY_TOKEN: params.gatewayToken,
        OPENCLAW_SESSION_KEY: params.sessionKey,
        OPENCLAW_CHAT_MESSAGE: params.message,
        OPENCLAW_RUN_ID: params.runId,
        OPENCLAW_STATE_DIR: params.stateDir ?? process.env.OPENCLAW_STATE_DIR ?? "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Gateway chat-send runner failed with code ${String(code)}.\n` +
              `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
          ),
        );
        return;
      }
      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const lastLine = lines.at(-1);
      if (!lastLine) {
        reject(
          new Error(
            `Gateway chat-send runner produced no JSON output.\n--- stderr ---\n${stderr}`,
          ),
        );
        return;
      }
      try {
        const parsed = JSON.parse(lastLine) as {
          sendRes?: { runId?: string; status?: string };
          finalChatEvent?: {
            runId?: string;
            sessionKey?: string;
            state?: string;
            message?: unknown;
          };
          seenEvents?: string[];
        };
        resolve({
          ...parsed,
          stdout,
          stderr,
        });
      } catch (error) {
        reject(
          new Error(
            `Failed to parse Gateway chat-send runner output: ${String(error)}.\n` +
              `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
          ),
        );
      }
    });
  });
}
