import { parseHashCounts, type CountStore } from "./reactions";

export const COUNTS_PATH = "reactions/counts.json";
/** Vercel Blob rejects a max-age below one minute. Reads bypass this with cache=0. */
export const BLOB_CACHE_CONTROL_MAX_AGE = 60;

export interface BlobHeadResult {
  url: string;
}

export interface BlobPutOptions {
  access: "private";
  token: string;
  allowOverwrite: true;
  addRandomSuffix: false;
  contentType: "application/json";
  cacheControlMaxAge: number;
}

export interface BlobSdk {
  head(pathname: string, options: { token: string }): Promise<BlobHeadResult>;
  put(pathname: string, body: string, options: BlobPutOptions): Promise<unknown>;
}

function isMissingBlob(error: unknown): boolean {
  return error instanceof Error && error.name === "BlobNotFoundError";
}

async function readCounts(token: string, blob: BlobSdk, fetchImpl: typeof fetch): Promise<Record<string, number>> {
  let url: string;
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
    cache: "no-store",
  });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`blob read ${response.status}`);
  return parseHashCounts(await response.json());
}

export function createBlobCountStore(token: string, blob: BlobSdk, fetchImpl: typeof fetch): CountStore {
  return {
    getAll() {
      return readCounts(token, blob, fetchImpl);
    },
    async increment(id) {
      let lastError: unknown;
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
            cacheControlMaxAge: BLOB_CACHE_CONTROL_MAX_AGE,
          });
          return next;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("blob write failed");
    },
  };
}
