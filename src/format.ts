import { unreachable } from "./unreachable";
import type { Lang } from "./types";

const UNITS: { unit: Intl.RelativeTimeFormatUnit; size: number }[] = [
  { unit: "year", size: 31_536_000 },
  { unit: "month", size: 2_592_000 },
  { unit: "week", size: 604_800 },
  { unit: "day", size: 86_400 },
  { unit: "hour", size: 3_600 },
  { unit: "minute", size: 60 },
];

export function formatUtc(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

export function formatLocal(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const clock = [
    pick("year"),
    pick("month").padStart(2, "0"),
    pick("day").padStart(2, "0"),
  ].join("-");
  const time = [
    pick("hour").padStart(2, "0"),
    pick("minute").padStart(2, "0"),
    pick("second").padStart(2, "0"),
  ].join(":");
  const zone = pick("timeZoneName").replace(/^GMT/, "UTC");
  return zone ? `${clock} ${time} ${zone}` : `${clock} ${time}`;
}

export function formatRelative(target: Date, now: Date, lang: Lang): string {
  const deltaSec = Math.round((target.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 60) {
    switch (lang) {
      case "en":
        return "Just now";
      case "ko":
        return "방금";
      default:
        return unreachable(lang);
    }
  }

  const division = UNITS.find((item) => abs >= item.size) ?? UNITS[UNITS.length - 1];
  const value = deltaSec < 0 ? Math.ceil(deltaSec / division.size) : Math.floor(deltaSec / division.size);
  const locale = lang === "ko" ? "ko-KR" : "en";
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, division.unit);
}

export function formatDays(value: number | null, lang: Lang): string {
  if (value === null) return "—";
  const shown = value.toFixed(1);
  switch (lang) {
    case "en":
      return `${shown}d`;
    case "ko":
      return `${shown}일`;
    default:
      return unreachable(lang);
  }
}

export function formatMonth(isoDate: string, lang: Lang): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  switch (lang) {
    case "en":
      return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
    case "ko":
      return new Intl.DateTimeFormat("ko-KR", { month: "short", timeZone: "UTC" }).format(date);
    default:
      return unreachable(lang);
  }
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
