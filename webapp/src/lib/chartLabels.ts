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
