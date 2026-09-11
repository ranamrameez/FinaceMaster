import { Fragment, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BankIcon,
  CashIcon,
  DashboardIcon,
  EMIIcon,
  FundsIcon,
  PersonalLoanIcon,
  PlanningIcon,
  RentalsIcon,
  StocksIcon,
  SubscriptionsIcon,
} from './icons';

export type CategoryKey = 'netWorth' | 'stocks' | 'funds' | 'bank' | 'cash' | 'personalLoans' | 'emi' | 'rentals' | 'subscriptions' | 'planning';

// User-requested (2026-08-28): "This entirely removes the transfers page
// and the problem of duplicated transaction cards" — the standalone
// Transfers page/route/nav entry is gone, replaced by an app-wide
// "Transfers" FAB (`components/ui/Fab.tsx`'s `FabPanel`) reachable from
// every module page.
const CATEGORIES: { key: CategoryKey; label: string; to: string; icon: ReactNode }[] = [
  { key: 'netWorth', label: 'Dashboard', to: '/net-worth', icon: <DashboardIcon /> },
  { key: 'stocks', label: 'Stock Exchanges', to: '/', icon: <StocksIcon /> },
  { key: 'funds', label: 'Funds', to: '/funds', icon: <FundsIcon /> },
  { key: 'bank', label: 'Banking', to: '/bank', icon: <BankIcon /> },
  { key: 'cash', label: 'Cash', to: '/cash', icon: <CashIcon /> },
  { key: 'personalLoans', label: 'Personal Loans', to: '/personal-loans', icon: <PersonalLoanIcon /> },
  { key: 'emi', label: 'EMI / Loans', to: '/emi-loans', icon: <EMIIcon /> },
  { key: 'rentals', label: 'Rentals', to: '/rentals', icon: <RentalsIcon /> },
  { key: 'subscriptions', label: 'Subscriptions', to: '/subscriptions', icon: <SubscriptionsIcon /> },
  { key: 'planning', label: 'Planning', to: '/planning', icon: <PlanningIcon /> },
];

/** Derives the active category from the route rather than storing it
 * separately, same rationale as ExchangeSwitcher's QSE/PSX detection in
 * Sidebar.tsx: a reload or shared link always lands on the nav state that
 * matches what's on screen. Anything not owned by any module (a real
 * global "Rare"-tier page — Account, whole-app Data export/import, Legal)
 * returns `null` so nothing gets wrongly highlighted; every other
 * unrecognized route still falls back to Stock Exchanges (per-ticker pages,
 * Risk Analysis, the Trade Planner, etc. all genuinely belong there).
 * User-reported (2026-09-09): clicking the account/settings row used to
 * highlight "Stock Exchanges" and even render its QSE/PSX sub-nav in the
 * sidebar while on `/account` — this was that same fallback firing for a
 * page it was never meant to cover. */
export function categoryForPath(pathname: string): CategoryKey | null {
  if (pathname.startsWith('/account')) return null;
  if (pathname.startsWith('/app-data')) return null;
  if (pathname.startsWith('/legal')) return null;
  if (pathname.startsWith('/net-worth')) return 'netWorth';
  if (pathname.startsWith('/funds')) return 'funds';
  if (pathname.startsWith('/bank')) return 'bank';
  if (pathname.startsWith('/cash')) return 'cash';
  if (pathname.startsWith('/personal-loans')) return 'personalLoans';
  if (pathname.startsWith('/emi-loans')) return 'emi';
  if (pathname.startsWith('/rentals')) return 'rentals';
  if (pathname.startsWith('/subscriptions')) return 'subscriptions';
  if (pathname.startsWith('/planning')) return 'planning';
  if (pathname.startsWith('/budget')) return 'planning';
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
 * match.
 *
 * User-reported (2026-09-09), a real correction, not a taste call: "I
 * asked to include individual stock Exchs. as subnavs of the SE main nav,
 * but you placed it below as a stand-alone menu using ugly lines." The
 * old shape rendered QSE/PSX's own exchange-switcher + per-page list as a
 * SEPARATE block below the whole category list, with a border-top divider
 * — visually its own standalone menu, not nested under "Stock Exchanges"
 * at all. `stocksSubnav` lets the caller (`Sidebar.tsx`) inject that
 * content as a real sibling list item immediately AFTER the "Stock
 * Exchanges" row, only while that category is active — a `Fragment`
 * (not a wrapping `<div>`) keeps every other row's DOM shape identical, so
 * `nav.navlist`'s `display:flex;flex-direction:column;gap:2px` still
 * treats each row (and, now, the injected subnav block) as its own direct
 * flex item, stacking it right where a nested item visually belongs
 * instead of after the whole list. */
export function CategoryNav({ onNavigate, stocksSubnav }: { onNavigate?: () => void; stocksSubnav?: ReactNode }) {
  const location = useLocation();
  const active = categoryForPath(location.pathname);
  return (
    <nav className="navlist category-list">
      {CATEGORIES.map((c) => (
        <Fragment key={c.key}>
          <NavLink
            to={c.to}
            onClick={onNavigate}
            className={`navbtn category-item${c.key === active ? ' active' : ''}`}
          >
            <span className="category-item-icon" aria-hidden="true">{c.icon}</span>
            {c.label}
          </NavLink>
          {c.key === 'stocks' && active === 'stocks' && stocksSubnav}
        </Fragment>
      ))}
    </nav>
  );
}
