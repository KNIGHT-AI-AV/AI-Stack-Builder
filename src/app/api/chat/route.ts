import ecosystemData from "@/data/ecosystem.json";
import { extractOpenRouterGraph, validateChatPayload } from "@/lib/api/chat-schema";
import {
  ApiError,
  ConcurrencyGate,
  FixedWindowRateLimiter,
  apiErrorResponse,
  assertAllowedOrigin,
  assertRateLimit,
  createRequestId,
  fetchWithTimeout,
  getBoundedInteger,
  getClientRateLimitKey,
  getRequiredSecret,
  jsonApiResponse,
  rateLimitHeaders,
  readBoundedJson,
  readJsonObject,
  safeServerLog,
  upstreamFailure,
} from "@/lib/api/hardening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestLimit = new FixedWindowRateLimiter(
  getBoundedInteger("AI_STACK_CHAT_RATE_LIMIT", 10, 1, 120),
  60_000,
);
const concurrency = new ConcurrencyGate(getBoundedInteger("AI_STACK_CHAT_CONCURRENCY", 4, 1, 10));
const ecosystem = JSON.stringify(ecosystemData);

const systemPrompt = `You are an expert AI software architect. Map the user's idea into a connected graph of the exact models, databases, and infrastructure tools required to build it.

Use this AI ecosystem catalog as the primary candidate set:
${ecosystem}

Return only one JSON object with exactly this shape:
{"nodes":[{"id":"node_1","type":"tool","data":{"label":"Tool","category":"Category","description":"Short description"}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"uses"}]}

Rules:
- Include 4 to 8 unique nodes and 1 to 16 edges.
- Every node type is "tool".
- Every edge references nodes in the response and may not point to itself.
- Keep labels, categories, descriptions, and edge labels concise.
- Do not include markdown, commentary, credentials, or fields outside the schema.`;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  try {
    assertAllowedOrigin(request);
    const rate = requestLimit.check(getClientRateLimitKey(request));
    assertRateLimit(rate);

    const release = concurrency.tryAcquire();
    if (!release) {
      throw new ApiError(503, "capacity_limited", "The architect is busy. Try again shortly.", { "Retry-After": "2" });
    }

    try {
      const body = await readJsonObject(request, 8_192);
      const prompt = validateChatPayload(body);
      const apiKey = getRequiredSecret("OPENROUTER_API_KEY");
      const model = process.env.AI_STACK_OPENROUTER_MODEL?.trim() || "openai/gpt-4.1-mini";
      const timeoutMs = getBoundedInteger("AI_STACK_CHAT_TIMEOUT_MS", 25_000, 5_000, 45_000);

      const upstream = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.AI_STACK_PUBLIC_URL?.trim() || "https://knight-ai-stack-builder.web.app",
            "X-Title": "Knight AI+AV AI Stack Builder",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 1_600,
            response_format: { type: "json_object" },
          }),
        },
        timeoutMs,
        request.signal,
      );

      if (!upstream.ok) {
        safeServerLog("warn", "provider_request_failed", {
          requestId,
          provider: "openrouter",
          upstreamStatus: upstream.status,
          durationMs: Date.now() - startedAt,
        });
        await upstream.body?.cancel();
        throw upstreamFailure("The architecture provider", upstream.status, upstream.headers.get("retry-after"));
      }

      const providerPayload = await readBoundedJson(upstream, 262_144);
      const graph = extractOpenRouterGraph(providerPayload);
      safeServerLog("info", "api_request_completed", {
        requestId,
        route: "/api/chat",
        status: 200,
        durationMs: Date.now() - startedAt,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      });
      return jsonApiResponse(graph, 200, requestId, rateLimitHeaders(rate));
    } finally {
      release();
    }
  } catch (error) {
    return apiErrorResponse(error, requestId, "/api/chat", startedAt);
  }
}
