export type TestTargetMode = "explicit" | "implicit" | "heartbeat";

export type TestTargetResolution =
  | {
      ok: true;
      to: string;
    }
  | {
      ok: false;
      error: Error;
    };

export type TestOutboundContext = {
  to: string;
  text: string;
  mediaUrl?: string;
  accountId?: string | null;
  replyToId?: string | null;
  threadId?: string | number | null;
};

export type TestOutboundAdapter = {
  resolveTarget?: (params: {
    to?: string;
    accountId?: string | null;
    mode?: TestTargetMode;
  }) => TestTargetResolution;
  sendText: (ctx: TestOutboundContext) => Promise<{ channel: string; messageId: string }>;
  sendMedia: (ctx: TestOutboundContext) => Promise<{ channel: string; messageId: string }>;
};

export type TestPlugin = {
  id: string;
  label: string;
  outbound: TestOutboundAdapter;
};

export type TestRegistryEntry = {
  pluginId: string;
  plugin: TestPlugin;
  source: string;
};

export type TestRegistry = {
  channels: TestRegistryEntry[];
};

export function createTestRegistry(channels: TestRegistryEntry[] = []): TestRegistry {
  return { channels };
}

export function createOutboundTestPlugin(params: {
  id: string;
  label?: string;
  outbound: TestOutboundAdapter;
}): TestPlugin {
  return {
    id: params.id,
    label: params.label ?? params.id,
    outbound: params.outbound,
  };
}
