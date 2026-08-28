import { NavLink, useLocation } from 'react-router-dom';

export type CategoryKey = 'netWorth' | 'stocks' | 'funds' | 'bank' | 'cash' | 'personalLoans' | 'emi' | 'rentals' | 'subscriptions' | 'planning' | 'budget';

// User-requested (2026-08-28): "This entirely removes the transfers page
// and the problem of duplicated transaction cards" — the standalone
// Transfers page/route/nav entry is gone, replaced by an app-wide
// "Transfers" FAB (`components/ui/Fab.tsx`'s `FabPanel`) reachable from
// every module page.
const CATEGORIES: { key: CategoryKey; label: string; to: string }[] = [
  { key: 'netWorth', label: 'Net Worth', to: '/net-worth' },
  { key: 'stocks', label: 'Stock Exchanges', to: '/' },
  { key: 'funds', label: 'Funds', to: '/funds' },
  { key: 'bank', label: 'Banking', to: '/bank' },
  { key: 'cash', label: 'Cash', to: '/cash' },
  { key: 'personalLoans', label: 'Personal Loans', to: '/personal-loans' },
  { key: 'emi', label: 'EMI / Loans', to: '/emi-loans' },
  { key: 'rentals', label: 'Rentals', to: '/rentals' },
  { key: 'subscriptions', label: 'Subscriptions', to: '/subscriptions' },
  { key: 'planning', label: 'Planning', to: '/planning' },
  { key: 'budget', label: 'Budget Planner', to: '/budget' },
];

/** Derives the active category from the route rather than storing it
 * separately, same rationale as ExchangeSwitcher's QSE/PSX detection in
 * Sidebar.tsx: a reload or shared link always lands on the nav state that
 * matches what's on screen. Anything not owned by a module (e.g. /legal)
 * falls back to Stock Exchanges. */
export function categoryForPath(pathname: string): CategoryKey {
  if (pathname.startsWith('/net-worth')) return 'netWorth';
  if (pathname.startsWith('/funds')) return 'funds';
  if (pathname.startsWith('/bank')) return 'bank';
  if (pathname.startsWith('/cash')) return 'cash';
  if (pathname.startsWith('/personal-loans')) return 'personalLoans';
  if (pathname.startsWith('/emi-loans')) return 'emi';
  if (pathname.startsWith('/rentals')) return 'rentals';
  if (pathname.startsWith('/subscriptions')) return 'subscriptions';
  if (pathname.startsWith('/planning')) return 'planning';
  if (pathname.startsWith('/budget')) return 'budget';
  return 'stocks';
}

/** README item 18 originally generalized the old QSE/PSX-only chip pair
 * into a dropdown across every module. User feedback (2026-08-26): opening
 * a popup every time just to switch modules was "very hectic" — reworked
 * into a plain always-visible list (same `.navbtn` styling every other
 * sidebar nav item uses), so switching modules is one click instead of
 * two. Active-state highlighting reuses `categoryForPath` (not React
 * Router's own `NavLink` matching) so Stock Exchanges correctly stays
 * highlighted across every `/psx/*` route too, not just the exact "/"
 * match. Stock Exchanges keeps its own QSE/PSX sub-switcher + page nav
 * rendered by the caller below this component; every other category is a
 * single page, so picking it just navigates there. */
export function CategoryNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const active = categoryForPath(location.pathname);
  return (
    <nav className="navlist category-list">
      {CATEGORIES.map((c) => (
        <NavLink
          key={c.key}
          to={c.to}
          onClick={onNavigate}
          className={`navbtn category-item${c.key === active ? ' active' : ''}`}
        >
          {c.label}
        </NavLink>
      ))}
    </nav>
  );
}
