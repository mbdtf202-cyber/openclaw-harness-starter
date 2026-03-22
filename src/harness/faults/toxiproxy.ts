import {
  ToxiProxyContainer,
  type CreatedProxy,
} from "@testcontainers/toxiproxy";

export type ToxiproxyHarness = {
  proxy: CreatedProxy;
  proxyUrl: string;
  addLatency: (name: string, latencyMs: number, jitterMs?: number) => Promise<void>;
  addResetPeer: (name: string) => Promise<void>;
  removeAllToxics: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  stop: () => Promise<void>;
};

export async function startToxiproxyHarness(params: {
  upstream: string;
  image?: string;
  name?: string;
}): Promise<ToxiproxyHarness> {
  const container = await new ToxiProxyContainer(params.image ?? "ghcr.io/shopify/toxiproxy:2.12.0").start();
  const proxy = await container.createProxy({
    name: params.name ?? "openclaw-harness-upstream",
    upstream: params.upstream,
  });
  const createdToxics: Array<{ remove: () => Promise<void> }> = [];

  return {
    proxy,
    proxyUrl: `http://${proxy.host}:${proxy.port}`,
    addLatency: async (name, latencyMs, jitterMs = 0) => {
      const toxic = await proxy.instance.addToxic({
        attributes: {
          latency: latencyMs,
          jitter: jitterMs,
        },
        name,
        stream: "upstream",
        toxicity: 1,
        type: "latency",
      });
      createdToxics.push(toxic);
    },
    addResetPeer: async (name) => {
      const toxic = await proxy.instance.addToxic({
        attributes: {
          timeout: 0,
        },
        name,
        stream: "downstream",
        toxicity: 1,
        type: "reset_peer",
      });
      createdToxics.push(toxic);
    },
    removeAllToxics: async () => {
      while (createdToxics.length > 0) {
        const toxic = createdToxics.pop();
        if (toxic) {
          await toxic.remove();
        }
      }
    },
    setEnabled: async (enabled) => {
      await proxy.setEnabled(enabled);
    },
    stop: async () => {
      await container.stop();
    },
  };
}
