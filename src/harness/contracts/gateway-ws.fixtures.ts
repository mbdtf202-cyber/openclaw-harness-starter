import type { ContractFixture } from "./types.js";

const CONTRACT_VERSION = "2026.3.23.0";

export function buildConnectChallengeEvent(): {
  type: "event";
  event: "connect.challenge";
  payload: { nonce: string };
} {
  return {
    type: "event",
    event: "connect.challenge",
    payload: { nonce: "nonce-connect-challenge" },
  };
}

export function buildChatSendRequest(): {
  type: "req";
  id: string;
  method: "chat.send";
  params: { sessionKey: string; text: string; runId: string };
} {
  return {
    type: "req",
    id: "chat-send-req",
    method: "chat.send",
    params: {
      sessionKey: "agent:main:discord:channel:123",
      text: "starter harness says hello",
      runId: "chat-send-run",
    },
  };
}

export function buildSessionsListRequest(): {
  type: "req";
  id: string;
  method: "sessions.list";
  params: { limit: number; includeArchived: boolean };
} {
  return {
    type: "req",
    id: "sessions-list-req",
    method: "sessions.list",
    params: {
      limit: 20,
      includeArchived: false,
    },
  };
}

export function buildSessionsPatchRequest(): {
  type: "req";
  id: string;
  method: "sessions.patch";
  params: {
    sessionKey: string;
    think: "high";
    verbose: "on";
  };
} {
  return {
    type: "req",
    id: "sessions-patch-req",
    method: "sessions.patch",
    params: {
      sessionKey: "agent:main:discord:channel:123",
      think: "high",
      verbose: "on",
    },
  };
}

export const gatewayWsContractFixtures: ContractFixture[] = [
  {
    name: "gateway.connect.challenge",
    version: CONTRACT_VERSION,
    providerState: "Gateway accepted a socket and is requesting signed device proof.",
    requiredPaths: ["type", "event", "payload.nonce"],
    notes: ["Use this as the first server event in client protocol contract tests."],
    payload: buildConnectChallengeEvent(),
  },
  {
    name: "gateway.chat.send",
    version: CONTRACT_VERSION,
    providerState: "Operator session is connected and is starting a non-blocking run.",
    requiredPaths: ["type", "method", "params.sessionKey", "params.text", "params.runId"],
    notes: ["The request is contract-level only; transport acks and final chat events belong to e2e."],
    payload: buildChatSendRequest(),
  },
  {
    name: "gateway.sessions.list",
    version: CONTRACT_VERSION,
    providerState: "Gateway session store has routable sessions available for listing.",
    requiredPaths: ["type", "method", "params.limit", "params.includeArchived"],
    payload: buildSessionsListRequest(),
  },
  {
    name: "gateway.sessions.patch",
    version: CONTRACT_VERSION,
    providerState: "Gateway accepts per-session override updates for an existing session.",
    requiredPaths: ["type", "method", "params.sessionKey", "params.think", "params.verbose"],
    payload: buildSessionsPatchRequest(),
  },
];
