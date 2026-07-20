export type MetricsCacheState = "HIT" | "MISS" | "STALE";

export interface MetricsCacheEntry {
  body: string;
  etag: string;
  storedAt: number;
  freshUntil: number;
  staleUntil: number;
}

export class MetricsCache {
  private readonly entries = new Map<string, MetricsCacheEntry>();

  constructor(
    private readonly freshMs: number,
    private readonly staleMs: number,
  ) {
    if (freshMs < 1_000 || staleMs < freshMs) throw new Error("Metrics cache durations are invalid.");
  }

  getFresh(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    return entry && entry.freshUntil > now ? entry : null;
  }

  getStale(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    return entry && entry.staleUntil > now ? entry : null;
  }

  set(key: string, body: string, etag: string, now = Date.now()) {
    const entry: MetricsCacheEntry = {
      body,
      etag,
      storedAt: now,
      freshUntil: now + this.freshMs,
      staleUntil: now + this.staleMs,
    };
    this.entries.set(key, entry);
    return entry;
  }
}
