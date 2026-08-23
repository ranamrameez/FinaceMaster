import type { User } from 'firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

/** App shell: sidebar + main content, with a mobile off-canvas drawer below
 * 860px (see the .sidebar/.mobile-menu-btn rules in theme.css) instead of
 * the fixed 220px column overflowing a phone-width viewport. */
export function AppShell({ user, children }: { user: User | null; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the drawer whenever the route changes (tapping a nav link should
  // navigate AND close, not leave the drawer covering the new page).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <Sidebar user={user} className={mobileOpen ? 'open' : ''} onNavigate={() => setMobileOpen(false)} />
      <div className={`mobile-backdrop${mobileOpen ? ' open' : ''}`} onClick={() => setMobileOpen(false)} />
      <div className="main">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen((v) => !v)} type="button">
          ☰ Menu
        </button>
        {children}
      </div>
    </div>
  );
}
