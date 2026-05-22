export const RANGE_KEYS = ["7d", "30d", "90d", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export type Range = {
  key: RangeKey;
  from: Date;
  to: Date;
};

const PRESET_DAYS: Record<Exclude<RangeKey, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isRangeKey(value: string | null): value is RangeKey {
  return value !== null && (RANGE_KEYS as readonly string[]).includes(value);
}

function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Parse the cockpit dashboard's range search params.
 * Falls back to a 7-day window when the requested range is invalid.
 */
export function parseRange(params: URLSearchParams, now: Date = new Date()): Range {
  const raw = params.get("range");
  const key: RangeKey = isRangeKey(raw) ? raw : "7d";

  if (key === "custom") {
    const from = parseIso(params.get("from"));
    const to = parseIso(params.get("to"));
    if (from && to && from < to) {
      return { key: "custom", from, to };
    }
    return parseRange(new URLSearchParams("range=7d"), now);
  }

  const days = PRESET_DAYS[key];
  const to = now;
  const from = new Date(to.getTime() - days * DAY_MS);
  return { key, from, to };
}

export type Bucket = { start: Date; end: Date };

/**
 * Split a range into evenly-spaced buckets.
 * 7d → 7 daily; 30d → 30 daily; 90d → 13 weekly;
 * custom ≤31 days → daily; longer custom → weekly.
 */
export function bucketize(range: Range): Bucket[] {
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS);
  const weekly = range.key === "90d" || (range.key === "custom" && spanDays > 31);

  if (weekly) {
    const bucketCount = Math.max(1, Math.ceil(spanDays / 7));
    const bucketSpan = (range.to.getTime() - range.from.getTime()) / bucketCount;
    return Array.from({ length: bucketCount }, (_, i) => ({
      start: new Date(range.from.getTime() + i * bucketSpan),
      end: new Date(range.from.getTime() + (i + 1) * bucketSpan),
    }));
  }

  return Array.from({ length: spanDays }, (_, i) => ({
    start: new Date(range.from.getTime() + i * DAY_MS),
    end: new Date(range.from.getTime() + (i + 1) * DAY_MS),
  }));
}

/** Returns the same-length window immediately preceding `range`. */
export function previousPeriod(range: Range): Range {
  const span = range.to.getTime() - range.from.getTime();
  return {
    key: range.key,
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime()),
  };
}
