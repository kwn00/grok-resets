export const REACTION_ROUTE = "/api/react";
export const STATIC_DATA_PREFIX = "/api/v1/";
export const THANKS_KEY = "grok-resets-thanks";
export const REDIS_HASH_KEY = "grok-resets:thanks";

export interface RedisConfig {
  url: string;
  token: string;
}

export interface RedisClient {
  getAll(): Promise<Record<string, number>>;
  increment(id: string): Promise<number | null>;
}

export interface ReactionResult {
  status: number;
  body: Record<string, unknown>;
  allow?: string;
}

const UNAVAILABLE = { available: false, count: null };

function completePair(
  env: Record<string, string | undefined>,
  urlKey: string,
  tokenKey: string,
): RedisConfig | null {
  const url = env[urlKey];
  const token = env[tokenKey];
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function resolveRedisConfig(env: Record<string, string | undefined>): RedisConfig | null {
  return (
    completePair(env, "KV_REST_API_URL", "KV_REST_API_TOKEN") ??
    completePair(env, "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN")
  );
}

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

async function command(
  config: RedisConfig,
  args: string[],
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`Redis status ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("result" in payload)) {
    throw new Error("Redis payload");
  }
  const record = payload as { result?: unknown; error?: unknown };
  if (typeof record.error === "string" && record.error !== "") throw new Error(record.error);
  return record.result ?? null;
}

export function createUpstashClient(config: RedisConfig, fetchImpl: typeof fetch): RedisClient {
  const endpoint = { url: config.url.replace(/\/+$/, ""), token: config.token };
  return {
    async getAll() {
      return parseHashCounts(await command(endpoint, ["HGETALL", REDIS_HASH_KEY], fetchImpl));
    },
    async increment(id) {
      return parseCount(await command(endpoint, ["HINCRBY", REDIS_HASH_KEY, id, "1"], fetchImpl));
    },
  };
}

export async function handleReaction(input: {
  method: string;
  id: string | null;
  knownIds: ReadonlySet<string>;
  redis: RedisClient | null;
}): Promise<ReactionResult> {
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return { status: 405, body: { error: "method_not_allowed" }, allow: "GET, POST" };
  }
  const needsId = method === "POST" || (method === "GET" && input.id !== null);
  if (needsId && (input.id === null || !input.knownIds.has(input.id))) {
    return { status: 400, body: { error: "unknown_reset" } };
  }
  if (!input.redis) return { status: 200, body: { ...UNAVAILABLE } };
  try {
    if (method === "GET" && input.id === null) {
      return { status: 200, body: { available: true, counts: await input.redis.getAll() } };
    }
    const id = input.id;
    if (id === null) return { status: 400, body: { error: "unknown_reset" } };
    if (method === "GET") {
      const counts = await input.redis.getAll();
      return { status: 200, body: { available: true, count: counts[id] ?? 0 } };
    }
    const count = await input.redis.increment(id);
    if (count === null) return { status: 503, body: { ...UNAVAILABLE } };
    return { status: 200, body: { available: true, count } };
  } catch {
    return { status: 503, body: { ...UNAVAILABLE } };
  }
}

export function readReactionId(queryId: string | null, body: unknown): string | null {
  if (queryId && queryId.trim() !== "") return queryId.trim();
  if (!body || typeof body !== "object" || !("id" in body)) return null;
  const id = (body as { id?: unknown }).id;
  if (typeof id !== "string" || id.trim() === "") return null;
  return id.trim();
}

export function parseThankedIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim() !== ""));
  } catch {
    return new Set();
  }
}

export function serializeThankedIds(existing: ReadonlySet<string>, id: string): string {
  const next = new Set(existing);
  next.add(id);
  return JSON.stringify([...next]);
}

export function parseReactionPayload(body: unknown): { available: boolean; count: number | null } {
  if (!body || typeof body !== "object") return { available: false, count: null };
  const record = body as { available?: unknown; count?: unknown };
  if (record.available === false || record.count === null || record.count === undefined) {
    return { available: false, count: null };
  }
  const count = typeof record.count === "number" ? record.count : Number(record.count);
  if (!Number.isInteger(count) || count < 0) return { available: false, count: null };
  return { available: true, count };
}
