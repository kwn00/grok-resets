import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const info: Record<string, unknown> = {
    step: "start",
    token: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  };
  try {
    info.step = "import-blob";
    const blob = await import("@vercel/blob");
    info.blob = typeof blob.head;
    info.step = "head";
    try {
      const meta = await blob.head("reactions/counts.json");
      info.head = typeof meta.url === "string";
    } catch (error) {
      info.headError = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
    }
    info.step = "done";
  } catch (error) {
    info.stepError = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(info));
}
