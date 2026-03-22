import type { ContractFixture } from "./types.js";

const CONTRACT_VERSION = "2026.3.23.0";

export function buildAcpInitializeRequest() {
  return {
    method: "initialize",
    params: {
      protocolVersion: 1,
      clientInfo: {
        name: "openclaw-harness-framework",
        version: CONTRACT_VERSION,
      },
    },
  } as const;
}

export function buildAcpSessionCreateRequest() {
  return {
    method: "session.create",
    params: {
      cwd: "/workspace/openclaw-harness",
      mcpServers: [],
    },
  } as const;
}

export function buildAcpSessionUpdateNotification() {
  return {
    method: "session.update",
    params: {
      sessionId: "session-1",
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: "partial response",
        },
      },
    },
  } as const;
}

export function buildAcpPromptRequest() {
  return {
    method: "prompt",
    params: {
      sessionId: "session-1",
      prompt: [{ type: "text", text: "Summarize the current routing state." }],
    },
  } as const;
}

export const acpContractFixtures: ContractFixture[] = [
  {
    name: "acp.initialize",
    version: CONTRACT_VERSION,
    providerState: "ACP bridge is starting a new client connection.",
    requiredPaths: ["method", "params.protocolVersion", "params.clientInfo.name", "params.clientInfo.version"],
    payload: buildAcpInitializeRequest(),
  },
  {
    name: "acp.session.create",
    version: CONTRACT_VERSION,
    providerState: "ACP bridge is creating a writable session with no extra MCP servers.",
    requiredPaths: ["method", "params.cwd", "params.mcpServers"],
    payload: buildAcpSessionCreateRequest(),
  },
  {
    name: "acp.session.update",
    version: CONTRACT_VERSION,
    providerState: "ACP bridge is streaming a text chunk for an active session.",
    requiredPaths: ["method", "params.sessionId", "params.update.sessionUpdate", "params.update.content.text"],
    payload: buildAcpSessionUpdateNotification(),
  },
  {
    name: "acp.prompt",
    version: CONTRACT_VERSION,
    providerState: "ACP bridge is forwarding an operator prompt into an active session.",
    requiredPaths: ["method", "params.sessionId", "params.prompt.0.type", "params.prompt.0.text"],
    payload: buildAcpPromptRequest(),
  },
];
