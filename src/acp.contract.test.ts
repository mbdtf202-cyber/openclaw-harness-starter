import { describe, expect, it } from "vitest";
import { verifyContractFixture } from "./harness/contracts/assert.js";
import {
  acpContractFixtures,
  buildAcpInitializeRequest,
  buildAcpPromptRequest,
  buildAcpSessionCreateRequest,
  buildAcpSessionUpdateNotification,
} from "./harness/contracts/acp.fixtures.js";

describe("acp contract fixtures", () => {
  it("pins the contract fixture version and provider state notes", () => {
    for (const fixture of acpContractFixtures) {
      expect(fixture.version).toBe("2026.3.23.0");
      expect(fixture.providerState.trim().length).toBeGreaterThan(0);
      expect(fixture.requiredPaths.length).toBeGreaterThan(0);
    }
  });

  it("verifies initialize, session.create, session.update, and prompt payloads against the fixture contract", () => {
    verifyContractFixture(buildAcpInitializeRequest(), acpContractFixtures[0]);
    verifyContractFixture(buildAcpSessionCreateRequest(), acpContractFixtures[1]);
    verifyContractFixture(buildAcpSessionUpdateNotification(), acpContractFixtures[2]);
    verifyContractFixture(buildAcpPromptRequest(), acpContractFixtures[3]);
  });
});
