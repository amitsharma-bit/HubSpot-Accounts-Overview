/** Tiny SVG sparkline path helper — shared by KPI cards and the accounts trend panel. */
export function sparkPaths(values: number[], w = 220, h = 46): { line: string; area: string } {
  if (values.length < 2) return { line: "", area: "" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 12);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return { line, area };
}

export type Delta = { pct: number; days: number };

/**
 * Percent change vs. the closest available history point at least `days` old
 * — labeled with the ACTUAL day gap found, never "vs last N days" when fewer
 * than N days of history exist yet. Returns null (render "Not enough history
 * yet") when there's no distinct earlier point to compare against.
 */
export function deltaOver<T extends { date: string }>(history: T[], key: keyof T, days: number): Delta | null {
  if (history.length < 2) return null;
  const latest = history[history.length - 1];
  const targetTime = new Date(latest.date).getTime() - days * 86_400_000;
  let best = history[0];
  for (const p of history) {
    if (new Date(p.date).getTime() <= targetTime) best = p;
  }
  if (best === latest) return null;
  const from = Number(best[key]);
  const to = Number(latest[key]);
  if (!from) return null;
  const daysActual = Math.round((new Date(latest.date).getTime() - new Date(best.date).getTime()) / 86_400_000);
  if (daysActual < 1) return null;
  return { pct: ((to - from) / from) * 100, days: daysActual };
}
