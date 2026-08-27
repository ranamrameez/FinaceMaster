import type { User } from 'firebase/auth';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/firebase/useProfile';
import { AppearancePanel } from './AppearancePanel';
import { CategoryNav, categoryForPath } from './CategoryNav';
import { ExportIcon, LogInIcon, LogoMark } from './icons';
import { requireSignIn } from './SignInModal';
import { SyncStatusIndicator, type ModuleSyncStatus } from './SyncStatusIndicator';

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
  syncStatuses = [],
}: {
  user: User | null;
  className?: string;
  onNavigate?: () => void;
  onCollapse?: () => void;
  syncStatuses?: ModuleSyncStatus[];
}) {
  const profile = useProfile(user);
  const name = profile.displayName || user?.email || user?.phoneNumber || 'account';
  const location = useLocation();
  const exchange: 'qse' | 'psx' = location.pathname.startsWith('/psx') ? 'psx' : 'qse';
  const navItems = exchange === 'psx' ? PSX_NAV_ITEMS : QSE_NAV_ITEMS;
  const category = categoryForPath(location.pathname);

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
          <>
            <ExchangeSwitcher exchange={exchange} />
            <nav className="navlist">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
                  <span className="num">{item.num}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <AppearancePanel />

        <div className="sidebar-account-group">
          {user ? (
            <NavLink to="/settings" onClick={onNavigate} className="navbtn account-btn">
              <span className="num">{profile.avatarEmoji || '●'}</span>
              Signed in as <strong>&nbsp;{name}</strong>
            </NavLink>
          ) : (
            <button type="button" className="navbtn account-btn" onClick={() => requireSignIn()}>
              <span className="num"><LogInIcon size={13} /></span>
              Not signed in — tap to sign in
            </button>
          )}
          <NavLink to="/app-data" onClick={onNavigate} className="navbtn account-sub-btn">
            <span className="num"><ExportIcon size={12} /></span>
            Backup / restore all data
          </NavLink>
          {user && <SyncStatusIndicator modules={syncStatuses} />}
        </div>

        <div className="footer-note" style={{ marginTop: 10 }}>
          Estimates only — verify against your official statement.{' '}
          <NavLink to="/legal" style={{ color: 'inherit' }}>Disclaimer &amp; Privacy</NavLink>
        </div>
        <div className="footer-note" style={{ marginTop: 6 }}>
          © {new Date().getFullYear()} FinanceRecorder
        </div>
      </div>
    </div>
  );
}
