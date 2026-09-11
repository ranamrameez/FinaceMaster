import { Link } from 'react-router-dom';
import { fmtMoney } from '../lib/format';
import type { UpcomingItem } from '../lib/calc/upcoming';

const MODULE_LABELS: Record<UpcomingItem['module'], string> = {
  cash: 'Cash', bank: 'Banking', emi: 'EMI/Loans', rentals: 'Rentals', subscriptions: 'Subscriptions',
};

const MODULE_LINK: Record<UpcomingItem['module'], string> = {
  cash: '/cash', bank: '/bank', emi: '/emi-loans', rentals: '/rentals', subscriptions: '/subscriptions',
};

/** Shared row-list renderer for `collectUpcomingItems()`'s output — used by
 * both the homepage "Upcoming" rail card (`DashboardRail.tsx`) and the
 * revamped `/planning` page, so the two surfaces (a glance vs. the full
 * list) always render identically. Deliberately avoids the shared `.row`
 * CSS class here — its `min-width`/`flex` rules are meant for form
 * controls and have repeatedly fought free-form flex layouts elsewhere in
 * this app (see CLAUDE.md's own notes on that class), so this uses plain
 * inline flex styles instead. */
export function UpcomingList({
  items,
  limit,
  emptyText = 'Nothing expected soon.',
}: {
  items: UpcomingItem[];
  limit?: number;
  emptyText?: string;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <p className="text-muted mt-0">{emptyText}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {shown.map((item, i) => (
        <Link
          key={i}
          to={MODULE_LINK[item.module]}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
            textDecoration: 'none', color: 'inherit', padding: '6px 8px', borderRadius: 6,
            background: item.overdue ? 'color-mix(in srgb, var(--loss) 12%, transparent)' : 'transparent',
          }}
        >
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <span className="text-muted" style={{ marginRight: 8 }}>{item.date}</span>
            {item.label}
            <span className="text-muted" style={{ marginLeft: 8 }}>({MODULE_LABELS[item.module]})</span>
            {item.overdue && <span className="pill-negative" style={{ marginLeft: 8 }}>Overdue</span>}
          </span>
          <span className={item.kind === 'income' ? 'pill-positive' : 'pill-negative'} style={{ flexShrink: 0 }}>
            {item.kind === 'income' ? '+' : '-'}{fmtMoney(item.amount, item.currencyCode)}
          </span>
        </Link>
      ))}
    </div>
  );
}
