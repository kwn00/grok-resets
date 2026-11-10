import { describe, expect, it } from "vitest";
import { formatDays, formatLocal, formatRelative, formatUtc } from "../src/format";

describe("time formatting", () => {
  const announced = new Date("2026-11-09T19:17:20Z");
  const now = new Date("2026-11-10T00:51:00Z");

  it("formats an exact UTC clock", () => {
    expect(formatUtc(announced)).toBe("2026-11-09 19:17:20 UTC");
  });

  it("formats the same instant in the visitor timezone", () => {
    expect(formatLocal(announced, "Asia/Seoul")).toBe("2026-11-10 04:17:20 UTC+09:00");
    expect(formatLocal(announced, "UTC")).toBe("2026-11-09 19:17:20 UTC+00:00");
  });

  it("describes elapsed time in English and Korean", () => {
    expect(formatRelative(announced, now, "en")).toBe("5 hours ago");
    expect(formatRelative(announced, now, "ko")).toBe("5시간 전");
    expect(formatRelative(now, new Date(now.getTime() + 20_000), "en")).toBe("Just now");
    expect(formatRelative(now, new Date(now.getTime() - 20_000), "ko")).toBe("방금");
  });

  it("prints an em dash when a duration cannot be computed", () => {
    expect(formatDays(null, "en")).toBe("—");
    expect(formatDays(null, "ko")).toBe("—");
    expect(formatDays(1.5, "en")).toBe("1.5d");
    expect(formatDays(1.5, "ko")).toBe("1.5일");
  });
});
