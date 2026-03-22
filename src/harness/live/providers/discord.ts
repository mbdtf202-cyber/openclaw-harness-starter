import { findMessageId, pollFor, requireEnv } from "../provider-utils.js";
import type { LiveDriver, LiveDriverObservation } from "../types.js";

function discordApi(path: string, init?: RequestInit): Promise<Response> {
  const token = requireEnv("OPENCLAW_LIVE_DISCORD_TOKEN");
  return fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function createDiscordLiveDriver(): LiveDriver {
  const channelId = requireEnv("OPENCLAW_LIVE_DISCORD_CHANNEL_ID");
  return {
    channel: "discord",
    target: `channel:${channelId}`,
    observeOutbound: async (message): Promise<LiveDriverObservation> => {
      const found = await pollFor(async () => {
        const response = await discordApi(`/channels/${channelId}/messages?limit=20`);
        if (!response.ok) {
          throw new Error(`Discord history failed: ${response.status} ${await response.text()}`);
        }
        const messages = (await response.json()) as Array<{ id?: string; content?: string }>;
        return messages.find((entry) => entry.content?.includes(message)) ?? null;
      }, 45_000);
      return { messageId: found.id, mode: "external-history" };
    },
    injectInbound: async (message) => {
      const response = await discordApi(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message }),
      });
      if (!response.ok) {
        throw new Error(`Discord inject failed: ${response.status} ${await response.text()}`);
      }
      return { messageId: findMessageId(await response.json()) };
    },
    cleanup: async (messageIds) => {
      for (const messageId of messageIds.filter(Boolean)) {
        const response = await discordApi(`/channels/${channelId}/messages/${messageId}`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Discord cleanup failed: ${response.status} ${await response.text()}`);
        }
      }
    },
  };
}
