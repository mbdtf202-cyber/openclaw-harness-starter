import { afterEach, describe, expect, it } from "vitest";
import {
  spawnOpenClawGateway,
  stopOpenClawGateway,
  type OpenClawGatewayInstance,
} from "./harness/openclaw-gateway.js";
import {
  createOpenClawAcpClient,
  type OpenClawAcpClientHandle,
} from "./harness/openclaw-acp.js";

describe("real ACP bridge harness", () => {
  let instance: OpenClawGatewayInstance | null = null;
  let client: OpenClawAcpClientHandle | null = null;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
    if (instance) {
      await stopOpenClawGateway(instance);
      instance = null;
    }
  });

  it("spawns the ACP bridge and completes a prompt against the Gateway", async () => {
    instance = await spawnOpenClawGateway({ name: "acp-bridge" });
    client = await createOpenClawAcpClient({
      gatewayUrl: `ws://127.0.0.1:${instance.port}`,
      gatewayToken: instance.gatewayToken,
      cwd: process.cwd(),
      sessionKey: "agent:main:starter-acp",
    });

    const commandsUpdate = await client.waitForUpdate(
      (update) =>
        "sessionUpdate" in update.update && update.update.sessionUpdate === "available_commands_update",
    );
    expect("sessionUpdate" in commandsUpdate.update).toBe(true);

    const result = await client.promptText("/context list");

    expect(result.stopReason).toBe("end_turn");
    expect(result.text.trim().length).toBeGreaterThan(0);
  });
});
