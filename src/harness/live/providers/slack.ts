import { findMessageId, pollFor, requireEnv } from "../provider-utils.js";
import type { LiveDriver, LiveDriverObservation } from "../types.js";

async function slackApi(method: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = requireEnv("OPENCLAW_LIVE_SLACK_BOT_TOKEN");
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (json.ok !== true) {
    throw new Error(`Slack API ${method} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

export function createSlackLiveDriver(): LiveDriver {
  const channelId = requireEnv("OPENCLAW_LIVE_SLACK_CHANNEL_ID");
  return {
    channel: "slack",
    target: channelId,
    observeOutbound: async (message): Promise<LiveDriverObservation> => {
      const found = await pollFor(async () => {
        const json = await slackApi("conversations.history", { channel: channelId, limit: 20 });
        const messages = (json.messages as Array<{ ts?: string; text?: string }>) ?? [];
        return messages.find((entry) => entry.text?.includes(message)) ?? null;
      }, 45_000);
      return { messageId: found.ts, mode: "external-history" };
    },
    injectInbound: async (message) => {
      const json = await slackApi("chat.postMessage", { channel: channelId, text: message });
      return { messageId: findMessageId(json.ts ?? json.message) };
    },
    cleanup: async (messageIds) => {
      for (const messageId of messageIds.filter(Boolean)) {
        await slackApi("chat.delete", { channel: channelId, ts: messageId });
      }
    },
  };
}
