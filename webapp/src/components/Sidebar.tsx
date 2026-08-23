import type { User } from 'firebase/auth';
import { NavLink } from 'react-router-dom';
import { useProfile } from '../lib/firebase/useProfile';
import { AppearancePanel } from './AppearancePanel';
import { LogInIcon } from './icons';
import { requireSignIn } from './SignInModal';

const NAV_ITEMS = [
  { num: '01', label: 'Dashboard', to: '/' },
  { num: '02', label: 'Portfolio', to: '/portfolio' },
  { num: '03', label: 'Transactions', to: '/transactions' },
  { num: '04', label: 'Watchlist', to: '/watchlist' },
  { num: '05', label: 'Analytics', to: '/analytics' },
];

// The Risk Analysis and PSX modules haven't been migrated to React yet —
// link out to the legacy static pages at the repo root during the
// transition, same as the legacy apps link to each other.
const LEGACY_LINKS = [
  { num: '06', label: 'Risk Analysis', href: '../Risk_Analysis_Calculator.html' },
  { num: '07', label: 'PSX Workbook', href: '../PSX_Trade_Planner.html' },
];

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

  return (
    <div className={`sidebar ${className}`.trim()}>
      <nav className="navlist">
        {NAV_ITEMS.map((item) => (
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
        <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => `navbtn${isActive ? ' active' : ''}`}>
          <span className="num">08</span>
          Settings
        </NavLink>
      </nav>

      <AppearancePanel />

      {user ? (
        <NavLink to="/settings" className="footer-note" style={{ marginTop: 24, display: 'block', textDecoration: 'none' }}>
          {profile.avatarEmoji || '●'} Signed in as <strong>{name}</strong>
        </NavLink>
      ) : (
        <button
          className="footer-note"
          onClick={() => requireSignIn()}
          style={{
            marginTop: 24, display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            textAlign: 'left', background: 'transparent', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer',
          }}
        >
          <LogInIcon size={12} />Not signed in — tap to sign in
        </button>
      )}
      <div className="footer-note" style={{ marginTop: 8, border: 'none', paddingTop: 0 }}>
        Estimates only — verify against your official statement.{' '}
        <NavLink to="/legal" style={{ color: 'inherit' }}>Disclaimer &amp; Privacy</NavLink>
      </div>
    </div>
  );
}
