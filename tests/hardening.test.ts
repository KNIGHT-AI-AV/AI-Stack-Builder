import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  ConcurrencyGate,
  FixedWindowRateLimiter,
  assertAllowedOrigin,
  corsPreflightResponse,
  fetchWithTimeout,
  readBoundedJson,
  readJsonObject,
  safeServerLog,
} from "../src/lib/api/hardening.ts";

test("fixed-window rate limiting has no off-by-one and resets", () => {
  const limiter = new FixedWindowRateLimiter(2, 1_000);
  assert.equal(limiter.check("client", 10_000).allowed, true);
  assert.equal(limiter.check("client", 10_100).allowed, true);
  const blocked = limiter.check("client", 10_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSeconds, 1);
  const reset = limiter.check("client", 11_000);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});

test("concurrency gate refuses excess work and releases exactly once", () => {
  const gate = new ConcurrencyGate(1);
  const release = gate.tryAcquire();
  assert.equal(typeof release, "function");
  assert.equal(gate.tryAcquire(), null);
  release?.();
  release?.();
  assert.equal(typeof gate.tryAcquire(), "function");
});

test("origin validation accepts same-origin and rejects cross-origin", () => {
  const request = new Request("https://knight-ai-stack-builder.web.app/api/chat", {
    headers: { origin: "https://knight-ai-stack-builder.web.app" },
  });
  assert.doesNotThrow(() => assertAllowedOrigin(request));

  const denied = new Request("https://knight-ai-stack-builder.web.app/api/chat", {
    headers: { origin: "https://attacker.invalid" },
  });
  assert.throws(() => assertAllowedOrigin(denied), (error) => {
    assert(error instanceof ApiError);
    assert.equal(error.status, 403);
    assert.equal(error.code, "origin_denied");
    return true;
  });
});

test("CORS preflight returns a bounded denial instead of an unhandled server error", () => {
  const allowed = corsPreflightResponse(new Request("https://knight-ai-stack-builder.web.app/api/chat", {
    method: "OPTIONS",
    headers: { origin: "https://knight-ai-stack-builder.web.app" },
  }), ["POST", "OPTIONS"]);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://knight-ai-stack-builder.web.app");

  const denied = corsPreflightResponse(new Request("https://api.example.test/api/chat", {
    method: "OPTIONS",
    headers: { origin: "https://attacker.invalid" },
  }), ["POST", "OPTIONS"]);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
  assert.equal(denied.headers.get("cache-control"), "no-store");
});

test("JSON body reader enforces media type, declared size, actual size, and object shape", async () => {
  await assert.rejects(
    readJsonObject(new Request("https://example.test", { method: "POST", body: "{}" }), 20),
    hasApiError(415, "unsupported_media_type"),
  );
  await assert.rejects(
    readJsonObject(new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "21" },
      body: "{}",
    }), 20),
    hasApiError(413, "payload_too_large"),
  );
  await assert.rejects(
    readJsonObject(new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "12345678901234567890" }),
    }), 20),
    hasApiError(413, "payload_too_large"),
  );
  await assert.rejects(
    readJsonObject(new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "[]",
    }), 20),
    hasApiError(400, "invalid_payload"),
  );
  await assert.rejects(
    readJsonObject(new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new Uint8Array([0xc3, 0x28]),
    }), 20),
    hasApiError(400, "invalid_json"),
  );
  assert.deepEqual(await readJsonObject(new Request("https://example.test", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: '{"ok":true}',
  }), 20), { ok: true });
});

test("upstream timeout aborts and returns a bounded public error", async () => {
  const neverCompletes: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")), { once: true });
  });
  const keepTestProcessAlive = setTimeout(() => undefined, 1_000);
  try {
    await assert.rejects(
      fetchWithTimeout("https://provider.invalid", {}, 10, undefined, neverCompletes),
      hasApiError(504, "upstream_timeout"),
    );
  } finally {
    clearTimeout(keepTestProcessAlive);
  }
});

test("bounded upstream JSON rejects oversized bodies", async () => {
  await assert.rejects(
    readBoundedJson(new Response(JSON.stringify({ value: "too large" })), 8),
    hasApiError(502, "upstream_payload_too_large"),
  );
  assert.deepEqual(await readBoundedJson(new Response('{"ok":true}'), 32), { ok: true });
});

test("structured logging redacts sensitive fields", () => {
  const lines: string[] = [];
  const originalWarn = console.warn;
  console.warn = (value?: unknown) => lines.push(String(value));
  try {
    safeServerLog("warn", "test_event", {
      requestId: "safe-request-id",
      prompt: "do not log me",
      accessToken: "do not log me either",
      detail: "one-line\nvalue",
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.prompt, "[redacted]");
  assert.equal(parsed.accessToken, "[redacted]");
  assert.equal(parsed.detail, "one-line value");
  assert(!lines[0].includes("do not log me"));
});

function hasApiError(status: number, code: string) {
  return (error: unknown) => {
    assert(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  };
}
