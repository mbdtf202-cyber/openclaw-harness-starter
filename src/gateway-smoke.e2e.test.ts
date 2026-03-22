import { afterEach, describe, expect, it } from "vitest";
import {
  postJson,
  spawnOpenClawGateway,
  stopOpenClawGateway,
  type OpenClawGatewayInstance,
} from "./harness/openclaw-gateway.js";

describe("real OpenClaw gateway e2e harness", () => {
  let instance: OpenClawGatewayInstance | null = null;

  afterEach(async () => {
    if (!instance) {
      return;
    }
    await stopOpenClawGateway(instance);
    instance = null;
  });

  it("boots a real gateway and accepts authenticated hook traffic", async () => {
    instance = await spawnOpenClawGateway({ name: "wake-smoke" });

    const response = await postJson(
      `http://127.0.0.1:${instance.port}/hooks/wake`,
      {
        text: "wake from starter harness",
        mode: "now",
      },
      {
        "x-openclaw-token": instance.hookToken,
      },
    );

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      ok: true,
      mode: "now",
    });
    expect(instance.child.exitCode).toBeNull();
    expect(instance.stderr.join("")).not.toContain("Error:");
  });
});
