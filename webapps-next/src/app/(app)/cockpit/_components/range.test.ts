import { bucketize, parseRange, previousPeriod, RANGE_KEYS } from "./range";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("parseRange", () => {
  it("defaults to 7d when search param is absent", () => {
    const r = parseRange(new URLSearchParams(), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "7d");
    assert.equal(r.to.toISOString(), "2026-05-22T00:00:00.000Z");
    assert.equal(r.from.toISOString(), "2026-05-15T00:00:00.000Z");
  });

  it("accepts 30d preset", () => {
    const r = parseRange(new URLSearchParams("range=30d"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "30d");
    assert.equal(r.from.toISOString(), "2026-04-22T00:00:00.000Z");
  });

  it("accepts a valid custom range", () => {
    const r = parseRange(
      new URLSearchParams("range=custom&from=2026-05-01T00:00:00Z&to=2026-05-10T00:00:00Z"),
      new Date("2026-05-22T00:00:00Z"),
    );
    assert.equal(r.key, "custom");
    assert.equal(r.from.toISOString(), "2026-05-01T00:00:00.000Z");
    assert.equal(r.to.toISOString(), "2026-05-10T00:00:00.000Z");
  });

  it("falls back to 7d when custom is missing bounds", () => {
    const r = parseRange(new URLSearchParams("range=custom"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "7d");
  });

  it("rejects unknown keys", () => {
    const r = parseRange(new URLSearchParams("range=banana"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "7d");
  });

  it("exposes all preset keys", () => {
    assert.deepEqual([...RANGE_KEYS], ["7d", "30d", "90d", "custom"]);
  });
});

describe("bucketize", () => {
  it("produces 7 daily buckets for 7d", () => {
    const r = parseRange(new URLSearchParams("range=7d"), new Date("2026-05-22T00:00:00Z"));
    const buckets = bucketize(r);
    assert.equal(buckets.length, 7);
    assert.equal(buckets[0].start.toISOString(), "2026-05-15T00:00:00.000Z");
    assert.equal(buckets[6].end.toISOString(), "2026-05-22T00:00:00.000Z");
  });

  it("produces 30 daily buckets for 30d", () => {
    const r = parseRange(new URLSearchParams("range=30d"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(bucketize(r).length, 30);
  });

  it("produces ~13 weekly buckets for 90d", () => {
    const r = parseRange(new URLSearchParams("range=90d"), new Date("2026-05-22T00:00:00Z"));
    const buckets = bucketize(r);
    assert.equal(buckets.length, 13);
  });

  it("custom range ≤31 days is daily; otherwise weekly", () => {
    const daily = parseRange(
      new URLSearchParams("range=custom&from=2026-05-01T00:00:00Z&to=2026-05-10T00:00:00Z"),
      new Date("2026-05-22T00:00:00Z"),
    );
    assert.equal(bucketize(daily).length, 9);

    const weekly = parseRange(
      new URLSearchParams("range=custom&from=2026-01-01T00:00:00Z&to=2026-05-01T00:00:00Z"),
      new Date("2026-05-22T00:00:00Z"),
    );
    assert.ok(bucketize(weekly).length <= 18);
  });
});

describe("previousPeriod", () => {
  it("shifts the same span backwards in time", () => {
    const r = parseRange(new URLSearchParams("range=7d"), new Date("2026-05-22T00:00:00Z"));
    const prev = previousPeriod(r);
    assert.equal(prev.to.toISOString(), "2026-05-15T00:00:00.000Z");
    assert.equal(prev.from.toISOString(), "2026-05-08T00:00:00.000Z");
  });
});
