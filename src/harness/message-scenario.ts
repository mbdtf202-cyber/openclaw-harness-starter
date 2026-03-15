import {
  createOutboundTestPlugin,
  createTestRegistry,
  type TestOutboundAdapter,
  type TestRegistry,
  type TestTargetMode,
} from "./registry.js";

export type MessageScenarioTargetResolution = {
  channel: string;
  to?: string;
  accountId?: string | null;
  mode?: TestTargetMode;
};

export type MessageScenarioDelivery =
  | {
      kind: "text";
      channel: string;
      to: string;
      text: string;
      accountId?: string | null;
      replyToId?: string | null;
      threadId?: string | number | null;
    }
  | {
      kind: "media";
      channel: string;
      to: string;
      text: string;
      mediaUrl: string;
      accountId?: string | null;
      replyToId?: string | null;
      threadId?: string | number | null;
    };

export type MessageScenarioChannelSpec = {
  id: string;
  label?: string;
  resolveTarget?: TestOutboundAdapter["resolveTarget"];
};

export type MessageScenarioHarness = {
  deliveries: MessageScenarioDelivery[];
  targetResolutions: MessageScenarioTargetResolution[];
  registry: TestRegistry;
  getPlugin: (id: string) => TestRegistry["channels"][number]["plugin"];
  reset: () => void;
};

function nextMessageId(deliveries: MessageScenarioDelivery[]): string {
  return `scenario-${deliveries.length}`;
}

export function createMessageScenarioHarness(params: {
  channels: MessageScenarioChannelSpec[];
}): MessageScenarioHarness {
  const deliveries: MessageScenarioDelivery[] = [];
  const targetResolutions: MessageScenarioTargetResolution[] = [];

  const registry = createTestRegistry(
    params.channels.map((channel) => ({
      pluginId: channel.id,
      source: "starter",
      plugin: createOutboundTestPlugin({
        id: channel.id,
        label: channel.label,
        outbound: {
          resolveTarget: channel.resolveTarget
            ? (ctx: { to?: string; accountId?: string | null; mode?: TestTargetMode }) => {
                targetResolutions.push({
                  channel: channel.id,
                  to: ctx.to,
                  accountId: ctx.accountId,
                  mode: ctx.mode,
                });
                return channel.resolveTarget!(ctx);
              }
            : undefined,
          sendText: async (ctx: {
            to: string;
            text: string;
            accountId?: string | null;
            replyToId?: string | null;
            threadId?: string | number | null;
          }) => {
            deliveries.push({
              kind: "text",
              channel: channel.id,
              to: ctx.to,
              text: ctx.text,
              accountId: ctx.accountId,
              replyToId: ctx.replyToId,
              threadId: ctx.threadId,
            });
            return { channel: channel.id, messageId: nextMessageId(deliveries) };
          },
          sendMedia: async (ctx: {
            to: string;
            text: string;
            mediaUrl?: string;
            accountId?: string | null;
            replyToId?: string | null;
            threadId?: string | number | null;
          }) => {
            deliveries.push({
              kind: "media",
              channel: channel.id,
              to: ctx.to,
              text: ctx.text,
              mediaUrl: ctx.mediaUrl ?? "",
              accountId: ctx.accountId,
              replyToId: ctx.replyToId,
              threadId: ctx.threadId,
            });
            return { channel: channel.id, messageId: nextMessageId(deliveries) };
          },
        },
      }),
    })),
  );

  return {
    deliveries,
    targetResolutions,
    registry,
    getPlugin: (id) => {
      const plugin = registry.channels.find((entry: TestRegistry["channels"][number]) => entry.pluginId === id)?.plugin;
      if (!plugin) {
        throw new Error(`Unknown test plugin: ${id}`);
      }
      return plugin;
    },
    reset: () => {
      deliveries.length = 0;
      targetResolutions.length = 0;
    },
  };
}
