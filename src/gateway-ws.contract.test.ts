import { describe, expect, it } from "vitest";
import { verifyContractFixture } from "./harness/contracts/assert.js";
import {
  buildChatSendRequest,
  buildConnectChallengeEvent,
  buildSessionsListRequest,
  buildSessionsPatchRequest,
  gatewayWsContractFixtures,
} from "./harness/contracts/gateway-ws.fixtures.js";

describe("gateway ws contract fixtures", () => {
  it("pins the contract fixture version and provider state notes", () => {
    for (const fixture of gatewayWsContractFixtures) {
      expect(fixture.version).toBe("2026.3.23.0");
      expect(fixture.providerState.trim().length).toBeGreaterThan(0);
      expect(fixture.requiredPaths.length).toBeGreaterThan(0);
    }
  });

  it("verifies connect.challenge, chat.send, and sessions payloads against the fixture contract", () => {
    verifyContractFixture(buildConnectChallengeEvent(), gatewayWsContractFixtures[0]);
    verifyContractFixture(buildChatSendRequest(), gatewayWsContractFixtures[1]);
    verifyContractFixture(buildSessionsListRequest(), gatewayWsContractFixtures[2]);
    verifyContractFixture(buildSessionsPatchRequest(), gatewayWsContractFixtures[3]);
  });
});
