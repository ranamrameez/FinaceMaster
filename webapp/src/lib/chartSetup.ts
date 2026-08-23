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
