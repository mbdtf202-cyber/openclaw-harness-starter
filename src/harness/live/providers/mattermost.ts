import { findMessageId, pollFor, requireEnv } from "../provider-utils.js";
import type { LiveDriver, LiveDriverObservation } from "../types.js";

async function mattermostApi(path: string, init?: RequestInit): Promise<Response> {
  const token = requireEnv("OPENCLAW_LIVE_MATTERMOST_TOKEN");
  const baseUrl = requireEnv("OPENCLAW_LIVE_MATTERMOST_BASE_URL");
  return await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function createMattermostLiveDriver(): LiveDriver {
  const channelId = requireEnv("OPENCLAW_LIVE_MATTERMOST_CHANNEL_ID");
  return {
    channel: "mattermost",
    target: `channel:${channelId}`,
    observeOutbound: async (message): Promise<LiveDriverObservation> => {
      const found = await pollFor(async () => {
        const response = await mattermostApi(`/api/v4/channels/${channelId}/posts?page=0&per_page=20`);
        if (!response.ok) {
          throw new Error(`Mattermost history failed: ${response.status} ${await response.text()}`);
        }
        const json = (await response.json()) as {
          order?: string[];
          posts?: Record<string, { id?: string; message?: string }>;
        };
        for (const id of json.order ?? []) {
          const post = json.posts?.[id];
          if (post?.message?.includes(message)) {
            return post;
          }
        }
        return null;
      }, 45_000);
      return { messageId: found.id, mode: "external-history" };
    },
    injectInbound: async (message) => {
      const response = await mattermostApi("/api/v4/posts", {
        method: "POST",
        body: JSON.stringify({ channel_id: channelId, message }),
      });
      if (!response.ok) {
        throw new Error(`Mattermost inject failed: ${response.status} ${await response.text()}`);
      }
      return { messageId: findMessageId(await response.json()) };
    },
    cleanup: async (messageIds) => {
      for (const messageId of messageIds.filter(Boolean)) {
        const response = await mattermostApi(`/api/v4/posts/${messageId}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Mattermost cleanup failed: ${response.status} ${await response.text()}`);
        }
      }
    },
  };
}
