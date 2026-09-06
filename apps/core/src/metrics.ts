/**
 * Privacy-filtered metrics (phase 47): counts and timings by route pattern
 * and status, never by person, path parameter or query. Exposed to the
 * household on the Core page and in diagnostics; there is no exporter that
 * reaches out.
 */
export class Metrics {
  private readonly requests = new Map<string, { count: number; ms: number; max: number }>();
  private readonly counters = new Map<string, number>();
  readonly startedAt = Date.now();

  request(method: string, route: string, status: number, ms: number): void {
    const key = `${method} ${route} ${Math.floor(status / 100)}xx`;
    const cur = this.requests.get(key) ?? { count: 0, ms: 0, max: 0 };
    cur.count += 1;
    cur.ms += ms;
    cur.max = Math.max(cur.max, ms);
    this.requests.set(key, cur);
  }

  bump(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  snapshot(): { uptimeSeconds: number; requests: { key: string; count: number; avgMs: number; maxMs: number }[]; counters: Record<string, number> } {
    return {
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      requests: [...this.requests.entries()].map(([key, v]) => ({ key, count: v.count, avgMs: Math.round(v.ms / v.count), maxMs: Math.round(v.max) })).sort((a, b) => b.count - a.count),
      counters: Object.fromEntries(this.counters),
    };
  }
}
