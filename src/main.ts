import source from "../data/resets.json";
import "./style.css";
import { normalizeResets } from "./normalize";
import { renderApp } from "./render";
import type { Lang } from "./types";

const LANG_KEY = "grok-resets-lang";

const rootNode = document.querySelector("#app");
if (!(rootNode instanceof HTMLElement)) {
  throw new Error("Missing #app");
}
const root: HTMLElement = rootNode;

const records = normalizeResets(source);
let lang = initialLang();

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

function persist(next: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // Ignore quota and privacy errors; the current view still switches.
  }
}

function draw(focusLang?: Lang): void {
  renderApp(root, { lang, records, now: new Date() });
  if (!focusLang) return;
  const button = root.querySelector(`[data-lang="${focusLang}"]`);
  if (button instanceof HTMLButtonElement) button.focus();
}

root.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
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
window.setInterval(draw, 60_000);
