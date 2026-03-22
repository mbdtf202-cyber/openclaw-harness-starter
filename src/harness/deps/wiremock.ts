import { GenericContainer, TestContainers, type StartedTestContainer } from "testcontainers";

export type WireMockStubMapping = {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  scenarioName?: string;
  requiredScenarioState?: string;
  newScenarioState?: string;
};

export type WireMockHarness = {
  baseUrl: string;
  adminUrl: string;
  container: StartedTestContainer;
  registerStub: (mapping: WireMockStubMapping) => Promise<void>;
  listMappings: () => Promise<{ mappings: Array<Record<string, unknown>> }>;
  reset: () => Promise<void>;
  stop: () => Promise<void>;
};

async function waitForMappings(adminUrl: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${adminUrl}/mappings`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until WireMock finishes booting.
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for WireMock admin at ${adminUrl}.`);
}

export async function exposeHostPortForContainers(port: number): Promise<void> {
  await TestContainers.exposeHostPorts(port);
}

export async function startWireMockHarness(params: {
  proxyTargetBaseUrl?: string;
  image?: string;
} = {}): Promise<WireMockHarness> {
  const command = ["--global-response-templating"];
  if (params.proxyTargetBaseUrl) {
    command.push(`--proxy-all=${params.proxyTargetBaseUrl}`, "--record-mappings");
  }

  const container = await new GenericContainer(params.image ?? "wiremock/wiremock:3.13.1")
    .withExposedPorts(8080)
    .withCommand(command)
    .start();

  const baseUrl = `http://${container.getHost()}:${container.getMappedPort(8080)}`;
  const adminUrl = `${baseUrl}/__admin`;
  await waitForMappings(adminUrl);

  return {
    baseUrl,
    adminUrl,
    container,
    registerStub: async (mapping) => {
      const response = await fetch(`${adminUrl}/mappings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mapping),
      });
      if (!response.ok) {
        throw new Error(`WireMock stub registration failed: ${response.status} ${await response.text()}`);
      }
    },
    listMappings: async () => {
      const response = await fetch(`${adminUrl}/mappings`);
      if (!response.ok) {
        throw new Error(`WireMock listMappings failed: ${response.status} ${await response.text()}`);
      }
      return (await response.json()) as { mappings: Array<Record<string, unknown>> };
    },
    reset: async () => {
      const response = await fetch(`${adminUrl}/reset`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`WireMock reset failed: ${response.status} ${await response.text()}`);
      }
    },
    stop: async () => {
      await container.stop();
    },
  };
}
