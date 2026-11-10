import type { ResetRecord, ResetStats } from "./types";

const DAY_MS = 86_400_000;

export function roundDays(days: number): number {
  return Math.round(days * 10) / 10;
}

export function compareOldest(a: ResetRecord, b: ResetRecord): number {
  const delta = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (delta !== 0) return delta;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function computeStats(records: readonly ResetRecord[], now: Date): ResetStats {
  const ordered = records
    .filter((record) => Number.isFinite(Date.parse(record.createdAt)))
    .slice()
    .sort(compareOldest);

  if (ordered.length === 0) {
    return {
      total: 0,
      averageIntervalDays: null,
      daysSinceLastReset: null,
      longestWaitDays: null,
      latest: null,
    };
  }

  let averageIntervalDays: number | null = null;
  let longestWaitDays: number | null = null;
  if (ordered.length >= 2) {
    const gaps: number[] = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = Date.parse(ordered[index - 1].createdAt);
      const current = Date.parse(ordered[index].createdAt);
      gaps.push((current - previous) / DAY_MS);
    }
    const totalGap = gaps.reduce((sum, gap) => sum + gap, 0);
    averageIntervalDays = roundDays(totalGap / gaps.length);
    longestWaitDays = roundDays(Math.max(...gaps));
  }

  const latest = ordered[ordered.length - 1];
  const elapsed = (now.getTime() - Date.parse(latest.createdAt)) / DAY_MS;
  return {
    total: ordered.length,
    averageIntervalDays,
    daysSinceLastReset: roundDays(Math.max(0, elapsed)),
    longestWaitDays,
    latest,
  };
}
