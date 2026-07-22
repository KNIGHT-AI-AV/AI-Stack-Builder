import { createHash, randomUUID } from "node:crypto";

const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;
const SENSITIVE_LOG_FIELD = /(authorization|body|content|cookie|key|prompt|secret|token)/i;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: HeadersInit;

  constructor(status: number, code: string, message: string, headers: HeadersInit = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export class ConfigurationError extends Error {
  constructor(variableName: string) {
    super(`Required runtime configuration is unavailable: ${variableName}`);
    this.name = "ConfigurationError";
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtSeconds: number;
  retryAfterSeconds: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private checks = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxEntries = 10_000,
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Rate limit must be a positive integer.");
    if (!Number.isInteger(windowMs) || windowMs < 1_000) throw new Error("Rate window must be at least one second.");
  }

  check(key: string, now = Date.now()): RateLimitResult {
    this.checks += 1;
    if (this.checks % 250 === 0) this.prune(now);

    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : existing;

    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.enforceBound();

    const allowed = bucket.count <= this.limit;
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAtSeconds: Math.ceil(bucket.resetAt / 1_000),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  private enforceBound() {
    while (this.buckets.size > this.maxEntries) {
      const oldestKey = this.buckets.keys().next().value;
      if (typeof oldestKey !== "string") break;
      this.buckets.delete(oldestKey);
    }
  }
}

export class ConcurrencyGate {
  private active = 0;

  constructor(private readonly maximum: number) {
    if (!Number.isInteger(maximum) || maximum < 1) throw new Error("Concurrency maximum must be positive.");
  }

  tryAcquire(): (() => void) | null {
    if (this.active >= this.maximum) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }
}

export function createRequestId() {
  return randomUUID();
}

export function getRequiredSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigurationError(name);
  return value;
}

export function getBoundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ConfigurationError(name);
  }
  return parsed;
}

export function getAllowedOrigins(request: Request) {
  const allowed = new Set<string>([new URL(request.url).origin]);
  const configured = process.env.AI_STACK_ALLOWED_ORIGINS ?? "";
  for (const candidate of configured.split(",")) {
    const value = candidate.trim();
    if (!value) continue;
    try {
      allowed.add(new URL(value).origin);
    } catch {
      throw new ConfigurationError("AI_STACK_ALLOWED_ORIGINS");
    }
  }
  return allowed;
}

export function assertAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (!origin) {
    if (fetchSite === "cross-site") throw new ApiError(403, "origin_denied", "Request origin is not allowed.");
    return;
  }

  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    throw new ApiError(403, "origin_denied", "Request origin is not allowed.");
  }
  if (!getAllowedOrigins(request).has(normalized)) {
    throw new ApiError(403, "origin_denied", "Request origin is not allowed.");
  }
}

export function corsResponseHeaders(request: Request) {
  assertAllowedOrigin(request);
  const headers = new Headers({ Vary: "Origin" });
  const origin = request.headers.get("origin");
  if (origin) headers.set("Access-Control-Allow-Origin", new URL(origin).origin);
  return headers;
}

export function corsPreflightResponse(request: Request, methods: readonly string[]) {
  let headers: Headers;
  try {
    headers = corsResponseHeaders(request);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return new Response(null, {
      status: error.status,
      headers: {
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
    });
  }
  headers.set("Access-Control-Allow-Methods", methods.join(", "));
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}

export function getClientRateLimitKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const agent = request.headers.get("user-agent")?.slice(0, 256) ?? "unknown-agent";
  const identity = (forwarded || direct || "unknown-client").slice(0, 128);
  return createHash("sha256").update(`${identity}\n${agent}`).digest("hex").slice(0, 32);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.resetAtSeconds),
  };
}

export function assertRateLimit(result: RateLimitResult) {
  if (result.allowed) return;
  throw new ApiError(429, "rate_limited", "Too many requests. Try again shortly.", {
    ...rateLimitHeaders(result),
    "Retry-After": String(result.retryAfterSeconds),
  });
}

export async function readJsonObject(request: Request, maximumBytes: number): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isInteger(declaredBytes) || declaredBytes < 0) {
      throw new ApiError(400, "invalid_content_length", "Content-Length is invalid.");
    }
    if (declaredBytes > maximumBytes) {
      throw new ApiError(413, "payload_too_large", "Request payload is too large.");
    }
  }

  if (!request.body) throw new ApiError(400, "invalid_json", "A JSON object is required.");
  const bytes = await readBoundedBytes(
    request.body,
    maximumBytes,
    () => new ApiError(413, "payload_too_large", "Request payload is too large."),
  );
  const text = decodeUtf8(bytes, new ApiError(400, "invalid_json", "Request body is not valid UTF-8 JSON."));
  if (!text.trim()) throw new ApiError(400, "invalid_json", "A JSON object is required.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  if (!isPlainObject(parsed)) throw new ApiError(400, "invalid_payload", "Request body must be a JSON object.");
  return parsed;
}

export function assertExactKeys(value: Record<string, unknown>, allowedKeys: readonly string[], label: string) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ApiError(400, "invalid_payload", `${label} contains unsupported fields.`);
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
  callerSignal?: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  timeout.unref?.();

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    return await fetchImplementation(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiError(504, "upstream_timeout", "The provider did not respond in time.");
    if (callerSignal?.aborted) throw new ApiError(408, "request_cancelled", "The request was cancelled.");
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    await response.body?.cancel();
    throw new ApiError(502, "upstream_payload_too_large", "The provider response exceeded the allowed size.");
  }

  if (!response.body) throw new ApiError(502, "invalid_upstream_response", "The provider returned an empty response.");
  const bytes = await readBoundedBytes(
    response.body,
    maximumBytes,
    () => new ApiError(502, "upstream_payload_too_large", "The provider response exceeded the allowed size."),
  );
  const text = decodeUtf8(bytes, new ApiError(502, "invalid_upstream_response", "The provider returned invalid text encoding."));

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, "invalid_upstream_response", "The provider returned invalid JSON.");
  }
}

async function readBoundedBytes(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
  tooLarge: () => ApiError,
) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeUtf8(bytes: Uint8Array, error: ApiError) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw error;
  }
}

export function upstreamFailure(provider: string, status: number, retryAfterHeader: string | null = null) {
  const retryAfter = retryAfterHeader && /^\d{1,3}$/.test(retryAfterHeader)
    ? Math.min(120, Math.max(1, Number(retryAfterHeader)))
    : null;
  const headers: Record<string, string> = retryAfter ? { "Retry-After": String(retryAfter) } : {};
  if (status === 408 || status === 429 || status >= 500) {
    return new ApiError(503, "upstream_unavailable", `${provider} is temporarily unavailable.`, headers);
  }
  return new ApiError(502, "upstream_failure", `${provider} could not complete the request.`);
}

export function jsonApiResponse(
  payload: unknown,
  status: number,
  requestId: string,
  extraHeaders: HeadersInit = {},
) {
  const headers = new Headers(extraHeaders);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Request-Id", requestId);
  return Response.json(payload, { status, headers });
}

export function apiErrorResponse(
  error: unknown,
  requestId: string,
  route: string,
  startedAt: number,
  extraHeaders: HeadersInit = {},
) {
  const apiError = error instanceof ApiError
    ? error
    : error instanceof ConfigurationError
      ? new ApiError(503, "service_not_configured", "This service is temporarily unavailable.")
      : new ApiError(500, "internal_error", "The request could not be completed.");

  safeServerLog(apiError.status >= 500 ? "error" : "warn", "api_request_failed", {
    requestId,
    route,
    code: apiError.code,
    status: apiError.status,
    durationMs: Math.max(0, Date.now() - startedAt),
  });

  const headers = new Headers(apiError.headers);
  new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return jsonApiResponse(
    { error: { code: apiError.code, message: apiError.message }, requestId },
    apiError.status,
    requestId,
    headers,
  );
}

export function safeServerLog(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  const safeFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    safeFields[key] = SENSITIVE_LOG_FIELD.test(key) ? "[redacted]" : sanitizeLogValue(value);
  }
  const line = JSON.stringify({ severity: level.toUpperCase(), event, ...safeFields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function sanitizeLogValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.replace(/[\r\n\t]/g, " ").slice(0, 256);
  return "[omitted]";
}
