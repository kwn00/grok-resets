import type { IncomingMessage, ServerResponse } from "node:http";
import source from "../data/resets.json";
import { normalizeResets } from "../src/normalize";
import { createUpstashClient, handleReaction, readReactionId, resolveRedisConfig } from "../src/reactions";

const knownIds = new Set(normalizeResets(source).map((record) => record.id));

type NodeRequest = IncomingMessage & { body?: unknown };

function send(res: ServerResponse, status: number, body: unknown, allow?: string): void {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (allow) headers.Allow = allow;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

async function readBody(req: NodeRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== "") {
    if (typeof req.body === "string") return JSON.parse(req.body) as unknown;
    return req.body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export default async function handler(req: NodeRequest, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  let body: unknown = null;
  if (method.toUpperCase() === "POST") {
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "invalid_json" });
      return;
    }
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const config = resolveRedisConfig(process.env);
  const result = await handleReaction({
    method,
    id: readReactionId(url.searchParams.get("id"), body),
    knownIds,
    redis: config ? createUpstashClient(config, fetch) : null,
  });
  send(res, result.status, result.body, result.allow);
}
