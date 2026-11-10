export interface HeatCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  state: "in" | "future";
}

export interface MonthLabel {
  column: number;
  date: string;
}

export interface HeatmapModel {
  weeks: number;
  columns: HeatCell[][];
  monthLabels: MonthLabel[];
}

const DAY_MS = 86_400_000;

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function heatLevel(count: number, max: number): HeatCell["level"] {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio >= 1) return 4;
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export function buildHeatmap(timestamps: readonly string[], end: Date, weeks = 26): HeatmapModel {
  const endDay = utcMidnight(end);
  const mondayIndex = (endDay.getUTCDay() + 6) % 7;
  const gridStart = addDays(endDay, -mondayIndex - (weeks - 1) * 7);
  const counts = new Map<string, number>();

  for (const stamp of timestamps) {
    const parsed = Date.parse(stamp);
    if (!Number.isFinite(parsed)) continue;
    const key = new Date(parsed).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let max = 0;
  const columns: HeatCell[][] = [];
  for (let column = 0; column < weeks; column += 1) {
    const cells: HeatCell[] = [];
    for (let row = 0; row < 7; row += 1) {
      const date = addDays(gridStart, column * 7 + row);
      const key = isoDate(date);
      const count = counts.get(key) ?? 0;
      if (count > max) max = count;
      cells.push({
        date: key,
        count,
        level: 0,
        state: date.getTime() > endDay.getTime() ? "future" : "in",
      });
    }
    columns.push(cells);
  }

  for (const column of columns) {
    for (const cell of column) {
      cell.level = heatLevel(cell.count, max);
    }
  }

  const monthLabels: MonthLabel[] = [];
  let previousMonth = "";
  for (let column = 0; column < columns.length; column += 1) {
    const cells = columns[column];
    const firstOfMonth = cells.find((cell) => cell.date.slice(8, 10) === "01");
    const marker = firstOfMonth ?? (column === 0 ? cells[0] : undefined);
    if (!marker) continue;
    const monthKey = marker.date.slice(0, 7);
    if (monthKey === previousMonth) continue;
    previousMonth = monthKey;
    monthLabels.push({ column, date: marker.date });
  }

  return { weeks, columns, monthLabels };
}
