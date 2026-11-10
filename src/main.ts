import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import source from "../data/resets.json";
import sponsors from "../data/sponsors.json";
import "./style.css";
import { normalizeResets } from "./normalize";
import {
  REACTION_ROUTE,
  THANKS_KEY,
  parseReactionPayload,
  parseThankedIds,
  serializeThankedIds,
} from "./reactions";
import { renderApp, type ReactionView } from "./render";
import { normalizeSponsors } from "./sponsors";
import { compareOldest } from "./stats";
import type { Lang } from "./types";

inject();
injectSpeedInsights();

const LANG_KEY = "grok-resets-lang";
const BURST_MS = 320;

const rootNode = document.querySelector("#app");
if (!(rootNode instanceof HTMLElement)) {
  throw new Error("Missing #app");
}
const root: HTMLElement = rootNode;

const records = normalizeResets(source);
const sponsorRows: readonly unknown[] = sponsors;
const featuredSponsorIndex = (() => {
  const count = normalizeSponsors(sponsorRows, "en").length;
  return count === 0 ? 0 : Math.floor(Math.random() * count);
})();
let lang = initialLang();
let reactionEpoch = 0;
let reaction: ReactionView = {
  count: null,
  reacted: thanked(latestId()),
  burst: false,
};

function initialLang(): Lang {
  const param = new URLSearchParams(window.location.search).get("lang");
  if (param === "en" || param === "ko") return param;
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "ko") return stored;
  } catch {
    // Storage can throw in private mode; the browser language is the fallback.
  }
  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota and privacy errors; the current view still updates.
  }
}

function latestId(): string | null {
  return records.slice().sort(compareOldest).at(-1)?.id ?? null;
}

function thanked(id: string | null): boolean {
  if (!id) return false;
  return parseThankedIds(storageGet(THANKS_KEY)).has(id);
}

function draw(focus?: Lang | "react"): void {
  renderApp(root, {
    lang,
    records,
    now: new Date(),
    sponsors: sponsorRows,
    featuredSponsorIndex,
    reaction,
  });
  if (focus === "react") {
    const button = root.querySelector("[data-react]");
    if (button instanceof HTMLButtonElement) button.focus();
    return;
  }
  if (focus !== "en" && focus !== "ko") return;
  const button = root.querySelector(`[data-lang="${focus}"]`);
  if (button instanceof HTMLButtonElement) button.focus();
}

function persist(next: Lang): void {
  storageSet(LANG_KEY, next);
}

async function readCount(id: string): Promise<{ available: boolean; count: number | null }> {
  const response = await fetch(`${REACTION_ROUTE}?id=${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
  });
  const body: unknown = await response.json();
  if (!response.ok) return { available: false, count: null };
  return parseReactionPayload(body);
}

async function refreshCount(id: string): Promise<void> {
  const ticket = reactionEpoch;
  try {
    const parsed = await readCount(id);
    if (ticket !== reactionEpoch) return;
    reaction = { ...reaction, count: parsed.available ? parsed.count : null };
  } catch {
    if (ticket !== reactionEpoch) return;
    reaction = { ...reaction, count: null };
  }
  draw();
}

async function thank(id: string): Promise<void> {
  if (reaction.reacted || id !== latestId()) return;
  const previous = reaction.count;
  reactionEpoch += 1;
  reaction = {
    count: previous === null ? null : previous + 1,
    reacted: true,
    burst: true,
  };
  draw("react");
  const started = Date.now();
  let next: { available: boolean; count: number | null } = { available: false, count: null };
  try {
    const response = await fetch(REACTION_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id }),
    });
    const body: unknown = await response.json();
    next = parseReactionPayload(body);
  } catch {
    next = { available: false, count: null };
  }
  const wait = BURST_MS - (Date.now() - started);
  if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
  if (next.available) storageSet(THANKS_KEY, serializeThankedIds(parseThankedIds(storageGet(THANKS_KEY)), id));
  reaction = {
    count: next.available ? next.count : null,
    reacted: next.available,
    burst: false,
  };
  draw("react");
}

root.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const thanksButton = target.closest("[data-react]");
  if (thanksButton instanceof HTMLButtonElement) {
    const id = thanksButton.dataset.react;
    if (id) void thank(id);
    return;
  }
  const button = target.closest("[data-lang]");
  if (!(button instanceof HTMLButtonElement)) return;
  const next = button.dataset.lang;
  if ((next !== "en" && next !== "ko") || next === lang) return;
  lang = next;
  persist(lang);
  const url = new URL(window.location.href);
  if (url.searchParams.has("lang")) {
    url.searchParams.delete("lang");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  draw(lang);
});

draw();
const initialId = latestId();
if (initialId) void refreshCount(initialId);
window.setInterval(draw, 60_000);
