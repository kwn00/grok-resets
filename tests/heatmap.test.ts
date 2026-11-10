import { describe, expect, it } from "vitest";
import { buildHeatmap } from "../src/heatmap";

const DAY_MS = 86_400_000;

describe("buildHeatmap", () => {
  it("aligns 26 Monday-start weeks to the UTC day of end", () => {
    const end = new Date("2026-11-10T12:00:00Z");
    expect(Date.parse("2026-11-09T00:00:00Z") - Date.parse("2026-05-18T00:00:00Z")).toBe(25 * 7 * DAY_MS);
    expect(new Date("2026-05-18T00:00:00Z").getUTCDay()).toBe(1);

    const model = buildHeatmap([], end, 26);
    expect(model.columns).toHaveLength(26);
    expect(model.columns[0]).toHaveLength(7);
    expect(model.columns[0][0].date).toBe("2026-05-18");
    expect(model.columns[25][0].date).toBe("2026-11-09");
    expect(model.columns[25][1]).toMatchObject({ date: "2026-11-10", state: "in", count: 0 });
    expect(model.columns[25][2]).toMatchObject({ date: "2026-11-11", state: "future", count: 0 });
    expect(model.monthLabels[0]).toEqual({ column: 0, date: "2026-05-18" });
    expect(model.monthLabels.some((label) => label.date === "2026-11-01")).toBe(true);
  });

  it("counts resets on their UTC day and scales brightness against the busiest day", () => {
    const end = new Date("2026-11-10T12:00:00Z");
    const model = buildHeatmap(
      [
        "2026-05-17T23:00:00Z",
        "2026-11-09T19:17:20Z",
        "2026-11-09T20:00:00Z",
        "2026-11-08T12:00:00Z",
        "not-a-timestamp",
      ],
      end,
      26,
    );

    const cells = model.columns.flat();
    expect(cells.find((cell) => cell.date === "2026-05-17")).toBeUndefined();
    expect(cells.find((cell) => cell.date === "2026-11-09")).toMatchObject({ count: 2, level: 4 });
    expect(cells.find((cell) => cell.date === "2026-11-08")).toMatchObject({ count: 1, level: 2 });
    expect(cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(3);
  });
});
