import { MockserverContainer } from "@testcontainers/mockserver";
import { mockServerClient } from "mockserver-client";

export type MockServerHarness = {
  baseUrl: string;
  client: ReturnType<typeof mockServerClient>;
  stop: () => Promise<void>;
};

export async function startMockServerHarness(params: {
  image?: string;
} = {}): Promise<MockServerHarness> {
  const container = await new MockserverContainer(params.image ?? "mockserver/mockserver:5.15.0").start();
  const client = mockServerClient(container.getHost(), container.getMockserverPort());
  return {
    baseUrl: container.getUrl(),
    client,
    stop: async () => {
      await container.stop();
    },
  };
}
