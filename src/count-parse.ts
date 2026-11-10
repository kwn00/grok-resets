export function parseHashCounts(result: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  const entries: [unknown, unknown][] = [];
  if (Array.isArray(result)) {
    for (let index = 0; index < result.length; index += 2) {
      entries.push([result[index], result[index + 1]]);
    }
  } else if (result && typeof result === "object") {
    entries.push(...Object.entries(result));
  }
  for (const [field, value] of entries) {
    if (typeof field !== "string" || field === "") continue;
    const count = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(count) || count < 0) continue;
    counts[field] = count;
  }
  return counts;
}

export function parseCount(result: unknown): number | null {
  const count = typeof result === "number" ? result : Number(result);
  if (!Number.isInteger(count) || count < 0) return null;
  return count;
}
