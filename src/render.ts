import { buildHeatmap } from "./heatmap";
import { formatDays, formatLocal, formatMonth, formatRelative, formatUtc, localTimeZone } from "./format";
import { t, typeLabel } from "./i18n";
import { compareOldest, computeStats } from "./stats";
import type { Lang, ResetRecord } from "./types";

export interface AppState {
  lang: Lang;
  records: readonly ResetRecord[];
  now: Date;
}

const BOT_URL = "https://x.com/bot";
const DOW_ROWS = [0, 2, 4] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function botIcon(): string {
  return `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
    <rect x="5.5" y="8" width="21" height="16.5" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <circle cx="12.2" cy="15.2" r="1.45" fill="currentColor"/>
    <circle cx="19.8" cy="15.2" r="1.45" fill="currentColor"/>
    <path d="M12 21.2h8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M16 8V4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <circle cx="16" cy="3.5" r="1.15" fill="currentColor"/>
  </svg>`;
}

function botLink(): string {
  return `<a href="${BOT_URL}">@bot</a>`;
}

function announcementLink(url: string, label: string, newTab: string): string {
  return `<a class="text-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span><span class="sr-only"> (${escapeHtml(newTab)})</span></a>`;
}

function heatmapMarkup(records: readonly ResetRecord[], now: Date, lang: Lang): string {
  const copy = t(lang);
  const model = buildHeatmap(
    records.map((record) => record.createdAt),
    now,
    26,
  );
  const months = model.monthLabels
    .map(
      (label) =>
        `<span class="month" style="grid-column:${label.column + 2};grid-row:1">${escapeHtml(formatMonth(label.date, lang))}</span>`,
    )
    .join("");
  const dow = DOW_ROWS.map(
    (row, index) =>
      `<span class="dow" style="grid-column:1;grid-row:${row + 2}">${escapeHtml(copy.dow[index])}</span>`,
  ).join("");
  const cells = model.columns
    .map((column, columnIndex) =>
      column
        .map((cell, row) => {
          const title = `${cell.date} · ${copy.resetCount(cell.count)}`;
          return `<span class="cell" data-level="${cell.level}" data-state="${cell.state}" style="grid-column:${columnIndex + 2};grid-row:${row + 2}" title="${escapeHtml(title)}"></span>`;
        })
        .join(""),
    )
    .join("");
  const filled = model.columns.flat().filter((cell) => cell.count > 0);
  const latestDate = filled.reduce<string | null>(
    (latest, cell) => (latest === null || cell.date > latest ? cell.date : latest),
    null,
  );
  const total = filled.reduce((sum, cell) => sum + cell.count, 0);
  const hiddenDays = filled
    .map((cell) => `<li>${escapeHtml(cell.date)} · ${escapeHtml(copy.resetCount(cell.count))}</li>`)
    .join("");
  const legend = [0, 1, 2, 3, 4]
    .map((level) => `<i class="cell" data-level="${level}"></i>`)
    .join("");

  return `<section id="record" aria-labelledby="record-heading">
    <h2 id="record-heading">${escapeHtml(copy.heatHeading)}</h2>
    <p class="note">${escapeHtml(copy.heatNote)}</p>
    <div class="heat-scroll">
      <div class="heat-grid" role="img" aria-label="${escapeHtml(copy.heatSummary(total, latestDate))}">
        ${months}${dow}${cells}
      </div>
    </div>
    ${hiddenDays ? `<ul class="sr-only">${hiddenDays}</ul>` : ""}
    <div class="legend"><span>${escapeHtml(copy.heatLess)}</span>${legend}<span>${escapeHtml(copy.heatMore)}</span></div>
  </section>`;
}

function latestMarkup(records: readonly ResetRecord[], now: Date, lang: Lang): string {
  const copy = t(lang);
  const latest = records.slice().sort(compareOldest).at(-1);
  if (!latest) {
    return `<section id="latest" aria-labelledby="latest-heading">
      <h2 id="latest-heading">${escapeHtml(copy.latestHeading)}</h2>
      <article class="latest"><p class="empty">${escapeHtml(copy.empty)}</p></article>
    </section>`;
  }

  const when = new Date(latest.createdAt);
  const zone = localTimeZone();
  return `<section id="latest" aria-labelledby="latest-heading">
    <h2 id="latest-heading">${escapeHtml(copy.latestHeading)}</h2>
    <article class="latest">
      <p class="badge">${escapeHtml(typeLabel(latest.type, lang))}</p>
      <p class="relative" data-live="relative">${escapeHtml(formatRelative(when, now, lang))}</p>
      <dl class="times">
        <div class="time-row">
          <dt>${escapeHtml(copy.utcLabel)}</dt>
          <dd><time datetime="${escapeHtml(latest.createdAt)}">${escapeHtml(formatUtc(when))}</time></dd>
        </div>
        <div class="time-row">
          <dt>${escapeHtml(copy.localLabel)}</dt>
          <dd>${escapeHtml(formatLocal(when, zone))}</dd>
        </div>
      </dl>
      ${announcementLink(latest.url, copy.viewAnnouncement, copy.newTab)}
    </article>
  </section>`;
}

function summaryMarkup(records: readonly ResetRecord[], now: Date, lang: Lang): string {
  const copy = t(lang);
  const stats = computeStats(records, now);
  const hint = stats.total < 2 ? `<p class="hint">${escapeHtml(copy.intervalHint)}</p>` : "";
  return `<section id="summary" aria-labelledby="summary-heading">
    <h2 id="summary-heading">${escapeHtml(copy.summaryHeading)}</h2>
    <dl class="stats">
      <div class="stat"><dt>${escapeHtml(copy.totalLabel)}</dt><dd>${stats.total}</dd></div>
      <div class="stat"><dt>${escapeHtml(copy.averageLabel)}</dt><dd>${escapeHtml(formatDays(stats.averageIntervalDays, lang))}</dd></div>
      <div class="stat"><dt>${escapeHtml(copy.sinceLabel)}</dt><dd data-live="since">${escapeHtml(formatDays(stats.daysSinceLastReset, lang))}</dd></div>
      <div class="stat"><dt>${escapeHtml(copy.longestLabel)}</dt><dd>${escapeHtml(formatDays(stats.longestWaitDays, lang))}</dd></div>
    </dl>
    ${hint}
  </section>`;
}

function feedMarkup(records: readonly ResetRecord[], lang: Lang): string {
  const copy = t(lang);
  const zone = localTimeZone();
  const items = records
    .slice()
    .sort((a, b) => compareOldest(b, a))
    .map((record) => {
      const when = new Date(record.createdAt);
      return `<li>
        <div class="feed-meta">
          <time datetime="${escapeHtml(record.createdAt)}">${escapeHtml(formatUtc(when))}</time>
          <span>${escapeHtml(formatLocal(when, zone))}</span>
          <span class="badge">${escapeHtml(typeLabel(record.type, lang))}</span>
        </div>
        <blockquote lang="en">${escapeHtml(record.text)}</blockquote>
        ${announcementLink(record.url, copy.viewAnnouncement, copy.newTab)}
      </li>`;
    })
    .join("");
  const body = items ? `<ol class="feed">${items}</ol>` : `<p class="empty">${escapeHtml(copy.empty)}</p>`;
  return `<section id="announcements" aria-labelledby="announcements-heading">
    <h2 id="announcements-heading">${escapeHtml(copy.announcementsHeading)}</h2>
    <p class="note">${escapeHtml(copy.announcementsNote)}</p>
    ${body}
  </section>`;
}

function page(state: AppState): string {
  const copy = t(state.lang);
  const pressed = (lang: Lang): string => (state.lang === lang ? "true" : "false");
  return `<a class="skip" href="#latest">${escapeHtml(copy.latestHeading)}</a>
  <header class="hero" id="top">
    <div class="top">
      <a class="brand" href="#top" aria-label="Grok Resets">${botIcon()}</a>
      <div class="langs" role="group" aria-label="${escapeHtml(copy.langGroup)}">
        <button type="button" data-lang="en" aria-pressed="${pressed("en")}">EN</button>
        <button type="button" data-lang="ko" aria-pressed="${pressed("ko")}">KO</button>
      </div>
    </div>
    <h1>Grok Resets</h1>
    <p class="subtitle">${escapeHtml(copy.subtitle)}</p>
    <p class="lede">${copy.ledeBefore}${botLink()}${copy.ledeAfter}</p>
  </header>
  <main>
    ${latestMarkup(state.records, state.now, state.lang)}
    ${summaryMarkup(state.records, state.now, state.lang)}
    ${heatmapMarkup(state.records, state.now, state.lang)}
    ${feedMarkup(state.records, state.lang)}
    <section id="data" aria-labelledby="data-heading">
      <h2 id="data-heading">${escapeHtml(copy.apiHeading)}</h2>
      <p class="note">${escapeHtml(copy.apiNote)}</p>
      <ul class="api-list">
        <li><a href="/api/v1/resets.json">${escapeHtml(copy.apiResets)}</a><code>/api/v1/resets.json</code></li>
        <li><a href="/api/v1/status.json">${escapeHtml(copy.apiStatus)}</a><code>/api/v1/status.json</code></li>
      </ul>
    </section>
  </main>
  <footer class="footer">
    <p>${copy.footerBefore}${botLink()}${copy.footerAfter}</p>
  </footer>`;
}

export function renderApp(root: HTMLElement, state: AppState): void {
  const scroller = root.querySelector(".heat-scroll");
  const hadScroller = scroller instanceof HTMLElement;
  const scrollLeft = hadScroller ? scroller.scrollLeft : 0;
  root.innerHTML = page(state);
  document.documentElement.lang = state.lang;
  const next = root.querySelector(".heat-scroll");
  if (!(next instanceof HTMLElement)) return;
  next.scrollLeft = hadScroller ? scrollLeft : next.scrollWidth;
}
