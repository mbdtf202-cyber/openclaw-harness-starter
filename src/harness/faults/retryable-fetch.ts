export type RetriableAttempt = {
  attempt: number;
  ok: boolean;
  status?: number;
  error?: string;
  durationMs: number;
};

export type RetriableFetchResult = {
  text: string;
  attempts: RetriableAttempt[];
};

export async function requestWithRetry(params: {
  url: string;
  maxAttempts: number;
  timeoutMs: number;
  backoffMs?: number;
  onAttemptFailure?: (attempt: RetriableAttempt) => Promise<void> | void;
}): Promise<RetriableFetchResult> {
  const attempts: RetriableAttempt[] = [];
  const backoffMs = params.backoffMs ?? 50;

  for (let attempt = 1; attempt <= params.maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
    try {
      const response = await fetch(params.url, { signal: controller.signal });
      const durationMs = Date.now() - startedAt;
      const text = await response.text();
      const entry: RetriableAttempt = {
        attempt,
        ok: response.ok,
        status: response.status,
        durationMs,
      };
      attempts.push(entry);
      clearTimeout(timeout);
      if (response.ok) {
        return { text, attempts };
      }
      if (attempt < params.maxAttempts) {
        await params.onAttemptFailure?.(entry);
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw new Error(`Non-success response after ${attempt} attempts: ${response.status}`);
    } catch (error) {
      clearTimeout(timeout);
      const entry: RetriableAttempt = {
        attempt,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      };
      attempts.push(entry);
      if (attempt < params.maxAttempts) {
        await params.onAttemptFailure?.(entry);
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw new Error(
        `Request failed after ${attempt} attempts.\n` +
          attempts
            .map((item) => `${item.attempt}:${item.status ?? item.error ?? "unknown"}`)
            .join(", "),
      );
    }
  }

  throw new Error("Retry loop exited unexpectedly.");
}

export type VisibleDelivery<T> = {
  dedupeKey: string;
  value: T;
};

export function coalesceVisibleDeliveries<T>(deliveries: VisibleDelivery<T>[]): {
  visible: T[];
  duplicateKeys: string[];
} {
  const seen = new Set<string>();
  const duplicateKeys: string[] = [];
  const visible: T[] = [];

  for (const delivery of deliveries) {
    if (seen.has(delivery.dedupeKey)) {
      duplicateKeys.push(delivery.dedupeKey);
      continue;
    }
    seen.add(delivery.dedupeKey);
    visible.push(delivery.value);
  }

  return { visible, duplicateKeys };
}
