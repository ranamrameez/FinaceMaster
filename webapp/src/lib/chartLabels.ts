import { cssVar } from './cssVar';

// On-chart value labels via chartjs-plugin-datalabels. display:'auto' lets
// the plugin drop labels that would overlap *each other*, but with many
// bars/points crammed into one card-sized chart, each individual label can
// still render without literally overlapping its neighbor while the whole
// row reads as a wall of unreadable numbers sitting on top of (and hiding)
// the axis ticks underneath — a real cluttered-chart report, not something
// 'auto' catches on its own. Past this many points in a dataset, per-point
// labels stop being useful anyway (there's no room to read them) and the
// axis + tooltip-on-hover communicate the same values without the clutter.
const MAX_LABELED_POINTS = 10;

function autoDisplay(context: { dataset: { data: unknown[] } }): boolean | 'auto' {
  return context.dataset.data.length <= MAX_LABELED_POINTS ? 'auto' : false;
}

// clamp:true keeps a label that would land outside the plot area pinned
// just inside it instead of getting clipped. Ported from the legacy app's
// dl* helpers.
export function dlBase(formatter: (v: number) => string, extra: Record<string, unknown> = {}) {
  // Solid --panel-2 (not a translucent --panel + alpha suffix) — alpha
  // blending a light panel color at ~85% opacity over a dark bar/line
  // segment underneath can still composite to a muddy near-black box, which
  // read as "black boxes with invisible text" since the theme text color on
  // top of that muddy result has poor/no contrast. A solid, already-themed
  // "elevated surface" color has no such compositing risk.
  return {
    display: autoDisplay,
    clamp: true,
    color: cssVar('--text') || '#ECECEE',
    backgroundColor: cssVar('--panel-2') || cssVar('--panel') || '#12161b',
    borderRadius: 4,
    padding: { top: 2, bottom: 2, left: 5, right: 5 },
    font: { size: 10, weight: 700 },
    formatter,
    ...extra,
  };
}

export function dlBarV(formatter: (v: number) => string) {
  return dlBase(formatter, {
    anchor: 'end',
    offset: 4,
    align: (ctx: { dataset: { data: number[] }; dataIndex: number }) =>
      (Number(ctx.dataset.data[ctx.dataIndex]) || 0) >= 0 ? 'top' : 'bottom',
  });
}

export function dlBarH(formatter: (v: number) => string) {
  return dlBase(formatter, {
    anchor: 'end',
    offset: 6,
    align: (ctx: { dataset: { data: number[] }; dataIndex: number }) =>
      (Number(ctx.dataset.data[ctx.dataIndex]) || 0) >= 0 ? 'right' : 'left',
  });
}

export function dlLine(formatter: (v: number) => string) {
  return dlBase(formatter, { align: 'top', offset: 6 });
}

export function dlDoughnut(formatter: (v: number) => string) {
  return dlBase(formatter, {
    backgroundColor: 'transparent',
    color: '#fff',
    textStrokeColor: 'rgba(0,0,0,.55)',
    textStrokeWidth: 2,
    font: { size: 11, weight: 700 },
  });
}

export function dlStack(formatter: (v: number) => string) {
  return dlBase(formatter, {
    backgroundColor: 'transparent',
    color: '#fff',
    textStrokeColor: 'rgba(0,0,0,.45)',
    textStrokeWidth: 1.5,
  });
}

export function profitColor(v: number): string {
  return v >= 0 ? cssVar('--profit') || '#3ecf8e' : cssVar('--loss') || '#e5484d';
}

/** Pending item 17's hover-cross-highlighting: dims a hex/rgb color by
 * appending a low-alpha suffix rather than blending toward a background
 * color — a plain opacity drop looks correct on any chart background
 * (the page bg, a themed chart-card panel) without needing to know what's
 * underneath, unlike a background-mix approach. Only handles the 6/8-digit
 * hex colors this app's own chart palettes use (`INVEST_PALETTE`,
 * `profitColor`'s CSS-var hex output) — good enough for this call site,
 * not a general color-parsing utility. */
export function dimColor(hex: string, dim: boolean): string {
  if (!dim || !hex.startsWith('#')) return hex;
  const base = hex.length === 9 ? hex.slice(0, 7) : hex;
  return `${base}40`;
}

/** UI_DESIGN_GUIDELINES.md ("Charts, color, and readability" rule 2):
 * chart fills should be translucent so overlapping data stays legible -
 * an opaque bar/area can bury a line (or another series) sharing the same
 * canvas. Shared here (was a local copy inside NetWorthPage.tsx's own
 * combo chart) so any other multi-series chart reaches for the same
 * helper instead of re-deriving it. `B3` = ~70% opacity, same value the
 * original NetWorthPage.tsx copy used. */
export function withAlpha(hex: string, fallback: string): string {
  return `${(hex || fallback).slice(0, 7)}B3`;
}

/** Applies the same translucency as `withAlpha()` to EVERY bar/doughnut/
 * pie/polarArea dataset's fill color, app-wide, via a real Chart.js plugin
 * rather than a per-chart call. User-reported (2026-09-09), correcting an
 * earlier claim that this was already done: `withAlpha()` above had only
 * ever actually been wired into ONE chart (Net Worth's combo chart) despite
 * UI_DESIGN_GUIDELINES.md's "Charts, color, and readability" rule already
 * stating it as a general rule — every other bar/doughnut/pie chart in the
 * app still used fully opaque fills. Registered once in `chartSetup.ts` so
 * it applies uniformly and can't be forgotten on a future chart, instead of
 * touching the ~15 files that each set their own `backgroundColor`.
 *
 * Deliberately skips: any color already carrying an alpha channel (an
 * 8-digit `#RRGGBBAA` — including this plugin's OWN previous pass, or a
 * chart like the combo chart that already calls `withAlpha()` itself) or
 * any non-`#RRGGBB` string (`rgba(...)`, `'transparent'`, a CSS var that
 * didn't resolve to hex), so this can't double-apply or clobber a color a
 * chart is already managing on its own. Line/point strokes are deliberately
 * left alone — a translucent LINE reads as weaker, not "readable through,"
 * and the rule exists because a FILL can bury whatever's underneath it,
 * which doesn't apply to a thin stroke. */
const CHART_FILL_TYPES = new Set(['bar', 'doughnut', 'pie', 'polarArea']);

function addAlphaToColor(color: unknown): unknown {
  if (Array.isArray(color)) return color.map(addAlphaToColor);
  if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) return `${color}B3`;
  return color;
}

export const chartFillTransparencyPlugin = {
  id: 'chartFillTransparency',
  beforeUpdate(chart: { config: { type: string }; data: { datasets: { type?: string; backgroundColor?: unknown }[] } }) {
    for (const ds of chart.data.datasets) {
      const type = ds.type ?? chart.config.type;
      if (!CHART_FILL_TYPES.has(type)) continue;
      ds.backgroundColor = addAlphaToColor(ds.backgroundColor);
    }
  },
};
