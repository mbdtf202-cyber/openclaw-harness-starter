import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { extractFirstTextBlock } from "./harness/chat-message-content.js";
import {
  spawnOpenClawGateway,
  stopOpenClawGateway,
  type OpenClawGatewayInstance,
} from "./harness/openclaw-gateway.js";
import { runGatewayChatSendHarness } from "./harness/openclaw-chat-send.js";

describe("real Gateway WS chat harness", () => {
  let instance: OpenClawGatewayInstance | null = null;

  afterEach(async () => {
    if (instance) {
      await stopOpenClawGateway(instance);
      instance = null;
    }
  });

  it("connects over Gateway WS and completes a chat.send round-trip", async () => {
    instance = await spawnOpenClawGateway({ name: "chat-send" });
    const sessionKey = "agent:main:telegram:direct:123456";
    const runId = `starter-chat-${randomUUID()}`;
    const result = await runGatewayChatSendHarness({
      cwd: process.cwd(),
      gatewayUrl: `ws://127.0.0.1:${instance.port}`,
      gatewayToken: instance.gatewayToken,
      sessionKey,
      message: "/context list",
      runId,
      stateDir: path.join(instance.homeDir, "gateway-ws-runner-state"),
    });

    expect(result.sendRes?.status).toBe("started");
    expect(result.sendRes?.runId).toBe(runId);
    expect(Array.isArray(result.seenEvents)).toBe(true);
    if (result.finalChatEvent) {
      expect(result.finalChatEvent.state).toBe("final");
      expect(result.finalChatEvent.runId).toBe(runId);
      expect(result.finalChatEvent.sessionKey).toBe(sessionKey);
      const finalText = extractFirstTextBlock(result.finalChatEvent.message);
      expect(typeof finalText).toBe("string");
      expect(finalText?.trim().length).toBeGreaterThan(0);
    }
  });
});
