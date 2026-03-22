import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { isDockerAvailable } from "./harness/deps/docker.js";
import { exposeHostPortForContainers } from "./harness/deps/wiremock.js";
import {
  coalesceVisibleDeliveries,
  requestWithRetry,
} from "./harness/faults/retryable-fetch.js";
import { startToxiproxyHarness } from "./harness/faults/toxiproxy.js";

type Disposable = { stop: () => Promise<void> };

async function startFaultServer(): Promise<{
  url: string;
  stop: () => Promise<void>;
}> {
  const server = createServer((req, res) => {
    res.writeHead(200, {
      "content-type": "text/plain",
      "x-delivery-id": "delivery-1",
    });
    res.end(`ok:${req.url ?? "/"}`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe("fault harness", () => {
  const disposables: Disposable[] = [];

  afterEach(async () => {
    while (disposables.length > 0) {
      const disposable = disposables.pop();
      if (disposable) {
        await disposable.stop();
      }
    }
  });

  it("injects latency through Toxiproxy", async () => {
    if (!(await isDockerAvailable())) {
      return;
    }

    const upstream = await startFaultServer();
    disposables.push(upstream);
    const upstreamPort = Number(new URL(upstream.url).port);
    await exposeHostPortForContainers(upstreamPort);

    const toxiproxy = await startToxiproxyHarness({
      upstream: `host.testcontainers.internal:${upstreamPort}`,
    });
    disposables.push(toxiproxy);

    await toxiproxy.addLatency("upstream-latency", 700);

    const startedAt = Date.now();
    const response = await fetch(`${toxiproxy.proxyUrl}/latency-check`);
    const durationMs = Date.now() - startedAt;

    expect(response.status).toBe(200);
    expect(durationMs).toBeGreaterThanOrEqual(600);
  });

  it("recovers from unavailable and reset faults with retries", async () => {
    if (!(await isDockerAvailable())) {
      return;
    }

    const upstream = await startFaultServer();
    disposables.push(upstream);
    const upstreamPort = Number(new URL(upstream.url).port);
    await exposeHostPortForContainers(upstreamPort);

    const toxiproxy = await startToxiproxyHarness({
      upstream: `host.testcontainers.internal:${upstreamPort}`,
    });
    disposables.push(toxiproxy);

    await toxiproxy.setEnabled(false);
    const unavailable = await requestWithRetry({
      url: `${toxiproxy.proxyUrl}/retry-check`,
      maxAttempts: 2,
      timeoutMs: 250,
      onAttemptFailure: async (attempt) => {
        if (attempt.attempt === 1) {
          await toxiproxy.setEnabled(true);
        }
      },
    });
    expect(unavailable.text).toContain("ok:/retry-check");
    expect(unavailable.attempts).toHaveLength(2);

    await toxiproxy.addResetPeer("reset-peer");
    const reset = await requestWithRetry({
      url: `${toxiproxy.proxyUrl}/reset-check`,
      maxAttempts: 2,
      timeoutMs: 250,
      onAttemptFailure: async (attempt) => {
        if (attempt.attempt === 1) {
          await toxiproxy.removeAllToxics();
        }
      },
    });
    expect(reset.text).toContain("ok:/reset-check");
    expect(reset.attempts).toHaveLength(2);
  });

  it("coalesces duplicate visible deliveries by idempotency key", () => {
    const result = coalesceVisibleDeliveries([
      { dedupeKey: "delivery-1", value: "hello" },
      { dedupeKey: "delivery-1", value: "hello" },
      { dedupeKey: "delivery-2", value: "world" },
    ]);

    expect(result.visible).toEqual(["hello", "world"]);
    expect(result.duplicateKeys).toEqual(["delivery-1"]);
  });
});
