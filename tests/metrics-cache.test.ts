import assert from "node:assert/strict";
import test from "node:test";
import { MetricsCache } from "../src/lib/api/metrics-cache.ts";

test("metrics cache separates fresh, stale, and expired windows", () => {
  const cache = new MetricsCache(1_000, 5_000);
  const stored = cache.set("llms", '[{"id":"model"}]', '"etag"', 10_000);
  assert.equal(stored.freshUntil, 11_000);
  assert.equal(stored.staleUntil, 15_000);
  assert.equal(cache.getFresh("llms", 10_999)?.etag, '"etag"');
  assert.equal(cache.getFresh("llms", 11_000), null);
  assert.equal(cache.getStale("llms", 14_999)?.body, '[{"id":"model"}]');
  assert.equal(cache.getStale("llms", 15_000), null);
  assert.equal(cache.getStale("image", 10_000), null);
});

test("metrics cache replaces only the selected key", () => {
  const cache = new MetricsCache(1_000, 5_000);
  cache.set("llms", "first", '"one"', 0);
  cache.set("image", "second", '"two"', 0);
  cache.set("llms", "replacement", '"three"', 100);
  assert.equal(cache.getFresh("llms", 500)?.body, "replacement");
  assert.equal(cache.getFresh("image", 500)?.body, "second");
});
