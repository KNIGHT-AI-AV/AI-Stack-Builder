import { createHash } from "node:crypto";
import { MetricsCache, type MetricsCacheEntry, type MetricsCacheState } from "@/lib/api/metrics-cache";
import {
  ApiError,
  FixedWindowRateLimiter,
  apiErrorResponse,
  assertRateLimit,
  createRequestId,
  corsPreflightResponse,
  corsResponseHeaders,
  fetchWithTimeout,
  getBoundedInteger,
  getClientRateLimitKey,
  getRequiredSecret,
  isPlainObject,
  rateLimitHeaders,
  readBoundedJson,
  safeServerLog,
  upstreamFailure,
} from "@/lib/api/hardening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return corsPreflightResponse(request, ["GET", "OPTIONS"]);
}

type MetricsType = "llms" | "image";

const freshSeconds = getBoundedInteger("AI_STACK_METRICS_CACHE_SECONDS", 3_600, 60, 86_400);
const staleSeconds = getBoundedInteger("AI_STACK_METRICS_STALE_SECONDS", 21_600, freshSeconds, 172_800);
const cache = new MetricsCache(freshSeconds * 1_000, staleSeconds * 1_000);
const inFlight = new Map<MetricsType, Promise<MetricsCacheEntry>>();
const requestLimit = new FixedWindowRateLimiter(
  getBoundedInteger("AI_STACK_METRICS_RATE_LIMIT", 60, 1, 600),
  60_000,
);

const endpoints: Record<MetricsType, string> = {
  llms: "https://artificialanalysis.ai/api/v2/data/llms/models",
  image: "https://artificialanalysis.ai/api/v2/data/media/text-to-image",
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  let corsHeaders: HeadersInit = {};
  try {
    corsHeaders = corsResponseHeaders(request);
    const rate = requestLimit.check(getClientRateLimitKey(request));
    assertRateLimit(rate);
    const type = parseMetricsType(request.url);
    let state: MetricsCacheState = "HIT";
    let entry = cache.getFresh(type);

    if (!entry) {
      const stale = cache.getStale(type);
      try {
        state = "MISS";
        entry = await fetchMetrics(type, requestId, startedAt);
      } catch (error) {
        if (!stale) throw error;
        state = "STALE";
        entry = stale;
        safeServerLog("warn", "metrics_stale_fallback", {
          requestId,
          provider: "artificial-analysis",
          metricType: type,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    const headers = new Headers({
      ...rateLimitHeaders(rate),
      "Cache-Control": `public, s-maxage=${freshSeconds}, stale-while-revalidate=300, stale-if-error=${staleSeconds}`,
      "Content-Type": "application/json; charset=utf-8",
      ETag: entry.etag,
      Age: String(Math.max(0, Math.floor((Date.now() - entry.storedAt) / 1_000))),
      "X-Cache": state,
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
    });
    new Headers(corsHeaders).forEach((value, key) => headers.set(key, value));

    if (request.headers.get("if-none-match") === entry.etag) {
      return new Response(null, { status: 304, headers });
    }
    safeServerLog("info", "api_request_completed", {
      requestId,
      route: "/api/metrics",
      status: 200,
      metricType: type,
      cacheState: state,
      durationMs: Date.now() - startedAt,
    });
    return new Response(entry.body, { status: 200, headers });
  } catch (error) {
    return apiErrorResponse(error, requestId, "/api/metrics", startedAt, corsHeaders);
  }
}

function parseMetricsType(url: string): MetricsType {
  const searchParams = new URL(url).searchParams;
  for (const key of searchParams.keys()) {
    if (key !== "type") throw new ApiError(400, "invalid_query", "Unsupported query parameter.");
  }
  const values = searchParams.getAll("type");
  if (values.length > 1) throw new ApiError(400, "invalid_query", "Type may be supplied only once.");
  const type = values[0] || "llms";
  if (type !== "llms" && type !== "image") {
    throw new ApiError(400, "invalid_metrics_type", "Type must be llms or image.");
  }
  return type;
}

function fetchMetrics(type: MetricsType, requestId: string, startedAt: number) {
  const existing = inFlight.get(type);
  if (existing) return existing;

  const operation = fetchAndCacheMetrics(type, requestId, startedAt).finally(() => {
    inFlight.delete(type);
  });
  inFlight.set(type, operation);
  return operation;
}

async function fetchAndCacheMetrics(type: MetricsType, requestId: string, startedAt: number) {
  const apiKey = getRequiredSecret("ARTIFICIAL_ANALYSIS_API_KEY");
  const timeoutMs = getBoundedInteger("AI_STACK_METRICS_TIMEOUT_MS", 12_000, 2_000, 30_000);
  const upstream = await fetchWithTimeout(
    endpoints[type],
    {
      cache: "no-store",
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    },
    timeoutMs,
  );

  if (!upstream.ok) {
    safeServerLog("warn", "provider_request_failed", {
      requestId,
      provider: "artificial-analysis",
      upstreamStatus: upstream.status,
      metricType: type,
      durationMs: Date.now() - startedAt,
    });
    await upstream.body?.cancel();
    throw upstreamFailure("The metrics provider", upstream.status, upstream.headers.get("retry-after"));
  }

  const payload = await readBoundedJson(upstream, 8_388_608);
  if (!Array.isArray(payload) && !isPlainObject(payload)) {
    throw new ApiError(502, "invalid_upstream_response", "The metrics provider returned invalid data.");
  }
  const body = JSON.stringify(payload);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
  return cache.set(type, body, etag);
}
