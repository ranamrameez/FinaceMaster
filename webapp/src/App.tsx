import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ConfirmDialogHost } from './components/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SignInModalHost } from './components/SignInModal';
import { TickerDatalist } from './components/TickerDatalist';
import { Toast } from './components/Toast';
import { CalculatorLauncher } from './features/qse/components/CalculatorLauncher';
import { useFirebaseSync } from './lib/firebase/useFirebaseSync';
import { useAppearanceStore } from './store/appearanceStore';
import { AnalyticsPage } from './features/qse/pages/AnalyticsPage';
import { DashboardPage } from './features/qse/pages/DashboardPage';
import { PortfolioPage } from './features/qse/pages/PortfolioPage';
import { TransactionsPage } from './features/qse/pages/TransactionsPage';
import { WatchlistPage } from './features/qse/pages/WatchlistPage';
import { StockPage } from './features/qse/pages/StockPage';
import { SettingsPage } from './features/qse/pages/SettingsPage';
import { LegalPage } from './pages/LegalPage';

function useApplyAppearance() {
  const appearance = useAppearanceStore((s) => s.appearance);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', appearance.theme);
    root.setAttribute('data-font', appearance.font);
    root.setAttribute('data-fontsize', appearance.fontSize);
    root.setAttribute('data-color', appearance.colorTheme);
    root.setAttribute('data-density', appearance.density || 'comfortable');
  }, [appearance]);
}

// Browsing, calculators, and (later) read-only features like news/analysis
// don't require an account — only saving/editing data does, prompted via
// the SignInModal popup at the point of that action (see requireSignIn()).
// There is deliberately no "continue without an account" local-only mode
// any more: that ambiguous state (data existing before it's tied to any
// account) is what led to a real data-loss incident — see
// feedback_cloud_sync_safety memory.
function App() {
  useApplyAppearance();
  const { user, status, cloudEmpty, uploadLocalToCloud } = useFirebaseSync();

  return (
    <ErrorBoundary>
      <ConfirmDialogHost />
      <SignInModalHost />
      <HashRouter>
        <AppShell user={user}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/stock/:ticker" element={<StockPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route
                path="/settings"
                element={
                  <SettingsPage
                    user={user}
                    syncStatus={status}
                    cloudEmpty={cloudEmpty}
                    uploadLocalToCloud={uploadLocalToCloud}
                  />
                }
              />
              <Route path="/legal" element={<LegalPage />} />
            </Routes>
          </ErrorBoundary>
        </AppShell>
        <CalculatorLauncher />
        <Toast />
        <TickerDatalist />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
