import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { BlobSdk } from "../src/blob-store";
import { normalizeResets } from "../src/normalize";
import { handleReaction, reactionHeaders, readReactionId, resolveCountStore } from "../src/reactions";

type NodeRequest = IncomingMessage & { body?: unknown };

function send(res: ServerResponse, status: number, body: unknown, allow?: string): void {
  res.writeHead(status, reactionHeaders(allow));
  res.end(JSON.stringify(body));
}

function loadResets(): unknown {
  const candidates = [join(process.cwd(), "data/resets.json"), join(process.cwd(), "../data/resets.json")];
  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(candidate, "utf8")) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unreadable";
      failures.push(`${candidate}: ${message}`);
    }
  }
  throw new Error(failures.join(" | "));
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
  try {
    let body: unknown = null;
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
    const blob: BlobSdk = { head: blobModule.head, put: blobModule.put };
    const url = new URL(req.url ?? "/", "http://localhost");
    const result = await handleReaction({
      method,
      id: readReactionId(url.searchParams.get("id"), body),
      knownIds,
      store: resolveCountStore(process.env, { fetch, blob }),
    });
    send(res, result.status, result.body, result.allow);
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : "unknown";
    send(res, 503, { available: false, count: null, detail: detail.slice(0, 400) });
  }
}
