import { describe, expect, it } from "vitest";
import { createMessageScenarioHarness } from "./harness/message-scenario.js";

describe("message scenario harness", () => {
  it("records target resolution and outbound delivery", async () => {
    const harness = createMessageScenarioHarness({
      channels: [
        {
          id: "demo-sms",
          label: "Demo SMS",
          resolveTarget: ({
            to,
            accountId,
            mode,
          }: {
            to?: string;
            accountId?: string | null;
            mode?: "explicit" | "implicit" | "heartbeat";
          }) => ({
            ok: true,
            to: `sms:${accountId ?? "default"}:${mode ?? "explicit"}:${String(to ?? "")}`,
          }),
        },
      ],
    });

    const plugin = harness.getPlugin("demo-sms");
    const resolved = plugin.outbound.resolveTarget?.({
      to: "+15550001111",
      accountId: "ops",
      mode: "explicit",
    });

    expect(resolved).toEqual({
      ok: true,
      to: "sms:ops:explicit:+15550001111",
    });

    const result = await plugin.outbound.sendText({
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
        to: "+15550001111",
        accountId: "ops",
        mode: "explicit",
      },
    ]);
    expect(harness.deliveries).toEqual([
      {
        kind: "text",
        channel: "demo-sms",
        to: "sms:ops:explicit:+15550001111",
        text: "hello harness",
        accountId: "ops",
        replyToId: undefined,
        threadId: undefined,
      },
    ]);
  });
});
