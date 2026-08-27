import type { User } from 'firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import type { ModuleSyncStatus } from './SyncStatusIndicator';

const COLLAPSE_KEY = 'financerecorder_sidebar_collapsed_v1';

/** App shell: sidebar + main content, with a mobile off-canvas drawer below
 * 860px (see the .sidebar/.mobile-menu-btn rules in theme.css) instead of
 * the fixed 220px column overflowing a phone-width viewport, plus a
 * separate desktop collapse ("save space and focus" — user request):
 * above 860px the sidebar is open by default and can be slid off-screen
 * on demand, remembered across reloads via localStorage. Distinct from
 * the mobile drawer, which is closed by default and opens on demand. */
export function AppShell({ user, children, syncStatuses = [] }: { user: User | null; children: ReactNode; syncStatuses?: ModuleSyncStatus[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const location = useLocation();

  // Close the drawer whenever the route changes (tapping a nav link should
  // navigate AND close, not leave the drawer covering the new page).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleDesktopCollapsed = () => {
    setDesktopCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* ignore — a failed persist just means it doesn't survive a reload */
      }
      return next;
    });
  };

  return (
    <div className="shell">
      <Sidebar
        user={user}
        className={`${mobileOpen ? 'open' : ''} ${desktopCollapsed ? 'desktop-collapsed' : ''}`.trim()}
        onNavigate={() => setMobileOpen(false)}
        onCollapse={toggleDesktopCollapsed}
        syncStatuses={syncStatuses}
      />
      <div className={`mobile-backdrop${mobileOpen ? ' open' : ''}`} onClick={() => setMobileOpen(false)} />
      <button
        type="button"
        className={`sidebar-expand-tab${desktopCollapsed ? ' show' : ''}`}
        onClick={toggleDesktopCollapsed}
        aria-label="Show sidebar"
        title="Show sidebar"
      >
        »
      </button>
      <div className={`main${desktopCollapsed ? ' sidebar-collapsed' : ''}`}>
        <button className="mobile-menu-btn" onClick={() => setMobileOpen((v) => !v)} type="button">
          ☰ Menu
        </button>
        {children}
      </div>
    </div>
  );
}
