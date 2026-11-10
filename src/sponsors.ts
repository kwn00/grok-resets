import { t } from "./i18n";
import type { Lang } from "./types";

export const AD_EMAIL = "kwaneung.kim@outlook.com";
export const AD_SUBJECT = "[Grok Resets] 광고 문의 / Advertising inquiry";

export interface Sponsor {
  name: string;
  url: string;
  tagline: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function advertiseMailto(lang: Lang): string {
  const body = t(lang).advertiseMailBody;
  return `mailto:${AD_EMAIL}?subject=${encodeURIComponent(AD_SUBJECT)}&body=${encodeURIComponent(body)}`;
}

export function normalizeSponsors(input: readonly unknown[], lang: Lang): Sponsor[] {
  const sponsors: Sponsor[] = [];
  for (const value of input) {
    if (!isRecord(value)) continue;
    const name = value.name;
    const url = value.url;
    const tagline = value.tagline;
    const taglineKo = value.tagline_ko;
    if (typeof name !== "string" || name.trim() === "") continue;
    if (typeof url !== "string" || !isHttpUrl(url.trim())) continue;
    if (typeof tagline !== "string" || tagline.trim() === "") continue;
    const localized =
      lang === "ko" && typeof taglineKo === "string" && taglineKo.trim() !== "" ? taglineKo.trim() : tagline.trim();
    sponsors.push({ name: name.trim(), url: url.trim(), tagline: localized });
  }
  return sponsors;
}

function inquiryCard(lang: Lang): string {
  const copy = t(lang);
  return `<a class="sponsor-slot" href="${escapeHtml(advertiseMailto(lang))}">
    <span class="sponsor-title">${escapeHtml(copy.advertiseTitle)}</span>
    <span class="sponsor-copy">${escapeHtml(copy.advertiseBody)}</span>
  </a>`;
}

function sponsorCard(sponsor: Sponsor, newTab: string): string {
  return `<a class="sponsor-card" href="${escapeHtml(sponsor.url)}" target="_blank" rel="noopener noreferrer">
    <span class="sponsor-title">${escapeHtml(sponsor.name)}</span>
    <span class="sponsor-copy">${escapeHtml(sponsor.tagline)}</span>
    <span class="sr-only"> (${escapeHtml(newTab)})</span>
  </a>`;
}

export function renderSponsorSection(input: readonly unknown[], lang: Lang): string {
  const copy = t(lang);
  const sponsors = normalizeSponsors(input, lang);
  const cards = sponsors.length === 0 ? inquiryCard(lang) : sponsors.map((sponsor) => sponsorCard(sponsor, copy.newTab)).join("");
  return `<section id="sponsor" aria-labelledby="sponsor-heading">
    <h2 id="sponsor-heading">${escapeHtml(copy.sponsorHeading)}</h2>
    <div class="sponsor-list">${cards}</div>
  </section>`;
}
