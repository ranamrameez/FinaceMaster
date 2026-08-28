import type { ReactNode } from 'react';
import { CollapsibleCard } from '../../../components/Card';

/** Shared wrapper for every chart across every module's Dashboard/Analytics
 * page (QSE/PSX plus every non-exchange module's Analytics tab all import
 * this single component). Made collapsible (README item 42's "chart cards
 * on Analytics pages... worth a design look" remainder) by building on the
 * existing `CollapsibleCard` rather than a plain `Card` — a one-line change
 * here makes every chart in the app collapsible at once, the same
 * fix-once-at-the-shared-layer pattern already used for `MoneyValue`/
 * `StatCard`. Defaults open so no chart's default visibility changes;
 * users who want to hide a specific chart (e.g. one of QSE/PSX Analytics'
 * 18) can now collapse it individually instead of scrolling past it. */
/** `unfiltered` marks a chart that intentionally ignores the page's ticker/
 * month filter (a whole-portfolio total that wouldn't mean the same thing
 * scoped to a window — see ChartFilterBar's own note). User-reported
 * (item 1): "filters on Analysis page charts work on some and leave other
 * as it is causing confusion" — the earlier fix was a single explanatory
 * paragraph in the filter bar itself, easy to miss once scrolled past; a
 * small per-chart badge keeps the distinction visible at the point where
 * it's actually confusing. */
/** `flat` renders the chart WITHOUT its own `CollapsibleCard` chrome — just
 * a heading + the chart. User-reported (2026-08-28): "you are still using
 * nested cards (Analytics -> carded charts. who would collapse individual
 * chart when whole section is collapsible" — `Tabs` already wraps every
 * tab's content in its own `CollapsibleCard`, so an Analytics tab full of
 * regular (non-`flat`) `ChartCard`s was a card-inside-a-card, each with its
 * own redundant collapse control (design rule 1: never nest cards). Pass
 * `flat` for any `ChartCard` rendered inside a `Tabs` section; the plain
 * (non-flat) mode stays the default for the few places a chart genuinely
 * stands alone outside a `Tabs`-driven page (e.g. inside a loan/property's
 * own detail view). */
export function ChartCard({
  title,
  empty,
  unfiltered,
  flat,
  children,
}: {
  title: string;
  empty?: boolean;
  unfiltered?: boolean;
  flat?: boolean;
  children: ReactNode;
}) {
  const heading = (
    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
      {title}
      {unfiltered && <span className="footer-note" style={{ fontWeight: 400, textTransform: 'none' }}>(whole portfolio — not filtered)</span>}
    </h4>
  );
  const body = empty ? <p className="footer-note">Not enough data yet.</p> : <div className="chart-canvas-wrap">{children}</div>;

  if (flat) {
    return (
      <div style={{ marginBottom: 20 }}>
        {heading}
        <div style={{ marginTop: 10 }}>{body}</div>
      </div>
    );
  }

  return <CollapsibleCard title={heading}>{body}</CollapsibleCard>;
}
