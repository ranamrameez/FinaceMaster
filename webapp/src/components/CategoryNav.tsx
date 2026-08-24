import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type CategoryKey = 'netWorth' | 'stocks' | 'funds' | 'bank' | 'cash' | 'personalLoans' | 'emi' | 'rentals' | 'subscriptions' | 'transfers';

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
  { key: 'transfers', label: 'Transfers', to: '/transfers' },
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
  if (pathname.startsWith('/transfers')) return 'transfers';
  return 'stocks';
}

/** README item 18: generalizes the old QSE/PSX-only chip pair into a
 * dropdown across every module (Stock Exchanges, Funds, Banking, Cash,
 * Personal Loans, EMI/Loans, Rentals), highlighting the active one.
 * Stock Exchanges keeps its own QSE/PSX sub-switcher + page nav rendered
 * by the caller below this component; every other category is a single
 * page, so picking it just navigates there. */
export function CategoryNav({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const active = categoryForPath(location.pathname);
  const activeLabel = CATEGORIES.find((c) => c.key === active)?.label ?? 'Stock Exchanges';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="category-popover" ref={containerRef}>
      <button className="navbtn category-trigger" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="num">▤</span>
        {activeLabel}
        <span className="category-chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="category-panel">
          <div className="category-panel-title">Categories</div>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`category-option${c.key === active ? ' active' : ''}`}
              onClick={() => {
                setOpen(false);
                navigate(c.to);
                onNavigate?.();
              }}
            >
              {c.label}
              {c.key === active ? <span className="category-check">✓</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
