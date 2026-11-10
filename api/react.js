// src/server/react-handler.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

// src/normalize.ts
var WEEKLY_PATTERN = /weekly/i;
var ZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;
function classifyReset(text, explicit) {
  if (explicit === "weekly" || explicit === "general") return explicit;
  if (WEEKLY_PATTERN.test(text)) return "weekly";
  return "general";
}
function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeResets(input) {
  const records = [];
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
    if (explicit !== void 0 && typeof explicit !== "string") continue;
    records.push({
      id: id.trim(),
      createdAt: createdAt.trim(),
      url: url.trim(),
      text,
      type: classifyReset(text, explicit)
    });
  }
  return records;
}

// src/count-parse.ts
function parseHashCounts(result) {
  const counts = {};
  const entries = [];
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
function parseCount(result) {
  const count = typeof result === "number" ? result : Number(result);
  if (!Number.isInteger(count) || count < 0) return null;
  return count;
}

// src/blob-store.ts
var COUNTS_PATH = "reactions/counts.json";
var BLOB_CACHE_CONTROL_MAX_AGE = 60;
function isMissingBlob(error) {
  if (!(error instanceof Error)) return false;
  if (error.name === "BlobNotFoundError") return true;
  return /requested blob does not exist/i.test(error.message);
}
async function readCounts(token, blob, fetchImpl) {
  let url;
  try {
    const meta = await blob.head(COUNTS_PATH, { token });
    url = meta.url;
  } catch (error) {
    if (isMissingBlob(error)) return {};
    throw error;
  }
  const readUrl = new URL(url);
  readUrl.searchParams.set("cache", "0");
  const response = await fetchImpl(readUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`blob read ${response.status}`);
  return parseHashCounts(await response.json());
}
function createBlobCountStore(token, blob, fetchImpl) {
  return {
    getAll() {
      return readCounts(token, blob, fetchImpl);
    },
    async increment(id) {
      let lastError;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const counts = await readCounts(token, blob, fetchImpl);
          const next = (counts[id] ?? 0) + 1;
          await blob.put(COUNTS_PATH, JSON.stringify({ ...counts, [id]: next }), {
            access: "private",
            token,
            allowOverwrite: true,
            addRandomSuffix: false,
            contentType: "application/json",
            cacheControlMaxAge: BLOB_CACHE_CONTROL_MAX_AGE
          });
          return next;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("blob write failed");
    }
  };
}

// src/reactions.ts
var REDIS_HASH_KEY = "grok-resets:thanks";
var UNAVAILABLE = { available: false, count: null };
function completePair(env, urlKey, tokenKey) {
  const url = env[urlKey];
  const token = env[tokenKey];
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}
function resolveRedisConfig(env) {
  return completePair(env, "KV_REST_API_URL", "KV_REST_API_TOKEN") ?? completePair(env, "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN");
}
async function command(config, args, fetchImpl) {
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error(`Redis status ${response.status}`);
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || !("result" in payload)) {
    throw new Error("Redis payload");
  }
  const record = payload;
  if (typeof record.error === "string" && record.error !== "") throw new Error(record.error);
  return record.result ?? null;
}
function createUpstashClient(config, fetchImpl) {
  const endpoint = { url: config.url.replace(/\/+$/, ""), token: config.token };
  return {
    async getAll() {
      return parseHashCounts(await command(endpoint, ["HGETALL", REDIS_HASH_KEY], fetchImpl));
    },
    async increment(id) {
      return parseCount(await command(endpoint, ["HINCRBY", REDIS_HASH_KEY, id, "1"], fetchImpl));
    }
  };
}
function reactionHeaders(allow) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  if (allow) headers.Allow = allow;
  return headers;
}
function resolveCountStore(env, deps) {
  const blobToken = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (blobToken) return createBlobCountStore(blobToken, deps.blob, deps.fetch);
  const redis = resolveRedisConfig(env);
  if (!redis) return null;
  return createUpstashClient(redis, deps.fetch);
}
async function handleReaction(input) {
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return { status: 405, body: { error: "method_not_allowed" }, allow: "GET, POST" };
  }
  const needsId = method === "POST" || method === "GET" && input.id !== null;
  if (needsId && (input.id === null || !input.knownIds.has(input.id))) {
    return { status: 400, body: { error: "unknown_reset" } };
  }
  if (!input.store) return { status: 200, body: { ...UNAVAILABLE } };
  try {
    if (method === "GET" && input.id === null) {
      return { status: 200, body: { available: true, counts: await input.store.getAll() } };
    }
    const id = input.id;
    if (id === null) return { status: 400, body: { error: "unknown_reset" } };
    if (method === "GET") {
      const counts = await input.store.getAll();
      return { status: 200, body: { available: true, count: counts[id] ?? 0 } };
    }
    const count = await input.store.increment(id);
    if (count === null) return { status: 503, body: { ...UNAVAILABLE } };
    return { status: 200, body: { available: true, count } };
  } catch {
    return { status: 503, body: { ...UNAVAILABLE } };
  }
}
function readReactionId(queryId, body) {
  if (queryId && queryId.trim() !== "") return queryId.trim();
  if (!body || typeof body !== "object" || !("id" in body)) return null;
  const id = body.id;
  if (typeof id !== "string" || id.trim() === "") return null;
  return id.trim();
}

// src/server/react-handler.ts
function send(res, status, body, allow) {
  res.writeHead(status, reactionHeaders(allow));
  res.end(JSON.stringify(body));
}
function loadResets() {
  const candidates = [join(process.cwd(), "data/resets.json"), join(process.cwd(), "../data/resets.json")];
  const failures = [];
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(candidate, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unreadable";
      failures.push(`${candidate}: ${message}`);
    }
  }
  throw new Error(failures.join(" | "));
}
async function readBody(req) {
  if (req.body !== void 0 && req.body !== "") {
    if (typeof req.body === "string") return JSON.parse(req.body);
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return null;
  return JSON.parse(text);
}
async function handler(req, res) {
  const method = req.method ?? "GET";
  try {
    let body = null;
    if (method.toUpperCase() === "POST") {
      try {
        body = await readBody(req);
      } catch {
        send(res, 400, { error: "invalid_json" });
        return;
      }
    }
    const source = loadResets();
    if (!Array.isArray(source)) throw new Error("data/resets.json must be an array");
    const knownIds = new Set(normalizeResets(source).map((record) => record.id));
    const blobModule = await import("@vercel/blob");
    const blob = { head: blobModule.head, put: blobModule.put };
    const url = new URL(req.url ?? "/", "http://localhost");
    const result = await handleReaction({
      method,
      id: readReactionId(url.searchParams.get("id"), body),
      knownIds,
      store: resolveCountStore(process.env, { fetch, blob })
    });
    send(res, result.status, result.body, result.allow);
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : "unknown";
    send(res, 503, { available: false, count: null, detail: detail.slice(0, 400) });
  }
}
export {
  handler as default
};
