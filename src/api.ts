import { compareOldest, computeStats } from "./stats";
import type { ResetRecord, ResetType } from "./types";

export interface PublicReset {
  id: string;
  created_at: string;
  url: string;
  text: string;
  type: ResetType;
}

export interface ResetsDocument {
  version: 1;
  generated_at: string;
  resets: PublicReset[];
}

export interface StatusDocument {
  version: 1;
  generated_at: string;
  account: "@bot";
  plans: ["Grok Bot", "Grok Build", "Cursor"];
  coverage: string;
  total_resets: number;
  average_interval_days: number | null;
  days_since_last_reset: number | null;
  longest_wait_days: number | null;
  latest: PublicReset | null;
}

function toPublic(record: ResetRecord): PublicReset {
  return {
    id: record.id,
    created_at: record.createdAt,
    url: record.url,
    text: record.text,
    type: record.type,
  };
}

export function buildApiDocuments(
  records: readonly ResetRecord[],
  now: Date,
): { resets: ResetsDocument; status: StatusDocument } {
  const stats = computeStats(records, now);
  const generatedAt = now.toISOString();
  const newest = records.slice().sort((a, b) => compareOldest(b, a));
  return {
    resets: {
      version: 1,
      generated_at: generatedAt,
      resets: newest.map(toPublic),
    },
    status: {
      version: 1,
      generated_at: generatedAt,
      account: "@bot",
      plans: ["Grok Bot", "Grok Build", "Cursor"],
      coverage: "One reset refills the Grok Bot, Grok Build, and Cursor combined plan together.",
      total_resets: stats.total,
      average_interval_days: stats.averageIntervalDays,
      days_since_last_reset: stats.daysSinceLastReset,
      longest_wait_days: stats.longestWaitDays,
      latest: stats.latest ? toPublic(stats.latest) : null,
    },
  };
}
