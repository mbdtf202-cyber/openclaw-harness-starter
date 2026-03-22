import path from "node:path";
import { pathToFileURL } from "node:url";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const repoDir = requireEnv("OPENCLAW_REPO_DIR");
  const gatewayUrl = requireEnv("OPENCLAW_GATEWAY_URL");
  const gatewayToken = requireEnv("OPENCLAW_GATEWAY_TOKEN");
  const sessionKey = requireEnv("OPENCLAW_SESSION_KEY");
  const message = requireEnv("OPENCLAW_CHAT_MESSAGE");
  const runId = requireEnv("OPENCLAW_RUN_ID");

  const [{ connectGatewayClient }, { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES }] =
    await Promise.all([
      import(pathToFileURL(path.join(repoDir, "src/gateway/test-helpers.e2e.ts")).href),
      import(pathToFileURL(path.join(repoDir, "src/utils/message-channel.ts")).href),
    ]);

  const events: Array<{ event?: string; payload?: unknown }> = [];
  let resolveFinalEvent!: (value: { event?: string; payload?: unknown }) => void;
  const finalEvent = new Promise<{ event?: string; payload?: unknown }>((resolve) => {
    resolveFinalEvent = resolve;
  });

  const client = await connectGatewayClient({
    url: gatewayUrl,
    token: gatewayToken,
    clientName: GATEWAY_CLIENT_NAMES.CLI,
    clientDisplayName: "starter-ws-runner",
    clientVersion: "1.0.0",
    platform: "test",
    mode: GATEWAY_CLIENT_MODES.CLI,
    onEvent: (event: { event?: string; payload?: unknown }) => {
      events.push(event);
      const payload = event.payload as
        | { runId?: unknown; sessionKey?: unknown; state?: unknown }
        | undefined;
      if (
        event.event === "chat" &&
        payload?.runId === runId &&
        payload?.sessionKey === sessionKey &&
        payload?.state === "final"
      ) {
        resolveFinalEvent(event);
      }
    },
  });

  try {
    const sendRes = (await client.request("chat.send", {
      sessionKey,
      message,
      idempotencyKey: runId,
    })) as { runId?: string; status?: string };
    const finalChatEvent = (await Promise.race([
      finalEvent,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
    ])) as { payload?: { runId?: string; sessionKey?: string; state?: string; message?: unknown } } | null;

    process.stdout.write(
      `${JSON.stringify({
        sendRes,
        finalChatEvent: finalChatEvent?.payload ?? null,
        seenEvents: events.map((event) => event.event ?? "unknown"),
      })}\n`,
    );
  } finally {
    client.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
