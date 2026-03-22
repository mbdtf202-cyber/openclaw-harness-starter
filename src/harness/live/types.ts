export type LiveChannel = "discord" | "telegram" | "slack" | "mattermost";

export type LiveStepResult = {
  name: "send" | "observe" | "inject" | "readback" | "cleanup";
  ok: boolean;
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
};

export type LiveRunSummary = {
  channel: LiveChannel;
  ok: boolean;
  observationMode: string;
  outboundNonce: string;
  inboundNonce: string;
  artifactsDir: string;
  transcriptMatches: string[];
  steps: LiveStepResult[];
};

export type LiveDriverObservation = {
  messageId?: string;
  mode: string;
};

export type LiveDriver = {
  channel: LiveChannel;
  target: string;
  observeOutbound: (message: string, sendResult?: unknown) => Promise<LiveDriverObservation>;
  injectInbound: (message: string) => Promise<{ messageId?: string }>;
  cleanup: (messageIds: string[]) => Promise<void>;
};
