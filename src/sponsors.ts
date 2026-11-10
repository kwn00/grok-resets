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

function inquiryCard(lang: Lang, showKicker: boolean): string {
  const copy = t(lang);
  const kicker = showKicker ? `<span class="sponsor-kicker">${escapeHtml(copy.sponsorHeading)}</span>` : "";
  return `<a class="panel sponsor-slot" href="${escapeHtml(advertiseMailto(lang))}">
    ${kicker}
    <span class="sponsor-title">${escapeHtml(copy.advertiseTitle)}</span>
    <span class="sponsor-copy">${escapeHtml(copy.advertiseBody)}</span>
  </a>`;
}

function sponsorCard(sponsor: Sponsor, newTab: string, kicker: string, showKicker: boolean): string {
  const label = showKicker ? `<span class="sponsor-kicker">${escapeHtml(kicker)}</span>` : "";
  return `<a class="panel sponsor-card" href="${escapeHtml(sponsor.url)}" target="_blank" rel="noopener noreferrer">
    ${label}
    <span class="sponsor-title">${escapeHtml(sponsor.name)}</span>
    <span class="sponsor-copy">${escapeHtml(sponsor.tagline)}</span>
    <span class="sr-only"> (${escapeHtml(newTab)})</span>
  </a>`;
}

export function splitSponsorRails<T>(items: readonly T[]): { left: T[]; right: T[] } {
  const left: T[] = [];
  const right: T[] = [];
  items.forEach((item, index) => {
    if (index % 2 === 0) left.push(item);
    else right.push(item);
  });
  return { left, right };
}

export function featuredSponsor(sponsors: readonly Sponsor[], index: number): Sponsor | null {
  if (sponsors.length === 0) return null;
  const wrapped = ((index % sponsors.length) + sponsors.length) % sponsors.length;
  return sponsors[wrapped] ?? null;
}

export function renderSponsorSection(input: readonly unknown[], lang: Lang, featuredIndex = 0): string {
  const copy = t(lang);
  const sponsors = normalizeSponsors(input, lang);
  const featured = featuredSponsor(sponsors, featuredIndex);
  const card = featured ? sponsorCard(featured, copy.newTab, copy.sponsorHeading, false) : inquiryCard(lang, false);
  const follow = featured ? `<div class="sponsor-follow">${inquiryCard(lang, false)}</div>` : "";
  return `<section id="sponsor" aria-labelledby="sponsor-heading">
    <h2 id="sponsor-heading">${escapeHtml(copy.sponsorHeading)}</h2>
    <div class="sponsor-list">${card}${follow}</div>
  </section>`;
}

export function renderSponsorRails(input: readonly unknown[], lang: Lang): { left: string; right: string } {
  const copy = t(lang);
  const sponsors = normalizeSponsors(input, lang);
  if (sponsors.length === 0) return { left: "", right: "" };
  const { left, right } = splitSponsorRails(sponsors);
  const leftHtml = left.map((sponsor) => sponsorCard(sponsor, copy.newTab, copy.sponsorHeading, true)).join("");
  const rightHtml = `${right.map((sponsor) => sponsorCard(sponsor, copy.newTab, copy.sponsorHeading, true)).join("")}${inquiryCard(lang, true)}`;
  return { left: leftHtml, right: rightHtml };
}
