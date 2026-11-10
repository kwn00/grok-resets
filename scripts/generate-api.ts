import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApiDocuments } from "../src/api";
import { normalizeResets } from "../src/normalize";

export function writeApi(root = resolve(dirname(fileURLToPath(import.meta.url)), "..")): void {
  const raw: unknown = JSON.parse(readFileSync(resolve(root, "data/resets.json"), "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error("data/resets.json must be a JSON array of reset entries");
  }
  const docs = buildApiDocuments(normalizeResets(raw), new Date());
  const directory = resolve(root, "public/api/v1");
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "resets.json"), `${JSON.stringify(docs.resets, null, 2)}\n`);
  writeFileSync(resolve(directory, "status.json"), `${JSON.stringify(docs.status, null, 2)}\n`);
}
