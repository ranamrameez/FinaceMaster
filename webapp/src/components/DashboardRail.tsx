import { Link } from 'react-router-dom';
import { CollapsibleCard, MoneyValue } from './Card';
import { UpcomingList } from './UpcomingList';
import { useNetWorthSummary } from '../features/netWorth/hooks/useNetWorthSummary';
import { useUpcomingItems } from '../hooks/useUpcomingItems';

/** A page's right-rail summary panel (README Pending item 54: wide
 * viewports had real unused space, and the earlier width bump — Done item
 * 145 — only let existing grids breathe wider, it didn't add any new
 * content). Two cross-module panels that tie the whole app together,
 * exactly the kind of thing a rail is for — content that doesn't belong to
 * any one page's own data but is useful to see alongside it:
 *
 * 1. **Net worth** — reuses `useNetWorthSummary()` (the same hook
 *    `NetWorthPage.tsx` itself now calls, extracted so this doesn't
 *    duplicate seven store subscriptions) to show the currency the user has
 *    the biggest exposure in, plus its per-module breakdown.
 * 2. **Upcoming** — 2026-09-07: replaced the original hand-rolled Cash/
 *    Banking-only "Upcoming plans" card (one-off plans only, no recurrence)
 *    with `useUpcomingItems()`/`collectUpcomingItems()` — the same shared
 *    aggregator behind the revamped `/planning` page, so this card gets
 *    recurring plans plus EMI/Rentals/Subscriptions occurrences for free
 *    instead of the narrower Cash/Bank-only view it used to hand-roll.
 *
 * Deliberately generic (not QSE/PSX-specific) so any page can drop this in
 * via the shared `.rail-split` CSS grid — starts on QSE's/PSX's Dashboard
 * (the highest-traffic pages) as a working vertical slice, same "ship one
 * page first, verified" pattern this project always follows before a
 * wider rollout.
 *
 * `preferredCurrency` (README Pending item 88's own "still open" note,
 * 2026-09-09): a Dashboard already has its own obvious currency — QSE's
 * QAR, PSX's PKR — that's more relevant to a viewer on THAT page than
 * whatever currency happens to have the biggest cross-module exposure.
 * Optional and falls back to `biggestExposureCurrency` when omitted (a
 * page with no natural single currency of its own) or when the preferred
 * currency has no Net Worth data at all yet. */
export function DashboardRail({ preferredCurrency }: { preferredCurrency?: string } = {}) {
  return (
    <div>
      <NetWorthRailCard preferredCurrency={preferredCurrency} />
      <UpcomingPlansRailCard />
    </div>
  );
}

function NetWorthRailCard({ preferredCurrency }: { preferredCurrency?: string }) {
  const { rows, biggestExposureCurrency } = useNetWorthSummary();
  const row = rows.find((r) => r.currency === preferredCurrency) ?? rows.find((r) => r.currency === biggestExposureCurrency);

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Net worth</h3>} style={{ marginBottom: 16 }}>
      {row ? (
        <>
          <div className="label" style={{ marginBottom: 4 }}>{row.currency}</div>
          <MoneyValue n={row.net} currency={row.currency} />
          <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
            {row.breakdown.map((b) => (
              <div key={b.module} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                <span>{b.module}</span>
                <span>{b.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted" style={{ marginTop: 0 }}>No data yet across any module.</p>
      )}
      <Link to="/net-worth" className="text-muted" style={{ display: 'block', marginTop: 10 }}>
        Full breakdown →
      </Link>
    </CollapsibleCard>
  );
}

function UpcomingPlansRailCard() {
  const items = useUpcomingItems(14);

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Upcoming</h3>} style={{ marginBottom: 16 }}>
      <UpcomingList items={items} limit={5} emptyText="Nothing expected in the next 14 days." />
      <Link to="/planning" className="text-muted" style={{ display: 'block', marginTop: 10 }}>
        See all →
      </Link>
    </CollapsibleCard>
  );
}
