import { describe, expect, it } from "vitest";
import {
  createMessageScenarioHarness,
  createOutboundTestPlugin,
  createTestRegistry,
} from "openclaw/plugin-sdk/test-utils";

describe("message scenario harness", () => {
  it("records target resolution and outbound delivery", async () => {
    const harness = createMessageScenarioHarness({
      channels: [
        {
          id: "demo-sms",
          label: "Demo SMS",
          resolveTarget: ({ to, accountId, mode }) => ({
            ok: true,
            to: `sms:${accountId ?? "default"}:${mode ?? "explicit"}:${String(to ?? "")}`,
          }),
        },
      ],
    });

    await harness.withRegistry(async () => {
      const outbound = createOutboundTestPlugin({
        id: "demo-sms",
        outbound: harness.registry.channels[0]!.plugin.outbound!,
        label: "Demo SMS",
      }).outbound!;

      const registry = createTestRegistry([
        {
          pluginId: "demo-sms",
          plugin: createOutboundTestPlugin({
            id: "demo-sms",
            outbound,
            label: "Demo SMS",
          }),
          source: "starter",
        },
      ]);

      expect(registry.channels).toHaveLength(1);

      const resolved = outbound.resolveTarget?.({
        cfg: {},
        to: "+15550001111",
        accountId: "ops",
        mode: "explicit",
      });
      expect(resolved).toEqual({
        ok: true,
        to: "sms:ops:explicit:+15550001111",
      });

      const result = await outbound.sendText({
        cfg: {},
        to: resolved && resolved.ok ? resolved.to : "",
        text: "hello harness",
        accountId: "ops",
      });

      expect(result).toEqual({
        channel: "demo-sms",
        messageId: "scenario-1",
      });
      expect(harness.targetResolutions).toEqual([
        {
          channel: "demo-sms",
          cfg: {},
          to: "+15550001111",
          allowFrom: undefined,
          accountId: "ops",
          mode: "explicit",
        },
      ]);
      expect(harness.deliveries).toEqual([
        expect.objectContaining({
          kind: "text",
          channel: "demo-sms",
          to: "sms:ops:explicit:+15550001111",
          text: "hello harness",
          accountId: "ops",
        }),
      ]);
    });
  });
});
