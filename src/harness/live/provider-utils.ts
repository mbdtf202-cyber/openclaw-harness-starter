import type { LiveChannel } from "./types.js";

function extractDeepValue(input: unknown, keys: string[]): unknown {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  for (const [entryKey, entryValue] of Object.entries(input as Record<string, unknown>)) {
    if (keys.includes(entryKey)) {
      return entryValue;
    }
    const nested = extractDeepValue(entryValue, keys);
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export async function pollFor<T>(
  work: () => Promise<T | null>,
  timeoutMs = 30_000,
  intervalMs = 1_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await work();
    if (result !== null) {
      return result;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms.`);
}

export function findMessageId(input: unknown): string | undefined {
  const direct = extractDeepValue(input, ["messageId", "message_id", "id"]);
  if (typeof direct === "string" || typeof direct === "number") {
    return String(direct);
  }
  return undefined;
}

export function resolveChannelList(): LiveChannel[] {
  return ["discord", "telegram", "slack", "mattermost"];
}
