import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CalculatorLauncher } from './components/CalculatorLauncher';
import { ConfirmDialogHost } from './components/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PSXTickerDatalist } from './components/PSXTickerDatalist';
import { SignInModalHost } from './components/SignInModal';
import { TermsGateModal } from './components/TermsGateModal';
import { TickerDatalist } from './components/TickerDatalist';
import { Toast } from './components/Toast';
import { useFirebaseSync } from './lib/firebase/useFirebaseSync';
import { usePSXFirebaseSync } from './lib/firebase/usePSXFirebaseSync';
import { useAppearanceStore } from './store/appearanceStore';
import { AnalyticsPage } from './features/qse/pages/AnalyticsPage';
import { DashboardPage } from './features/qse/pages/DashboardPage';
import { PortfolioPage } from './features/qse/pages/PortfolioPage';
import { TransactionsPage } from './features/qse/pages/TransactionsPage';
import { WatchlistPage } from './features/qse/pages/WatchlistPage';
import { StockPage } from './features/qse/pages/StockPage';
import { SettingsPage } from './features/qse/pages/SettingsPage';
import { RiskAnalysisPage } from './features/qse/pages/RiskAnalysisPage';
import { AnalyticsPage as PSXAnalyticsPage } from './features/psx/pages/AnalyticsPage';
import { DashboardPage as PSXDashboardPage } from './features/psx/pages/DashboardPage';
import { PortfolioPage as PSXPortfolioPage } from './features/psx/pages/PortfolioPage';
import { TransactionsPage as PSXTransactionsPage } from './features/psx/pages/TransactionsPage';
import { WatchlistPage as PSXWatchlistPage } from './features/psx/pages/WatchlistPage';
import { StockPage as PSXStockPage } from './features/psx/pages/StockPage';
import { SettingsPage as PSXSettingsPage } from './features/psx/pages/SettingsPage';
import { TradePlannerPage as PSXTradePlannerPage } from './features/psx/pages/TradePlannerPage';
import { RiskAnalysisPage as PSXRiskAnalysisPage } from './features/psx/pages/RiskAnalysisPage';
import { CashPage } from './features/cash/pages/CashPage';
import { useCashFirebaseSync } from './lib/firebase/useCashFirebaseSync';
import { usePlannedCashFirebaseSync } from './lib/firebase/usePlannedCashFirebaseSync';
import { PersonalLoansPage } from './features/personalLoans/pages/PersonalLoansPage';
import { usePersonalLoansFirebaseSync } from './lib/firebase/usePersonalLoansFirebaseSync';
import { BankPage } from './features/bank/pages/BankPage';
import { useBankFirebaseSync } from './lib/firebase/useBankFirebaseSync';
import { usePlannedBankFirebaseSync } from './lib/firebase/usePlannedBankFirebaseSync';
import { EMIPage } from './features/emi/pages/EMIPage';
import { useEMIFirebaseSync } from './lib/firebase/useEMIFirebaseSync';
import { FundsPage } from './features/funds/pages/FundsPage';
import { useFundsFirebaseSync } from './lib/firebase/useFundsFirebaseSync';
import { RentalsPage } from './features/rentals/pages/RentalsPage';
import { useRentalsFirebaseSync } from './lib/firebase/useRentalsFirebaseSync';
import { usePlannedRentalsFirebaseSync } from './lib/firebase/usePlannedRentalsFirebaseSync';
import { TransferLinksPage } from './features/transfers/pages/TransferLinksPage';
import { useInterEntityTransfersFirebaseSync } from './lib/firebase/useInterEntityTransfersFirebaseSync';
import { LegalPage } from './pages/LegalPage';

function useApplyAppearance() {
  const appearance = useAppearanceStore((s) => s.appearance);

  // Applied directly during render (not in a useEffect): chart-bearing
  // children mount and read these CSS variables via their own effects,
  // which run *before* a useEffect in this parent would — a real bug
  // where charts picked up the theme-less :root default colors (the dark
  // palette) on first paint regardless of the user's actual theme,
  // producing near-black datalabel boxes on a light theme. Setting the
  // attributes synchronously here guarantees they're correct before any
  // child ever paints.
  const root = document.documentElement;
  root.setAttribute('data-theme', appearance.theme);
  root.setAttribute('data-font', appearance.font);
  root.setAttribute('data-fontsize', appearance.fontSize);
  root.setAttribute('data-color', appearance.colorTheme);
  root.setAttribute('data-density', appearance.density || 'comfortable');
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
  // Same account, separate cloud path — see usePSXFirebaseSync. Both syncs
  // run all the time (not just while their routes are active) so a PSX
  // trade logged, say, right before switching to QSE has already started
  // pushing before the component unmounts.
  const psxSync = usePSXFirebaseSync();
  const cashSync = useCashFirebaseSync();
  const plannedCashSync = usePlannedCashFirebaseSync();
  const personalLoansSync = usePersonalLoansFirebaseSync();
  const bankSync = useBankFirebaseSync();
  const plannedBankSync = usePlannedBankFirebaseSync();
  const emiSync = useEMIFirebaseSync();
  const fundsSync = useFundsFirebaseSync();
  const rentalsSync = useRentalsFirebaseSync();
  // Rentals' Planning feature (README item 38) has no dedicated tab/status
  // UI yet, unlike Cash/Bank's — projected rent plans are regenerate-safe
  // speculative data, not irreplaceable history, so skipping the manual
  // "upload local to cloud" affordance for cloudEmpty is an accepted v1
  // simplification. Still run the sync itself so plans persist/pull.
  usePlannedRentalsFirebaseSync();
  const transfersSync = useInterEntityTransfersFirebaseSync();

  return (
    <ErrorBoundary>
      <TermsGateModal />
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
              <Route path="/risk-analysis" element={<RiskAnalysisPage />} />
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
              <Route path="/psx" element={<PSXDashboardPage />} />
              <Route path="/psx/portfolio" element={<PSXPortfolioPage />} />
              <Route path="/psx/transactions" element={<PSXTransactionsPage />} />
              <Route path="/psx/watchlist" element={<PSXWatchlistPage />} />
              <Route path="/psx/stock/:ticker" element={<PSXStockPage />} />
              <Route path="/psx/analytics" element={<PSXAnalyticsPage />} />
              <Route path="/psx/trade-planner" element={<PSXTradePlannerPage />} />
              <Route path="/psx/risk-analysis" element={<PSXRiskAnalysisPage />} />
              <Route
                path="/psx/settings"
                element={
                  <PSXSettingsPage
                    user={user}
                    syncStatus={psxSync.status}
                    cloudEmpty={psxSync.cloudEmpty}
                    uploadLocalToCloud={psxSync.uploadLocalToCloud}
                  />
                }
              />
              <Route
                path="/cash"
                element={
                  <CashPage
                    user={user}
                    syncStatus={cashSync.status}
                    cloudEmpty={cashSync.cloudEmpty}
                    uploadLocalToCloud={cashSync.uploadLocalToCloud}
                    plannedSyncStatus={plannedCashSync.status}
                    plannedCloudEmpty={plannedCashSync.cloudEmpty}
                    uploadPlannedLocalToCloud={plannedCashSync.uploadLocalToCloud}
                  />
                }
              />
              <Route
                path="/personal-loans"
                element={
                  <PersonalLoansPage
                    user={user}
                    syncStatus={personalLoansSync.status}
                    cloudEmpty={personalLoansSync.cloudEmpty}
                    uploadLocalToCloud={personalLoansSync.uploadLocalToCloud}
                  />
                }
              />
              <Route
                path="/bank"
                element={
                  <BankPage
                    user={user}
                    syncStatus={bankSync.status}
                    cloudEmpty={bankSync.cloudEmpty}
                    uploadLocalToCloud={bankSync.uploadLocalToCloud}
                    plannedSyncStatus={plannedBankSync.status}
                    plannedCloudEmpty={plannedBankSync.cloudEmpty}
                    uploadPlannedLocalToCloud={plannedBankSync.uploadLocalToCloud}
                  />
                }
              />
              <Route
                path="/emi-loans"
                element={
                  <EMIPage
                    user={user}
                    syncStatus={emiSync.status}
                    cloudEmpty={emiSync.cloudEmpty}
                    uploadLocalToCloud={emiSync.uploadLocalToCloud}
                  />
                }
              />
              <Route
                path="/funds"
                element={
                  <FundsPage
                    user={user}
                    syncStatus={fundsSync.status}
                    cloudEmpty={fundsSync.cloudEmpty}
                    uploadLocalToCloud={fundsSync.uploadLocalToCloud}
                  />
                }
              />
              <Route
                path="/rentals"
                element={
                  <RentalsPage
                    user={user}
                    syncStatus={rentalsSync.status}
                    cloudEmpty={rentalsSync.cloudEmpty}
                    uploadLocalToCloud={rentalsSync.uploadLocalToCloud}
                  />
                }
              />
              <Route
                path="/transfers"
                element={
                  <TransferLinksPage
                    user={user}
                    syncStatus={transfersSync.status}
                    cloudEmpty={transfersSync.cloudEmpty}
                    uploadLocalToCloud={transfersSync.uploadLocalToCloud}
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
        <PSXTickerDatalist />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
