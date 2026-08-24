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
export function ChartCard({ title, empty, children }: { title: string; empty?: boolean; children: ReactNode }) {
  return (
    <CollapsibleCard title={<h4 style={{ margin: 0 }}>{title}</h4>}>
      {empty ? <p className="footer-note">Not enough data yet.</p> : children}
    </CollapsibleCard>
  );
}
