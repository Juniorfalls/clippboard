export type BackoffConfig = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 32_000;

function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function getHeaders(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as {
    headers?: unknown;
    response?: { headers?: unknown };
  };
  return candidate.headers ?? candidate.response?.headers;
}

export function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;

  if (typeof status === "number") return status;
  if (candidate.code === "rate_limit_exceeded") return 429;
  return undefined;
}

export function isRateLimitError(error: unknown): boolean {
  if (getErrorStatus(error) === 429) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|rate.?limit/i.test(message);
}

export function getRetryAfterMs(error: unknown): number | undefined {
  const headers = getHeaders(error);
  let raw: string | undefined;

  if (headers instanceof Headers) {
    raw = headers.get("retry-after") ?? undefined;
  } else if (headers && typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    raw =
      readHeader(record["retry-after"]) ??
      readHeader(record["Retry-After"]);
  }

  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }

  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
}

export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  config: BackoffConfig = {}
): Promise<T> {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const label = config.label ?? "AI provider";

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      const retryAfterMs = getRetryAfterMs(error);
      const exponentialDelay = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** attempt
      );
      const jitter = Math.floor(
        Math.random() * Math.max(1, exponentialDelay * 0.25)
      );
      const delayMs =
        retryAfterMs ??
        Math.min(maxDelayMs, exponentialDelay + jitter);
      const reason = retryAfterMs
        ? "Retry-After header"
        : `exponential backoff plus jitter`;

      console.warn(
        `[rate-limit] ${label} hit 429 on attempt ${attempt + 1}/${maxRetries + 1}. ` +
          `Retrying in ${Math.round(delayMs)}ms (${reason})...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
