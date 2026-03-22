import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { isDockerAvailable } from "./harness/deps/docker.js";
import { startMockServerHarness } from "./harness/deps/mockserver.js";
import { exposeHostPortForContainers, startWireMockHarness } from "./harness/deps/wiremock.js";

type Disposable = { stop: () => Promise<void> };

async function startUpstreamServer(): Promise<{
  url: string;
  stop: () => Promise<void>;
}> {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`upstream:${req.url ?? "/"}`);
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

describe("dependency harnesses", () => {
  const disposables: Disposable[] = [];

  afterEach(async () => {
    while (disposables.length > 0) {
      const disposable = disposables.pop();
      if (disposable) {
        await disposable.stop();
      }
    }
  });

  it("records and replays upstream traffic with WireMock", async () => {
    if (!(await isDockerAvailable())) {
      return;
    }

    const upstream = await startUpstreamServer();
    disposables.push(upstream);
    const upstreamPort = Number(new URL(upstream.url).port);
    await exposeHostPortForContainers(upstreamPort);

    const wiremock = await startWireMockHarness({
      proxyTargetBaseUrl: `http://host.testcontainers.internal:${upstreamPort}`,
    });
    disposables.push(wiremock);

    const firstResponse = await fetch(`${wiremock.baseUrl}/recordable`);
    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.text()).toContain("upstream:/recordable");

    await upstream.stop();

    const secondResponse = await fetch(`${wiremock.baseUrl}/recordable`);
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.text()).toContain("upstream:/recordable");

    const mappings = await wiremock.listMappings();
    expect(mappings.mappings.length).toBeGreaterThan(0);
  });

  it("supports stateful responses with WireMock scenarios", async () => {
    if (!(await isDockerAvailable())) {
      return;
    }

    const wiremock = await startWireMockHarness();
    disposables.push(wiremock);

    await wiremock.registerStub({
      scenarioName: "bootstrap",
      requiredScenarioState: "Started",
      newScenarioState: "READY",
      request: { method: "GET", url: "/scenario" },
      response: { status: 202, body: "booting" },
    });
    await wiremock.registerStub({
      scenarioName: "bootstrap",
      requiredScenarioState: "READY",
      newScenarioState: "READY",
      request: { method: "GET", url: "/scenario" },
      response: { status: 200, body: "ready" },
    });

    const first = await fetch(`${wiremock.baseUrl}/scenario`);
    const second = await fetch(`${wiremock.baseUrl}/scenario`);

    expect(first.status).toBe(202);
    expect(await first.text()).toBe("booting");
    expect(second.status).toBe(200);
    expect(await second.text()).toBe("ready");
  });

  it("spins up MockServer expectations through Testcontainers", async () => {
    if (!(await isDockerAvailable())) {
      return;
    }

    const mockserver = await startMockServerHarness();
    disposables.push(mockserver);

    await mockserver.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/health",
      },
      httpResponse: {
        statusCode: 200,
        body: {
          string: "ok",
        },
      },
    });

    const response = await fetch(`${mockserver.baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
