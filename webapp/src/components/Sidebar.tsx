import type { User } from 'firebase/auth';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/firebase/useProfile';
import { AppearancePanel } from './AppearancePanel';
import { LogInIcon } from './icons';
import { requireSignIn } from './SignInModal';

const QSE_NAV_ITEMS = [
  { num: '01', label: 'Dashboard', to: '/' },
  { num: '02', label: 'Portfolio', to: '/portfolio' },
  { num: '03', label: 'Transactions', to: '/transactions' },
  { num: '04', label: 'Watchlist', to: '/watchlist' },
  { num: '05', label: 'Analytics', to: '/analytics' },
  { num: '06', label: 'Settings', to: '/settings' },
];

const PSX_NAV_ITEMS = [
  { num: '01', label: 'Dashboard', to: '/psx' },
  { num: '02', label: 'Portfolio', to: '/psx/portfolio' },
  { num: '03', label: 'Transactions', to: '/psx/transactions' },
  { num: '04', label: 'Watchlist', to: '/psx/watchlist' },
  { num: '05', label: 'Analytics', to: '/psx/analytics' },
  { num: '06', label: 'Trade Planner', to: '/psx/trade-planner' },
  { num: '07', label: 'Settings', to: '/psx/settings' },
];

// Risk Analysis hasn't been migrated to React yet — link out to the legacy
// static page at the repo root during the transition. PSX no longer needs
// a legacy link now that it has its own React module (see PSX_NAV_ITEMS).
const LEGACY_LINKS = [{ num: '07', label: 'Risk Analysis', href: '../Risk_Analysis_Calculator.html' }];

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
}: {
  user: User | null;
  className?: string;
  onNavigate?: () => void;
}) {
  const profile = useProfile(user);
  const name = profile.displayName || user?.email || user?.phoneNumber || 'account';
  const location = useLocation();
  const exchange: 'qse' | 'psx' = location.pathname.startsWith('/psx') ? 'psx' : 'qse';
  const navItems = exchange === 'psx' ? PSX_NAV_ITEMS : QSE_NAV_ITEMS;

  return (
    <div className={`sidebar ${className}`.trim()}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12, letterSpacing: '.01em' }}>FinanceRecorder</div>
      <div className="footer-note" style={{ textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
        Stocks
      </div>
      <ExchangeSwitcher exchange={exchange} />
      <nav className="navlist">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
            <span className="num">{item.num}</span>
            {item.label}
          </NavLink>
        ))}
        {LEGACY_LINKS.map((item) => (
          <a key={item.href} className="navbtn" href={item.href}>
            <span className="num">{item.num}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Minimal placeholder nav for new modules until the category-dropdown
          redesign (README item 18) replaces this with a proper switcher
          alongside Stocks. Cash is the first module built per MODULES_PLAN.md. */}
      <div className="footer-note" style={{ textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 16, marginBottom: 4 }}>
        More
      </div>
      <nav className="navlist">
        <NavLink to="/cash" onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
          <span className="num">01</span>
          Cash
        </NavLink>
        <NavLink to="/personal-loans" onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
          <span className="num">02</span>
          Personal Loans
        </NavLink>
        <NavLink to="/bank" onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
          <span className="num">03</span>
          Banking
        </NavLink>
        <NavLink to="/emi-loans" onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
          <span className="num">04</span>
          EMI / Loans
        </NavLink>
      </nav>

      <AppearancePanel />

      {user ? (
        <NavLink to="/settings" className="footer-note" style={{ marginTop: 20, display: 'block', textDecoration: 'none' }}>
          {profile.avatarEmoji || '●'} Signed in as <strong>{name}</strong>
        </NavLink>
      ) : (
        <button
          className="footer-note"
          onClick={() => requireSignIn()}
          style={{
            marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >
          <LogInIcon size={12} />Not signed in — tap to sign in
        </button>
      )}
      <div className="footer-note" style={{ marginTop: 6 }}>
        Estimates only — verify against your official statement.{' '}
        <NavLink to="/legal" style={{ color: 'inherit' }}>Disclaimer &amp; Privacy</NavLink>
      </div>
      <div className="footer-note" style={{ marginTop: 6 }}>
        © {new Date().getFullYear()} FinanceRecorder
      </div>
    </div>
  );
}
