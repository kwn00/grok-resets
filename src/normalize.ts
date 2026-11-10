import type { ResetRecord, ResetType } from "./types";

const WEEKLY_PATTERN = /weekly/i;
const ZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export function classifyReset(text: string, explicit: string | undefined): ResetType {
  if (explicit === "weekly" || explicit === "general") return explicit;
  if (WEEKLY_PATTERN.test(text)) return "weekly";
  return "general";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeResets(input: readonly unknown[]): ResetRecord[] {
  const records: ResetRecord[] = [];
  for (const value of input) {
    if (!isRecord(value)) continue;
    const id = value.id;
    const createdAt = value.created_at_utc;
    const url = value.url;
    const text = value.text;
    const explicit = value.type;
    if (typeof id !== "string" || id.trim() === "") continue;
    if (typeof createdAt !== "string" || !ZONE_PATTERN.test(createdAt.trim())) continue;
    if (!Number.isFinite(Date.parse(createdAt))) continue;
    if (typeof url !== "string" || !isHttpUrl(url.trim())) continue;
    if (typeof text !== "string" || text.trim() === "") continue;
    if (explicit !== undefined && typeof explicit !== "string") continue;
    records.push({
      id: id.trim(),
      createdAt: createdAt.trim(),
      url: url.trim(),
      text,
      type: classifyReset(text, explicit),
    });
  }
  return records;
}
