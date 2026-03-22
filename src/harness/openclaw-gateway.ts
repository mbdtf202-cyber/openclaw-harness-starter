import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { request as httpRequest } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { resolveOpenClawRepo } from "./openclaw-repo.js";

const GATEWAY_START_TIMEOUT_MS = 60_000;
const GATEWAY_STOP_TIMEOUT_MS = 1_500;

export type OpenClawGatewayInstance = {
  name: string;
  repoDir: string;
  entryPath: string;
  port: number;
  hookToken: string;
  gatewayToken: string;
  homeDir: string;
  stateDir: string;
  configPath: string;
  child: ChildProcessWithoutNullStreams;
  stdout: string[];
  stderr: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeRecords(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    if (isRecord(current) && isRecord(value)) {
      merged[key] = mergeRecords(current, value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

async function getFreePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to reserve an ephemeral port.");
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

async function waitForPortOpen(
  child: ChildProcessWithoutNullStreams,
  port: number,
  stdout: string[],
  stderr: string[],
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `OpenClaw gateway exited before listening (code=${String(child.exitCode)} signal=${String(child.signalCode)}).\n` +
          `--- stdout ---\n${stdout.join("")}\n--- stderr ---\n${stderr.join("")}`,
      );
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect({ host: "127.0.0.1", port });
        socket.once("connect", () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", (err) => {
          socket.destroy();
          reject(err);
        });
      });
      return;
    } catch {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  }

  throw new Error(
    `Timed out waiting for OpenClaw gateway to listen on port ${port}.\n` +
      `--- stdout ---\n${stdout.join("")}\n--- stderr ---\n${stderr.join("")}`,
  );
}

export async function spawnOpenClawGateway(params: {
  name?: string;
  repoDir?: string;
  configOverride?: Record<string, unknown>;
  env?: Record<string, string>;
  mode?: "minimal" | "full";
  extraArgs?: string[];
} = {}): Promise<OpenClawGatewayInstance> {
  const name = params.name ?? "smoke";
  const mode = params.mode ?? "minimal";
  const repo = await resolveOpenClawRepo({
    cwd: process.cwd(),
    env: process.env,
    repoDir: params.repoDir,
  });
  const port = await getFreePort();
  const hookToken = `hook-${name}-${randomUUID()}`;
  const gatewayToken = `gateway-${name}-${randomUUID()}`;
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), `openclaw-harness-${name}-`));
  const configDir = path.join(homeDir, ".openclaw");
  const stateDir = path.join(configDir, "state");
  const configPath = path.join(configDir, "openclaw.json");

  await fs.mkdir(configDir, { recursive: true });

  const baseConfig = {
    gateway: {
      port,
      auth: { mode: "token", token: gatewayToken },
      controlUi: { enabled: false },
    },
    hooks: { enabled: true, token: hookToken, path: "/hooks" },
  } satisfies Record<string, unknown>;

  const config = params.configOverride ? mergeRecords(baseConfig, params.configOverride) : baseConfig;
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  const stdout: string[] = [];
  const stderr: string[] = [];
  const childEnv: Record<string, string> = {
    ...process.env,
    ...params.env,
    HOME: homeDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_GATEWAY_TOKEN: "",
    OPENCLAW_GATEWAY_PASSWORD: "",
    OPENCLAW_SKIP_GMAIL_WATCHER: "1",
    OPENCLAW_SKIP_CRON: "1",
    OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1",
    OPENCLAW_SKIP_CANVAS_HOST: "1",
    VITEST: "1",
  };
  if (mode === "minimal") {
    childEnv.OPENCLAW_SKIP_CHANNELS = "1";
    childEnv.OPENCLAW_SKIP_PROVIDERS = "1";
    childEnv.OPENCLAW_TEST_MINIMAL_GATEWAY = "1";
  }

  const child = spawn(
    "node",
    [
      repo.entryPath,
      "gateway",
      "--port",
      String(port),
      "--bind",
      "loopback",
      "--allow-unconfigured",
      ...(params.extraArgs ?? []),
    ],
    {
      cwd: repo.repoDir,
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(String(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));

  try {
    await waitForPortOpen(child, port, stdout, stderr, GATEWAY_START_TIMEOUT_MS);
  } catch (error) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
    await fs.rm(homeDir, { recursive: true, force: true });
    throw error;
  }

  return {
    name,
    repoDir: repo.repoDir,
    entryPath: repo.entryPath,
    port,
    hookToken,
    gatewayToken,
    homeDir,
    stateDir,
    configPath,
    child,
    stdout,
    stderr,
  };
}

export async function stopOpenClawGateway(instance: OpenClawGatewayInstance): Promise<void> {
  if (instance.child.exitCode === null && !instance.child.killed) {
    instance.child.kill("SIGTERM");
  }

  const exited = await Promise.race([
    new Promise<boolean>((resolve) => {
      if (instance.child.exitCode !== null) {
        return resolve(true);
      }
      instance.child.once("exit", () => resolve(true));
    }),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), GATEWAY_STOP_TIMEOUT_MS)),
  ]);

  if (!exited && instance.child.exitCode === null && !instance.child.killed) {
    instance.child.kill("SIGKILL");
  }

  await fs.rm(instance.homeDir, { recursive: true, force: true });
}

export async function postJson(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: unknown }> {
  const payload = JSON.stringify(body);
  const parsed = new URL(url);

  return await new Promise<{ status: number; json: unknown }>((resolve, reject) => {
    const request = httpRequest(
      {
        method: "POST",
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if (!raw.trim()) {
            resolve({ status: response.statusCode ?? 0, json: null });
            return;
          }
          try {
            resolve({ status: response.statusCode ?? 0, json: JSON.parse(raw) });
          } catch {
            resolve({ status: response.statusCode ?? 0, json: raw });
          }
        });
      },
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

export async function writeSessionStoreEntries(params: {
  stateDir: string;
  entries: Record<string, Record<string, unknown>>;
  agentId?: string;
}): Promise<string> {
  const agentId = params.agentId ?? "main";
  const storeDir = path.join(params.stateDir, "agents", agentId, "sessions");
  const storePath = path.join(storeDir, "sessions.json");
  await fs.mkdir(storeDir, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(params.entries, null, 2), "utf8");
  return storePath;
}
