export type Lang = "en" | "ko";

export type ResetType = "weekly" | "general";

export interface SourceReset {
  id: string;
  created_at_utc: string;
  url: string;
  text: string;
  type?: string;
  kst?: string;
  notified?: boolean;
}

export interface ResetRecord {
  id: string;
  createdAt: string;
  url: string;
  text: string;
  type: ResetType;
}

export interface ResetStats {
  total: number;
  averageIntervalDays: number | null;
  daysSinceLastReset: number | null;
  longestWaitDays: number | null;
  latest: ResetRecord | null;
}
