import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApiDocuments } from "../src/api";
import { normalizeResets } from "../src/normalize";
import { computeStats } from "../src/stats";
import type { ResetRecord } from "../src/types";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function entry(id: string, at: string, text = "Limits restored.", type?: string): Record<string, unknown> {
  return {
    id,
    created_at_utc: at,
    url: `https://x.com/bot/status/${id}`,
    text,
    ...(type ? { type } : {}),
  };
}

function record(id: string, at: string): ResetRecord {
  return {
    id,
    createdAt: at,
    url: `https://x.com/bot/status/${id}`,
    text: "Limits restored.",
    type: "general",
  };
}

describe("computeStats", () => {
  it("withholds interval stats when nothing has been recorded", () => {
    expect(computeStats([], new Date("2026-11-10T00:00:00Z"))).toEqual({
      total: 0,
      averageIntervalDays: null,
      daysSinceLastReset: null,
      longestWaitDays: null,
      latest: null,
    });
  });

  it("withholds interval stats when only one reset exists", () => {
    const only = record("1", "2026-11-09T00:00:00Z");
    const stats = computeStats([only], new Date("2026-11-10T00:00:00Z"));
    expect(stats.total).toBe(1);
    expect(stats.averageIntervalDays).toBeNull();
    expect(stats.longestWaitDays).toBeNull();
    expect(stats.daysSinceLastReset).toBe(1);
    expect(stats.latest?.id).toBe("1");
  });

  it("averages consecutive gaps and reports the longest wait", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    const first = new Date(start).toISOString();
    const second = new Date(start + 27 * HOUR_MS).toISOString();
    const third = new Date(start + 27 * HOUR_MS + 2 * DAY_MS).toISOString();
    const stats = computeStats(
      [record("b", second), record("c", third), record("a", first)],
      new Date(start + 27 * HOUR_MS + 2 * DAY_MS + 12 * HOUR_MS),
    );

    expect(stats.total).toBe(3);
    expect(stats.averageIntervalDays).toBe(1.6);
    expect(stats.longestWaitDays).toBe(2);
    expect(stats.daysSinceLastReset).toBe(0.5);
    expect(stats.latest?.id).toBe("c");
  });

  it("treats a future announcement as zero days since", () => {
    const stats = computeStats(
      [record("1", "2026-11-12T00:00:00Z")],
      new Date("2026-11-10T00:00:00Z"),
    );
    expect(stats.daysSinceLastReset).toBe(0);
  });
});

describe("normalizeResets", () => {
  it("classifies the seeded weekly announcement and keeps its timestamp", () => {
    const source: unknown = JSON.parse(readFileSync(new URL("../data/resets.json", import.meta.url), "utf8"));
    const records = normalizeResets(source as unknown[]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "2119871982946971659",
      createdAt: "2026-11-09T19:17:20Z",
      url: "https://x.com/bot/status/2119871982946971659",
      text: "We've reset weekly limits for all Grok Bot users.\n\nEnjoy!",
      type: "weekly",
    });

    const stats = computeStats(records, new Date("2026-11-10T00:51:00Z"));
    expect(stats.total).toBe(1);
    expect(stats.averageIntervalDays).toBeNull();
    expect(stats.longestWaitDays).toBeNull();
    expect(stats.daysSinceLastReset).toBe(0.2);
  });

  it("lets an explicit type override the text classifier and drops bad rows", () => {
    const records = normalizeResets([
      entry("ok", "2026-04-01T00:00:00Z", "We've reset weekly limits.", "general"),
      entry("bad-date", "yesterday"),
      entry("bad-url", "2026-04-02T00:00:00Z"),
      { id: "nope" },
      entry("plain", "2026-04-03T00:00:00Z", "Limits are open again."),
    ].map((row) => (row.id === "bad-url" ? { ...row, url: "notaurl" } : row)));

    expect(records.map((row) => [row.id, row.type])).toEqual([
      ["ok", "general"],
      ["plain", "general"],
    ]);
  });
});

describe("buildApiDocuments", () => {
  it("publishes newest-first resets and null intervals for a single entry", () => {
    const records = normalizeResets([
      entry("older", "2026-01-01T00:00:00Z", "Limits are open again."),
      entry("newer", "2026-02-01T00:00:00Z", "We've reset weekly limits."),
    ]);
    const now = new Date("2026-02-02T00:00:00Z");
    const docs = buildApiDocuments(records, now);

    expect(docs.resets).toEqual({
      version: 1,
      generated_at: now.toISOString(),
      resets: [
        {
          id: "newer",
          created_at: "2026-02-01T00:00:00Z",
          url: "https://x.com/bot/status/newer",
          text: "We've reset weekly limits.",
          type: "weekly",
        },
        {
          id: "older",
          created_at: "2026-01-01T00:00:00Z",
          url: "https://x.com/bot/status/older",
          text: "Limits are open again.",
          type: "general",
        },
      ],
    });
    expect(docs.status.total_resets).toBe(2);
    expect(docs.status.average_interval_days).toBe(31);
    expect(docs.status.longest_wait_days).toBe(31);
    expect(docs.status.days_since_last_reset).toBe(1);
    expect(docs.status.latest?.id).toBe("newer");
    expect(docs.status.account).toBe("@bot");
    expect(docs.status.plans).toEqual(["Grok Bot", "Grok Build", "Cursor"]);
  });
});
