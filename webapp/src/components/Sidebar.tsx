import type { User } from 'firebase/auth';
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/firebase/useProfile';
import { AppearancePanel } from './AppearancePanel';
import { CategoryNav, categoryForPath } from './CategoryNav';
import { LogInIcon, LogoMark } from './icons';
import { requireSignIn } from './SignInModal';

const QSE_NAV_ITEMS = [
  { num: '01', label: 'Dashboard', to: '/' },
  { num: '02', label: 'Portfolio', to: '/portfolio' },
  { num: '03', label: 'Trade Transactions', to: '/transactions' },
  { num: '04', label: 'Watchlist', to: '/watchlist' },
  { num: '05', label: 'Analytics', to: '/analytics' },
  { num: '06', label: 'Risk Analysis', to: '/risk-analysis' },
  { num: '07', label: 'Settings', to: '/settings' },
];

const PSX_NAV_ITEMS = [
  { num: '01', label: 'Dashboard', to: '/psx' },
  { num: '02', label: 'Portfolio', to: '/psx/portfolio' },
  { num: '03', label: 'Trade Transactions', to: '/psx/transactions' },
  { num: '04', label: 'Watchlist', to: '/psx/watchlist' },
  { num: '05', label: 'Analytics', to: '/psx/analytics' },
  { num: '06', label: 'Risk Analysis', to: '/psx/risk-analysis' },
  { num: '07', label: 'Trade Planner', to: '/psx/trade-planner' },
  { num: '08', label: 'Settings', to: '/psx/settings' },
];

const PAGES_OPEN_KEY = 'financerecorder_stock_pages_open_v1';

/** User-reported (2026-08-27, two independent complaints converging on the
 * same element — "subnav dumped in main nav" and "side nav poorly
 * arranged"): unlike every other module (which keeps its own Settings/
 * Account/Export behind in-page Tabs, nothing in the sidebar), Stock
 * Exchanges' numbered page list rendered permanently inline, a real
 * structural outlier. Asked the user how to fix it (collapse vs. just a
 * visual separator vs. leave it) — chose collapse-by-default. Collapsed on
 * first visit; once expanded it stays expanded (persisted, same
 * localStorage-remembered pattern as the whole-sidebar collapse in
 * AppShell.tsx) so a user who's shown they want to navigate between
 * Dashboard/Portfolio/etc. isn't forced to re-expand on every reload. */
function usePagesOpen() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(PAGES_OPEN_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(PAGES_OPEN_KEY, String(next));
      } catch {
        /* ignore — a failed persist just means it doesn't survive a reload */
      }
      return next;
    });
  return { open, toggle };
}

/** Stocks → QSE/PSX switcher. Which exchange is "current" is derived from
 * the route (anything under /psx is PSX, everything else is QSE) rather
 * than stored separately, so a reload or a shared link always lands on the
 * nav state that matches what's on screen. */
function ExchangeSwitcher({ exchange }: { exchange: 'qse' | 'psx' }) {
  const navigate = useNavigate();
  return (
    <div className="chip-tabs" style={{ marginBottom: 8 }}>
      <button type="button" className={`chip${exchange === 'qse' ? ' active' : ''}`} onClick={() => navigate('/')}>
        QSE
      </button>
      <button type="button" className={`chip${exchange === 'psx' ? ' active' : ''}`} onClick={() => navigate('/psx')}>
        PSX
      </button>
    </div>
  );
}

export function Sidebar({
  user,
  className = '',
  onNavigate,
  onCollapse,
}: {
  user: User | null;
  className?: string;
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const profile = useProfile(user);
  const name = profile.displayName || user?.email || user?.phoneNumber || 'account';
  const location = useLocation();
  const exchange: 'qse' | 'psx' = location.pathname.startsWith('/psx') ? 'psx' : 'qse';
  const navItems = exchange === 'psx' ? PSX_NAV_ITEMS : QSE_NAV_ITEMS;
  const category = categoryForPath(location.pathname);
  const { open: pagesOpen, toggle: togglePagesOpen } = usePagesOpen();

  return (
    <div className={`sidebar ${className}`.trim()}>
      <div className="sidebar-title-row">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18, letterSpacing: '.01em' }}>
          <LogoMark />
          FinanceRecorder
        </span>
        {onCollapse && (
          <button type="button" className="sidebar-collapse-btn" onClick={onCollapse} aria-label="Hide sidebar" title="Hide sidebar">
            «
          </button>
        )}
      </div>

      <div className="sidebar-scroll">
        <CategoryNav onNavigate={onNavigate} />

        {category === 'stocks' && (
          // Pending item 113: the category list above and this exchange-
          // specific block had no visual separator, reading as one
          // undifferentiated block — a thin top border + spacing makes the
          // boundary explicit without changing any navigation behavior
          // (distinct from Done item 209's structural fix, right below).
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
            <ExchangeSwitcher exchange={exchange} />
            <button
              type="button"
              onClick={togglePagesOpen}
              aria-expanded={pagesOpen}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none',
                color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em',
                padding: '4px 2px', cursor: 'pointer', marginBottom: 4,
              }}
            >
              <span style={{ display: 'inline-block', transition: 'transform .15s ease', transform: pagesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
              Pages
            </button>
            {pagesOpen && (
              <nav className="navlist">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
                    <span className="num">{item.num}</span>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <AppearancePanel />

        {/* Redesign 2026-08-27 (Main/Often/Rare — see CLAUDE.md): Import/
           export, sync status, and the disclaimer paragraph used to sit
           here permanently ("plenty of stuff down there... making it still
           positioned in the middle" — a direct user complaint) — all three
           are Rare-tier content now living on the one /account hub page
           this button links to, so the footer itself stays down to a
           single account row + a compact legal line. */}
        <div className="sidebar-account-group">
          {user ? (
            <NavLink to="/account" onClick={onNavigate} className="navbtn account-btn">
              <span className="num">{profile.avatarEmoji || '●'}</span>
              Signed in as <strong>&nbsp;{name}</strong>
            </NavLink>
          ) : (
            <button type="button" className="navbtn account-btn" onClick={() => requireSignIn()}>
              <span className="num"><LogInIcon size={13} /></span>
              Not signed in — tap to sign in
            </button>
          )}
        </div>

        <div className="footer-note" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>© {new Date().getFullYear()} FinanceRecorder</span>
          <NavLink to="/legal" style={{ color: 'inherit' }}>Legal</NavLink>
        </div>
      </div>
    </div>
  );
}
