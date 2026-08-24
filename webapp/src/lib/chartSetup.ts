import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { cssVar } from './cssVar';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Legend, Tooltip, Filler, ChartDataLabels);
// Datalabels are opt-in per-chart (legacy behavior: off by default globally).
ChartJS.defaults.set('plugins.datalabels', { display: false });

// Per-point value labels (dlBarV/dlLine anchor:'end'/align:'top', dlBarH
// anchor:'end'/align:'right'|'left') sit just outside their bar/point —
// Chart.js's own auto-ranged scale has no idea an external plugin is about
// to draw text past the data's own max/min, so the tallest bar's (or
// rightmost horizontal bar's) label routinely got clipped by the canvas
// edge — a real user-reported "chart labels cutting off at the edges" bug,
// distinct from the datalabels-clutter fix (that one hides labels past a
// point-count threshold; this one is about the labels that DO render
// running out of room). `grace` pads a linear scale's auto-computed
// range by a percentage past the actual data extent, and `layout.padding`
// reserves canvas space around the whole plot area — between the two,
// value labels drawn just past a bar/point now have somewhere to go
// instead of being clipped. Set once globally (not per-chart) so every
// chart across every page benefits without each one repeating this.
ChartJS.defaults.layout.padding = { top: 20, right: 16, bottom: 4, left: 4 };
ChartJS.defaults.scales.linear.grace = '10%';

/** Chart.js's own text (legend labels, axis ticks, tooltip title/body) uses
 * `ChartJS.defaults.color`/`borderColor`, not a CSS var — it defaults to a
 * fixed medium gray regardless of theme. Call this from a chart-bearing
 * page's render (it's cheap) so legends/ticks stay legible in whichever
 * theme is active instead of a library default that may not contrast with
 * the current --panel. */
export function applyChartTheme() {
  ChartJS.defaults.color = cssVar('--text') || '#e8ecef';
  ChartJS.defaults.borderColor = cssVar('--border') || '#232b33';
}
