import { describe, expect, it } from "vitest";
import {
  REACTION_ROUTE,
  STATIC_DATA_PREFIX,
  THANKS_KEY,
  createUpstashClient,
  handleReaction,
  parseHashCounts,
  parseReactionPayload,
  parseThankedIds,
  readReactionId,
  resolveRedisConfig,
  serializeThankedIds,
  type RedisClient,
} from "../src/reactions";

const KNOWN = new Set(["2119871982946971659"]);

function memoryRedis(seed: Record<string, number> = {}): RedisClient & { counts: Record<string, number> } {
  const counts = { ...seed };
  return {
    counts,
    async getAll() {
      return { ...counts };
    },
    async increment(id) {
      const next = (counts[id] ?? 0) + 1;
      counts[id] = next;
      return next;
    },
  };
}

describe("reaction routes", () => {
  it("keeps the live route away from the static JSON files", () => {
    expect(REACTION_ROUTE).toBe("/api/react");
    expect(REACTION_ROUTE.startsWith(STATIC_DATA_PREFIX)).toBe(false);
    expect(THANKS_KEY).toBe("grok-resets-thanks");
  });
});

describe("resolveRedisConfig", () => {
  it("returns null when neither pair is complete", () => {
    expect(resolveRedisConfig({})).toBeNull();
    expect(resolveRedisConfig({ KV_REST_API_URL: "https://kv.example" })).toBeNull();
    expect(resolveRedisConfig({ UPSTASH_REDIS_REST_TOKEN: "token" })).toBeNull();
  });

  it("prefers a complete Vercel KV pair and strips a trailing slash", () => {
    expect(
      resolveRedisConfig({
        KV_REST_API_URL: "https://kv.example/",
        KV_REST_API_TOKEN: "kv-token",
        UPSTASH_REDIS_REST_URL: "https://upstash.example",
        UPSTASH_REDIS_REST_TOKEN: "up-token",
      }),
    ).toEqual({ url: "https://kv.example", token: "kv-token" });
  });

  it("uses Upstash when the KV pair is incomplete", () => {
    expect(
      resolveRedisConfig({
        KV_REST_API_URL: "https://kv.example",
        UPSTASH_REDIS_REST_URL: "https://upstash.example/",
        UPSTASH_REDIS_REST_TOKEN: "up-token",
      }),
    ).toEqual({ url: "https://upstash.example", token: "up-token" });
  });
});

describe("handleReaction", () => {
  it("rejects unsupported methods and unknown reset ids", async () => {
    const redis = memoryRedis();
    expect((await handleReaction({ method: "PUT", id: null, knownIds: KNOWN, redis })).status).toBe(405);
    const unknown = await handleReaction({
      method: "POST",
      id: "not-a-reset",
      knownIds: KNOWN,
      redis,
    });
    expect(unknown).toMatchObject({ status: 400, body: { error: "unknown_reset" } });
    expect(redis.counts).toEqual({});
  });

  it("reports the count as unavailable when Redis is not configured", async () => {
    const result = await handleReaction({
      method: "GET",
      id: "2119871982946971659",
      knownIds: KNOWN,
      redis: null,
    });
    expect(result).toEqual({ status: 200, body: { available: false, count: null } });
  });

  it("reads and increments only a known reset", async () => {
    const redis = memoryRedis();
    const before = await handleReaction({
      method: "GET",
      id: "2119871982946971659",
      knownIds: KNOWN,
      redis,
    });
    expect(before.body).toEqual({ available: true, count: 0 });

    const after = await handleReaction({
      method: "POST",
      id: "2119871982946971659",
      knownIds: KNOWN,
      redis,
    });
    expect(after.body).toEqual({ available: true, count: 1 });
    expect(redis.counts["2119871982946971659"]).toBe(1);
  });

  it("returns every count when a GET has no id", async () => {
    const redis = memoryRedis({ "2119871982946971659": 4 });
    const result = await handleReaction({ method: "GET", id: null, knownIds: KNOWN, redis });
    expect(result.body).toEqual({ available: true, counts: { "2119871982946971659": 4 } });
  });

  it("degrades when Redis throws", async () => {
    const redis: RedisClient = {
      async getAll() {
        throw new Error("down");
      },
      async increment() {
        throw new Error("down");
      },
    };
    const result = await handleReaction({
      method: "POST",
      id: "2119871982946971659",
      knownIds: KNOWN,
      redis,
    });
    expect(result).toEqual({ status: 503, body: { available: false, count: null } });
  });
});

describe("Upstash responses", () => {
  it("parses hash entries and ignores junk", () => {
    expect(parseHashCounts(["2119871982946971659", "3", "other", "nope"])).toEqual({
      "2119871982946971659": 3,
    });
    expect(parseHashCounts(null)).toEqual({});
    expect(parseHashCounts({ "2119871982946971659": "2" })).toEqual({ "2119871982946971659": 2 });
  });

  it("sends HGETALL and HINCRBY to the REST endpoint", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      const command = JSON.parse(String(init?.body)) as string[];
      const result = command[0] === "HGETALL" ? ["2119871982946971659", "2"] : 3;
      return new Response(JSON.stringify({ result }), { status: 200 });
    };
    const client = createUpstashClient({ url: "https://redis.example/", token: "secret" }, fetchImpl);
    await expect(client.getAll()).resolves.toEqual({ "2119871982946971659": 2 });
    await expect(client.increment("2119871982946971659")).resolves.toBe(3);
    expect(calls[0]?.url).toBe("https://redis.example");
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual([
      "HINCRBY",
      "grok-resets:thanks",
      "2119871982946971659",
      "1",
    ]);
  });
});

describe("browser thanks memory", () => {
  it("reads a stored id list and ignores broken values", () => {
    expect([...parseThankedIds('["2119871982946971659"]')]).toEqual(["2119871982946971659"]);
    expect(parseThankedIds("[]").size).toBe(0);
    expect(parseThankedIds("{").size).toBe(0);
    expect(parseThankedIds(null).size).toBe(0);
  });

  it("stores each reset id once", () => {
    const once = serializeThankedIds(parseThankedIds(null), "2119871982946971659");
    const twice = serializeThankedIds(parseThankedIds(once), "2119871982946971659");
    expect(JSON.parse(twice)).toEqual(["2119871982946971659"]);
  });

  it("reads an id from the query or the JSON body", () => {
    expect(readReactionId(" 2119871982946971659 ", null)).toBe("2119871982946971659");
    expect(readReactionId(null, { id: "abc" })).toBe("abc");
    expect(readReactionId(null, { id: 12 })).toBeNull();
    expect(readReactionId("", {})).toBeNull();
  });

  it("accepts a count payload and rejects an unavailable one", () => {
    expect(parseReactionPayload({ available: true, count: 0 })).toEqual({ available: true, count: 0 });
    expect(parseReactionPayload({ count: 4 })).toEqual({ available: true, count: 4 });
    expect(parseReactionPayload({ available: false, count: null })).toEqual({ available: false, count: null });
    expect(parseReactionPayload({ available: true, count: "nope" })).toEqual({ available: false, count: null });
    expect(parseReactionPayload(null)).toEqual({ available: false, count: null });
  });
});
