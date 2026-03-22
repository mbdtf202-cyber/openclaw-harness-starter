import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import {
  buildDeviceAuthPayloadV3,
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
} from "./device-identity.js";

const PROTOCOL_VERSION = 3;

type RequestFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

type ResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message?: string; details?: unknown };
};

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
};

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
};

function rawDataToString(data: RawData): string {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  return Buffer.from(String(data)).toString("utf8");
}

export class OpenClawGatewayWsClient {
  readonly ws: WebSocket;
  readonly events: GatewayEventFrame[] = [];
  private readonly pending = new Map<string, PendingRequest>();
  private closed = false;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on("message", (data: RawData) => {
      this.handleMessage(data);
    });
    ws.on("close", (code: number, reason: Buffer) => {
      this.closed = true;
      const error = new Error(`Gateway socket closed (${code}): ${rawDataToString(reason)}`);
      for (const entry of this.pending.values()) {
        entry.reject(error);
      }
      this.pending.clear();
    });
  }

  static async connect(params: {
    url: string;
    token: string;
    identityPath: string;
    clientId?: string;
    clientDisplayName?: string;
    clientVersion?: string;
    platform?: string;
    mode?: string;
    role?: "operator" | "node";
    scopes?: string[];
    deviceFamily?: string;
  }): Promise<OpenClawGatewayWsClient> {
    const ws = new WebSocket(params.url);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    const client = new OpenClawGatewayWsClient(ws);
    const challenge = await client.waitForEvent(
      (event) => event.event === "connect.challenge",
      5_000,
    );
    const nonce = (challenge.payload as { nonce?: unknown } | undefined)?.nonce;
    if (typeof nonce !== "string" || !nonce.trim()) {
      throw new Error("Gateway did not provide a usable connect.challenge nonce.");
    }

    const role = params.role ?? "operator";
    const scopes = params.scopes ?? ["operator.admin"];
    const clientId = params.clientId ?? "cli";
    const mode = params.mode ?? "cli";
    const platform = params.platform ?? process.platform;
    const identity = loadOrCreateDeviceIdentity(path.resolve(params.identityPath));
    const signedAtMs = Date.now();
    const payload = buildDeviceAuthPayloadV3({
      deviceId: identity.deviceId,
      clientId,
      clientMode: mode,
      role,
      scopes,
      signedAtMs,
      token: params.token,
      nonce,
      platform,
      deviceFamily: params.deviceFamily,
    });

    await client.request("connect", {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: clientId,
        displayName: params.clientDisplayName ?? "Starter Harness",
        version: params.clientVersion ?? "1.0.0",
        platform,
        deviceFamily: params.deviceFamily,
        mode,
      },
      role,
      scopes,
      caps: [],
      auth: { token: params.token },
      device: {
        id: identity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
        signature: signDevicePayload(identity.privateKeyPem, payload),
        signedAt: signedAtMs,
        nonce,
      },
    });

    return client;
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) {
      throw new Error("Gateway socket is already closed.");
    }
    const id = randomUUID();
    const frame: RequestFrame = {
      type: "req",
      id,
      method,
      params,
    };

    return await new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (payload) => resolve(payload as T),
        reject,
      });
      this.ws.send(JSON.stringify(frame), (error?: Error) => {
        if (!error) {
          return;
        }
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  async waitForEvent(
    predicate: (event: GatewayEventFrame) => boolean,
    timeoutMs = 15_000,
  ): Promise<GatewayEventFrame> {
    const existing = this.events.find(predicate);
    if (existing) {
      return existing;
    }

    return await new Promise<GatewayEventFrame>((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const match = this.events.find(predicate);
        if (match) {
          clearInterval(timer);
          resolve(match);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          const seen = this.events.map((event) => event.event).join(", ") || "none";
          const lastPayload =
            this.events.length > 0
              ? JSON.stringify(this.events.at(-1)?.payload ?? null)
              : "null";
          reject(
            new Error(
              `Timed out waiting for Gateway event. Seen events: ${seen}. Last payload: ${lastPayload}`,
            ),
          );
        }
      }, 20);
    });
  }

  async close(): Promise<void> {
    if (this.closed || this.ws.readyState === WebSocket.CLOSED) {
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.ws.terminate();
        resolve();
      }, 1_000);
      this.ws.once("close", () => resolve());
      this.ws.close();
      timer.unref();
    });
  }

  private handleMessage(data: RawData): void {
    const parsed = JSON.parse(rawDataToString(data)) as ResponseFrame | GatewayEventFrame;
    if (parsed.type === "event") {
      this.events.push(parsed);
      return;
    }
    if (parsed.type !== "res") {
      return;
    }
    const pending = this.pending.get(parsed.id);
    if (!pending) {
      return;
    }
    this.pending.delete(parsed.id);
    if (parsed.ok) {
      pending.resolve(parsed.payload);
      return;
    }
    pending.reject(
      new Error(parsed.error?.message ?? `Gateway request failed for response ${parsed.id}.`),
    );
  }
}
