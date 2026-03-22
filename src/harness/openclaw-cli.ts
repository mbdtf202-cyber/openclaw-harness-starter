import { spawn } from "node:child_process";
import { resolveOpenClawRepo } from "./openclaw-repo.js";

export type OpenClawCliResult = {
  stdout: string;
  stderr: string;
  json?: unknown;
};

export async function runOpenClawCli(params: {
  args: string[];
  cwd?: string;
  repoDir?: string;
  env?: Record<string, string>;
}): Promise<OpenClawCliResult> {
  const cwd = params.cwd ?? process.cwd();
  const repo = await resolveOpenClawRepo({
    cwd,
    env: process.env,
    repoDir: params.repoDir,
  });

  return await new Promise<OpenClawCliResult>((resolve, reject) => {
    const child = spawn("node", [repo.entryPath, ...params.args], {
      cwd: repo.repoDir,
      env: {
        ...process.env,
        ...params.env,
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
            `OpenClaw CLI failed with code ${String(code)}.\n` +
              `Args: ${params.args.join(" ")}\n` +
              `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
          ),
        );
        return;
      }

      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const lastLine = lines.at(-1);

      if (!lastLine) {
        resolve({ stdout, stderr });
        return;
      }

      try {
        resolve({
          stdout,
          stderr,
          json: JSON.parse(lastLine),
        });
      } catch {
        resolve({ stdout, stderr });
      }
    });
  });
}
