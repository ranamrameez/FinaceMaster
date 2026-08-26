import { Link } from 'react-router-dom';
import { CollapsibleCard, MoneyValue } from './Card';
import { useNetWorthSummary } from '../features/netWorth/hooks/useNetWorthSummary';
import { usePlannedCashWorkbookStore } from '../store/plannedCashWorkbookStore';
import { usePlannedBankWorkbookStore } from '../store/plannedBankWorkbookStore';
import { useBankWorkbookStore } from '../store/bankWorkbookStore';

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
 * 2. **Upcoming plans** — the next few not-yet-executed entries from Cash's
 *    and Banking's Planning features, merged and sorted by date. These
 *    already existed as per-currency stat-card sub-lines on Cash/Bank's own
 *    landing pages (Done item 57) but were never visible from anywhere
 *    else in the app.
 *
 * Deliberately generic (not QSE/PSX-specific) so any page can drop this in
 * via the shared `.rail-split` CSS grid — starts on QSE's/PSX's Dashboard
 * (the highest-traffic pages) as a working vertical slice, same "ship one
 * page first, verified" pattern this project always follows before a
 * wider rollout. */
export function DashboardRail() {
  return (
    <div>
      <NetWorthRailCard />
      <UpcomingPlansRailCard />
    </div>
  );
}

function NetWorthRailCard() {
  const { rows, biggestExposureCurrency } = useNetWorthSummary();
  const row = rows.find((r) => r.currency === biggestExposureCurrency);

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Net worth</h3>} style={{ marginBottom: 16 }}>
      {row ? (
        <>
          <div className="label" style={{ marginBottom: 4 }}>{row.currency}</div>
          <MoneyValue n={row.net} currency={row.currency} />
          <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
            {row.breakdown.map((b) => (
              <div key={b.module} className="row" style={{ justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                <span>{b.module}</span>
                <span>{b.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="footer-note" style={{ marginTop: 0 }}>No data yet across any module.</p>
      )}
      <Link to="/net-worth" className="footer-note" style={{ display: 'block', marginTop: 10 }}>
        Full breakdown →
      </Link>
    </CollapsibleCard>
  );
}

interface RailPlan {
  date: string;
  label: string;
  amount: number;
  currencyCode: string;
  module: 'Cash' | 'Banking';
}

function UpcomingPlansRailCard() {
  const cashPlans = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const bankPlans = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const accountCurrency = new Map(accounts.map((a) => [a.id, a.currencyCode]));

  const plans: RailPlan[] = [
    ...cashPlans
      .filter((p) => !p.executed)
      .map((p): RailPlan => ({
        date: p.date,
        label: p.category || (p.type === 'IN' ? 'Cash in' : 'Cash out'),
        amount: p.type === 'IN' ? p.amount : -p.amount,
        currencyCode: p.currencyCode,
        module: 'Cash',
      })),
    ...bankPlans
      .filter((p) => !p.executed)
      .map((p): RailPlan => ({
        date: p.date,
        label: p.description || p.category || 'Bank transaction',
        amount: p.amount,
        currencyCode: accountCurrency.get(p.accountId) || '',
        module: 'Banking',
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const upcoming = plans.slice(0, 5);

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Upcoming plans</h3>} style={{ marginBottom: 16 }}>
      {upcoming.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {upcoming.map((p, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
              <div>
                <div>{p.label}</div>
                <div className="footer-note">{p.date} · {p.module}</div>
              </div>
              <div className={p.amount >= 0 ? 'pill-buy' : 'pill-sell'}>
                {p.amount >= 0 ? '+' : ''}{p.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {p.currencyCode}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="footer-note" style={{ marginTop: 0 }}>No upcoming plans in Cash or Banking right now.</p>
      )}
    </CollapsibleCard>
  );
}
