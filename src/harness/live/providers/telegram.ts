import { findMessageId, requireEnv } from "../provider-utils.js";
import type { LiveDriver, LiveDriverObservation } from "../types.js";

async function telegramApi(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = requireEnv("OPENCLAW_LIVE_TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (json.ok !== true) {
    throw new Error(`Telegram API ${method} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

export function createTelegramLiveDriver(): LiveDriver {
  const chatId = requireEnv("OPENCLAW_LIVE_TELEGRAM_CHAT_ID");
  return {
    channel: "telegram",
    target: chatId,
    observeOutbound: async (_message, sendResult): Promise<LiveDriverObservation> => {
      return {
        messageId: findMessageId(sendResult),
        // Telegram Bot API does not expose generic channel history reads the same way as the other lanes.
        mode: "send-ack",
      };
    },
    injectInbound: async (message) => {
      const json = await telegramApi("sendMessage", {
        chat_id: chatId,
        text: message,
      });
      return { messageId: findMessageId(json) };
    },
    cleanup: async (messageIds) => {
      for (const messageId of messageIds.filter(Boolean)) {
        await telegramApi("deleteMessage", {
          chat_id: chatId,
          message_id: Number(messageId),
        });
      }
    },
  };
}
