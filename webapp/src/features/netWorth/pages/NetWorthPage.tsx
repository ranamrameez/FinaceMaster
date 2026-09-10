import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart, Doughnut } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue, StatCard } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { FabButton } from '../../../components/ui/Fab';
import { CheckIcon, SettingsIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { ChartCard } from '../../qse/components/ChartCard';
import { netIncomeByCurrency as rentalsNetIncomeByCurrency } from '../../../lib/calc/rentalsModule';
import { flowByCurrency } from '../../../lib/calc/netWorth';
import { collectBudgetActivities, monthlyIncomeExpense, monthRange, monthsBetween, currentMonth as currentMonthOf, type MonthlyIncomeExpense, type BudgetActivity } from '../../../lib/calc/budgetPlanner';
import { endOfMonthAsOf, projectedNetWorthTrend, type MonthlyNetWorthPoint } from '../../../lib/calc/netWorthTrend';
import { earliestActivityDate, netWorthAsOfDate, type NetWorthAsOfInputs } from '../../../lib/calc/netWorthAsOf';
import { upcomingRenewals } from '../../../lib/calc/subscriptionsModule';
import { UpcomingList } from '../../../components/UpcomingList';
import { useUpcomingItems } from '../../../hooks/useUpcomingItems';
import { useSubscriptionsWorkbookStore } from '../../../store/subscriptionsWorkbookStore';
import { useNetWorthSummary } from '../hooks/useNetWorthSummary';
import { convertAmount, effectiveRate, fetchFxRates, isFxStale, loadCachedFxRates, saveFxRates, setCrossRate, type FxRates } from '../../../lib/fx';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useAuthState } from '../../../lib/firebase/useAuthState';
import { firebaseReady } from '../../../lib/firebase/client';
import { fmtMoney } from '../../../lib/format';
import { dlDoughnut, dlLine, withAlpha } from '../../../lib/chartLabels';
import type { ChartDataset } from 'chart.js';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar } from '../../../lib/cssVar';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useCategoryStore } from '../../../store/categoryStore';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useEnabledCurrencies } from '../../../hooks/useEnabledCurrencies';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../../store/plannedCashWorkbookStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCreditCardWorkbookStore } from '../../../store/creditCardWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useNetWorthSnapshotsWorkbookStore } from '../../../store/netWorthSnapshotsWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../../../store/plannedRentalsWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { usePersonalLoansWorkbookStore } from '../../../store/personalLoansWorkbookStore';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { CashSettings } from '../../../types/cashWorkbook';
import type { QSESettings } from '../../../types/workbook';
import type { PSXSettings } from '../../../types/psxWorkbook';
import type { BankAccount } from '../../../types/bankWorkbook';
import type { PersonalLoan } from '../../../types/personalLoansWorkbook';
import type { EMILoan } from '../../../types/emiWorkbook';
import type { Fund, FundsWorkbook } from '../../../types/fundsWorkbook';
import { gridAutoStyle } from '../../../lib/gridStyle';

const today = () => new Date().toISOString().slice(0, 10);
const monthLabel = (m: string) => new Date(`${m}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/** Cross-module net worth summary (README item 39 / MODULES_PLAN.md §16),
 * renamed "Dashboard" in the nav/heading (user-requested 2026-09-04) — the
 * route/file names stay `NetWorthPage`/`/net-worth` internally (no user-
 * facing benefit to renaming those, real risk in touching route paths for
 * no functional gain). Currency conversion is best-effort and NEVER blocks
 * the page: rates come from a free, no-key API fetched at most once a day
 * and cached locally, degrading to manual entry if the fetch fails — see
 * this file's own history in CLAUDE.md for the full reasoning.
 *
 * Page order (user-specified 2026-09-04): Net worth summary + Exchange
 * rates side by side, a grid of per-currency account summaries, the new
 * Net Worth 2-in-1 interactive chart + Monthly summary table (moved here
 * from Budget Planner, both windowed and grouped per currency — see
 * `NetWorthMonthlySection` below), then supplementary content (capital
 * split, rentals info, cloud-sync notice) that wasn't part of the
 * requested reordering. */
export function NetWorthPage({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const cashEntries = useCashWorkbookStore((s) => s.workbook.entries);
  const cashSettings = useCashWorkbookStore((s) => s.workbook.settings);
  const updateCashSettings = useCashWorkbookStore((s) => s.updateSettings);
  const plannedCash = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const bank = useBankWorkbookStore((s) => s.workbook);
  const updateBankAccount = useBankWorkbookStore((s) => s.updateAccount);
  const creditCardsWb = useCreditCardWorkbookStore((s) => s.workbook);
  const plannedBank = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const rentals = useRentalsWorkbookStore((s) => s.workbook);
  const plannedRentals = usePlannedRentalsWorkbookStore((s) => s.workbook.entries);
  const subscriptions = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const personalLoans = usePersonalLoansWorkbookStore((s) => s.workbook);
  const updatePersonalLoan = usePersonalLoansWorkbookStore((s) => s.updateLoan);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const updateEmiLoan = useEMIWorkbookStore((s) => s.updateEntry);
  const funds = useFundsWorkbookStore((s) => s.workbook);
  const setFundsWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const qse = useWorkbookStore((s) => s.workbook);
  const updateQseSettings = useWorkbookStore((s) => s.updateSettings);
  const psx = usePSXWorkbookStore((s) => s.workbook);
  const updatePsxSettings = usePSXWorkbookStore((s) => s.updateSettings);

  // User-requested (2026-08-26): renewal/expiry alerts on the "homepage" —
  // a 14-day glance window, broader than any one subscription's own
  // configured alert lead time (which might be shorter, or unset), so this
  // stays useful even for a subscription with no alerts configured at all.
  const renewalsSoon = upcomingRenewals(subscriptions, 14);
  // User-reported (2026-09-09): "Stocks Dashboard: Those Rail Cards should
  // actually be in main dashboard. They are more relevant here." The rail's
  // own "Net worth" mini-card (DashboardRail.tsx) would just duplicate this
  // whole page, so only its "Upcoming" panel — genuinely not shown anywhere
  // on this page before — moved here; the rail itself was removed from
  // QSE's/PSX's Dashboard entirely.
  const upcomingItems = useUpcomingItems(14);

  // Charts on this page recompute their CSS-var-derived colors only when
  // this component re-renders — same reasoning as every other chart-bearing
  // page (Dashboard, Analytics, PositionDetail).
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const rentalsNet = rentalsNetIncomeByCurrency(rentals.settings.properties, rentals.entries);

  // Item 3 of a 2026-08-26 feedback batch: "Default currency should be
  // logical" — `useLastCurrency` already remembers whatever the user picks
  // for next time, but its FIRST-EVER default was a hardcoded 'USD' even
  // for a user who's never touched USD at all. Default instead to whichever
  // currency the user actually has the largest (absolute) net exposure in —
  // a much more likely "the one they care about" than an arbitrary global
  // default — falling back to 'USD' only when there's no data yet to judge by.
  const { rows, biggestExposureCurrency } = useNetWorthSummary();
  const [preferredCurrency, setPreferredCurrency] = useLastCurrency('net-worth-preferred', biggestExposureCurrency);
  // User-reported (2026-09-09): "Dashboard Net Worth Summary still lists
  // global currencies rather than user's." The "Show total in" picker used
  // to map over the whole `CURRENCIES` catalog (~25 currencies) instead of
  // the same enabled/held-currency list every other picker in the app
  // already uses (`AccountFormFields`, etc.) — this is that same list.
  const preferredCurrencyOptions = useEnabledCurrencies(preferredCurrency);

  const categories = useCategoryStore((s) => s.workbook.categories);
  // User-reported (2026-09-04): "Inter-account transfers are counting as
  // income; bad idea" — `links` excludes both sides of any cross-entity
  // linked transfer from the flow calculation entirely (see
  // `budgetPlanner.ts`'s own `linkedRecordKeys` doc comment).
  const activities = useMemo(
    () => collectBudgetActivities({
      cashEntries, plannedCash,
      bankAccounts: bank.settings.accounts, bankTransactions: bank.transactions, plannedBank,
      rentalProperties: rentals.settings.properties, rentalEntries: rentals.entries, plannedRentals,
      categories, links,
    }),
    [cashEntries, plannedCash, bank, plannedBank, rentals, plannedRentals, categories, links],
  );

  const netWorthAsOfInputs: NetWorthAsOfInputs = useMemo(() => ({
    cashEntries, cashSettings,
    bankAccounts: bank.settings.accounts, bankTransactions: bank.transactions,
    creditCards: creditCardsWb.cards, creditCardTransactions: creditCardsWb.transactions,
    personalLoans: personalLoans.loans, personalLoanRepayments: personalLoans.repayments,
    emiLoans,
    fundsFunds: funds.funds, fundsTransactions: funds.transactions, fundsPriceHistory: funds.priceHistory,
    qseTransactions: qse.transactions, qseTransfers: qse.transfers, qseAdjustments: qse.adjustments,
    qsePriceHistory: qse.priceHistory, qseSettings: qse.settings,
    psxTransactions: psx.transactions, psxTransfers: psx.transfers, psxAdjustments: psx.adjustments,
    psxPriceHistory: psx.priceHistory, psxSettings: psx.settings,
  }), [cashEntries, cashSettings, bank, creditCardsWb, personalLoans, emiLoans, funds, qse, psx]);

  const [rates, setRates] = useState<FxRates | null>(() => loadCachedFxRates());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  // Item 3: FX entry used to be locked to "1 USD = X" — the internal rate
  // table stays USD-anchored (unchanged, and correct — see setCrossRate's
  // own comment for why), but the user can now set a rate between ANY two
  // currencies they actually hold; From/To default to the two currencies
  // most likely relevant (biggest exposure + preferred).
  const currencyCodes = [...new Set([...rows.map((r) => r.currency), preferredCurrency, 'USD'])];
  const [rateFrom, setRateFrom] = useState(currencyCodes[0] || 'USD');
  const [rateTo, setRateTo] = useState(currencyCodes.find((c) => c !== rateFrom) || 'USD');
  const [crossRateValue, setCrossRateValue] = useState('');

  const refresh = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const fresh = await fetchFxRates();
      saveFxRates(fresh);
      setRates(fresh);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Could not reach the rate provider.');
    } finally {
      setFetching(false);
    }
  };

  // Auto-refresh once on mount if the cache is missing/stale — silent
  // failure is fine here, the manual-entry UI covers it either way.
  useEffect(() => {
    if (isFxStale(rates)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Item 1/3 (earlier pass): picking a currency here used to always start
  // the Rate field blank, forcing the user to type a value from scratch
  // even when a rate (auto-fetched or previously entered by hand) is
  // already known for it — prefill with the current known cross-rate
  // between whatever From/To is currently selected.
  const onRateFromChange = (code: string) => {
    setRateFrom(code);
    const known = effectiveRate(code, rateTo, rates);
    setCrossRateValue(known !== null ? String(known) : '');
  };
  const onRateToChange = (code: string) => {
    setRateTo(code);
    const known = effectiveRate(rateFrom, code, rates);
    setCrossRateValue(known !== null ? String(known) : '');
  };

  const applyCrossRate = () => {
    const value = Number(crossRateValue);
    if (!rateFrom || !rateTo || rateFrom === rateTo || !value || value <= 0) {
      return toast('Pick two different currencies and a positive rate.');
    }
    const next = setCrossRate(rateFrom, rateTo, value, rates);
    if (!next) {
      return toast(`No known rate for ${rateFrom} yet — set its rate against USD first, or pick USD as one side.`);
    }
    saveFxRates(next);
    setRates(next);
    toast(`Rate saved: 1 ${rateFrom} = ${value} ${rateTo}.`);
  };

  let grandTotal = 0;
  const unconverted: string[] = [];
  rows.forEach((r) => {
    const converted = convertAmount(r.net, r.currency, preferredCurrency, rates);
    if (converted === null) unconverted.push(r.currency);
    else grandTotal += converted;
  });

  // Item 5 of a 2026-08-26 feedback batch: additional summary stats —
  // total debts across every currency (converted where possible, same
  // "skip what can't convert" degradation as the grand total above), plus
  // today's and this month's net cash movement. All three, like the grand
  // total, are only ever a converted SUM shown alongside the per-currency
  // real figures — never a silent replacement for them.
  let totalDebts = 0;
  const debtsUnconverted: string[] = [];
  rows.forEach((r) => {
    if (!r.liabilities) return;
    const converted = convertAmount(r.liabilities, r.currency, preferredCurrency, rates);
    if (converted === null) debtsUnconverted.push(r.currency);
    else totalDebts += converted;
  });

  const todayISO = today();
  const monthStart = `${todayISO.slice(0, 7)}-01`;
  const todayFlow = flowByCurrency(cashEntries, bank.settings.accounts, bank.transactions, todayISO, todayISO);
  const monthFlow = flowByCurrency(cashEntries, bank.settings.accounts, bank.transactions, monthStart, todayISO);
  const sumFlow = (flow: Record<string, number>) => {
    let total = 0;
    let anyUnconverted = false;
    Object.entries(flow).forEach(([code, amount]) => {
      const converted = convertAmount(amount, code, preferredCurrency, rates);
      if (converted === null) anyUnconverted = true;
      else total += converted;
    });
    return { total, anyUnconverted };
  };
  const todayFlowTotal = sumFlow(todayFlow);
  const monthFlowTotal = sumFlow(monthFlow);

  // User-requested (2026-09-09): "month Intial minus last balance can tell
  // the Net Worth while current - previous month worth can tell a month's
  // positive/-negative impact + number + percentage." Distinct from
  // `monthFlowTotal` above — that's CASH FLOW (Cash/Bank money in/out this
  // month); this is the real NET WORTH itself (assets minus liabilities,
  // every module) at the end of last month vs. right now, so it also
  // captures things flow doesn't: a stock's price move, an EMI loan's
  // principal paydown, a Fund's NAV change. Reuses `netWorthAsOfDate` —
  // the same real (not projected) past-month computation the Monthly
  // Summary table below already uses — rather than a new calc path.
  // `null` (not 0) when there's no real prior-month data to compare
  // against yet (a brand-new account this month), so the UI can render
  // "not enough history yet" instead of a misleading "+100%".
  const lastMonthEndDate = (() => {
    const d = new Date(`${monthStart}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return endOfMonthAsOf(d.toISOString().slice(0, 7));
  })();
  const earliestActivity = earliestActivityDate(netWorthAsOfInputs);
  const hasLastMonthData = !!earliestActivity && earliestActivity <= lastMonthEndDate;
  // Per-currency version of the same figure — user-reported (2026-09-09):
  // "Per currency stats are missing like Today's net flow, This month's
  // net flow, This month's change" — the converted-to-preferred-currency
  // totals above were the only place these showed; each currency's own
  // section (below) never got them, unlike Assets/Liabilities/Net which
  // already show there in real, unconverted terms.
  const lastMonthByCurrency: Record<string, number> = {};
  let lastMonthTotal = 0;
  let lastMonthUnconverted = false;
  if (hasLastMonthData) {
    netWorthAsOfDate(lastMonthEndDate, netWorthAsOfInputs).forEach((r) => {
      lastMonthByCurrency[r.currency] = r.net;
      const converted = convertAmount(r.net, r.currency, preferredCurrency, rates);
      if (converted === null) lastMonthUnconverted = true;
      else lastMonthTotal += converted;
    });
  }
  const netWorthDelta = hasLastMonthData ? grandTotal - lastMonthTotal : null;
  const netWorthDeltaPct = netWorthDelta !== null && lastMonthTotal !== 0 ? (netWorthDelta / Math.abs(lastMonthTotal)) * 100 : null;

  // Item 4: "capital split per currency" — each currency's net worth
  // converted to the preferred currency for a like-for-like comparison
  // (a currency that can't convert is omitted from the chart, same
  // degradation as the grand total, rather than plotting a wrong number).
  // A doughnut can't meaningfully show a negative slice, so a currency
  // with negative net worth is left out of the chart specifically — it's
  // still fully visible in the per-currency cards and breakdown below.
  const splitData = rows
    .map((r) => ({ currency: r.currency, converted: convertAmount(r.net, r.currency, preferredCurrency, rates) }))
    .filter((r): r is { currency: string; converted: number } => r.converted !== null && r.converted > 0);

  const ownCurrencies = [...new Set(rows.map((r) => r.currency))].sort();

  // README Pending item 64: an on-demand snapshot (see
  // types/netWorthSnapshot.ts's own doc comment for the locked design
  // decisions). Kept as a manual save action, even though the "Net worth
  // over time" chart that used to read from it is retired below (README
  // Done item — see CLAUDE.md) in favor of the new real per-month
  // computation, which needs no saved snapshot at all to work for any
  // past month.
  const snapshots = useNetWorthSnapshotsWorkbookStore((s) => s.workbook.entries);
  const addSnapshot = useNetWorthSnapshotsWorkbookStore((s) => s.addEntry);
  const updateSnapshot = useNetWorthSnapshotsWorkbookStore((s) => s.updateEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const { user } = useAuthState();
  const todaysSnapshot = snapshots.find((s) => s.date === todayISO);

  useEffect(() => {
    if (!user || todaysSnapshot || !rows.length) return;
    const byCurrency: Record<string, number> = {};
    rows.forEach((r) => { byCurrency[r.currency] = r.net; });
    addSnapshot({ id: crypto.randomUUID(), date: todayISO, byCurrency });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, todaysSnapshot, todayISO]);

  const saveSnapshot = async () => {
    if (!(await ensureSignedIn('Sign in to save a net worth snapshot.'))) return;
    const byCurrency: Record<string, number> = {};
    rows.forEach((r) => { byCurrency[r.currency] = r.net; });
    if (todaysSnapshot) {
      updateSnapshot(todaysSnapshot.id, { byCurrency });
      toast('Updated today\'s net worth snapshot.');
    } else {
      addSnapshot({ id: crypto.randomUUID(), date: todayISO, byCurrency });
      toast('Net worth snapshot saved.');
    }
  };

  // Shared sign-in gate for every "Include in Net Worth" checkbox below —
  // same pattern as the existing per-entity Archive/Restore toggles
  // (Bank/EMI/Personal Loans/Funds), just one helper instead of repeating
  // the `ensureSignedIn` call at 7 different call sites.
  const toggleInclude = async (setter: () => void) => {
    if (!(await ensureSignedIn('Sign in to change what counts toward Net Worth.'))) return;
    setter();
  };

  return (
    <div>
      <h1>Dashboard</h1>

      {/* User-requested (2026-08-26): subscription renewal/expiry alerts on
          the "homepage" — a compact list, not the full per-subscription
          detail (which lives on the Subscriptions page itself). */}
      {renewalsSoon.length > 0 && (
        <Notice tone="warning" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {renewalsSoon.length} subscription{renewalsSoon.length > 1 ? 's' : ''} renewing in the next 14 days
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {renewalsSoon.map((r) => (
              <span key={r.subscription.id}>
                {r.subscription.name} — {fmtMoney(r.subscription.amount, r.subscription.currencyCode)} on {r.date}
              </span>
            ))}
          </div>
          <Link to="/subscriptions" className="text-muted" style={{ display: 'inline-block', marginTop: 6 }}>Manage subscriptions →</Link>
        </Notice>
      )}

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Upcoming</h3>} style={{ marginBottom: 16 }} defaultOpen={upcomingItems.length > 0}>
        <UpcomingList items={upcomingItems} limit={8} emptyText="Nothing expected in the next 14 days." />
        <Link to="/planning" className="text-muted" style={{ display: 'block', marginTop: 10 }}>See all →</Link>
      </CollapsibleCard>

      {/* Items 2/3/4/5 of a 2026-08-26 follow-up batch: two separate,
          roughly-equal Cards side by side — "Net worth summary" (the
          currency picker grouped directly with the big number it controls)
          and "Exchange rates" (its own Card, with a From/To pair). */}
      <div className="grid-auto" style={{ ...gridAutoStyle(320, 16), marginBottom: 16, alignItems: 'start' }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Net worth summary</h3>
          <Field label="Show total in" width={150}>
            <Select value={preferredCurrency} onChange={(e) => setPreferredCurrency(e.target.value)} width={150}>
              {preferredCurrencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </Field>
          <div style={{ marginTop: 12 }}>
            <StatCard label={`Estimated net worth (${preferredCurrency})`} value={fmtMoney(grandTotal, preferredCurrency)} hue={grandTotal >= 0 ? 'var(--profit)' : 'var(--loss)'} />
          </div>
          <button type="button" className="btn secondary small" style={{ marginTop: 8 }} onClick={saveSnapshot}>
            {todaysSnapshot ? 'Update today\'s snapshot' : 'Save snapshot'}
          </button>
          {unconverted.length > 0 && (
            <div className="text-muted" style={{ marginTop: 8 }}>
              No {preferredCurrency} rate available for {unconverted.join(', ')} — those currencies' totals
              aren't included above; see their own sections below for real figures.
            </div>
          )}
          <div className="grid-auto" style={{ ...gridAutoStyle(140, 8), marginTop: 12 }}>
            <StatCard
              label="Total debts"
              value={fmtMoney(totalDebts, preferredCurrency)}
              hue={totalDebts > 0 ? 'var(--loss)' : HUES[4]}
              title={debtsUnconverted.length ? `Excludes ${debtsUnconverted.join(', ')} — no rate available.` : undefined}
            />
            <StatCard
              label="Today's net flow"
              value={fmtMoney(todayFlowTotal.total, preferredCurrency)}
              hue={todayFlowTotal.total >= 0 ? 'var(--profit)' : 'var(--loss)'}
              title={todayFlowTotal.anyUnconverted ? 'Some currencies excluded — no rate available.' : undefined}
              labelTitle="Net money moved in/out of Cash and Bank today, converted to the preferred currency."
            />
            <StatCard
              label="This month's net flow"
              value={fmtMoney(monthFlowTotal.total, preferredCurrency)}
              hue={monthFlowTotal.total >= 0 ? 'var(--profit)' : 'var(--loss)'}
              title={monthFlowTotal.anyUnconverted ? 'Some currencies excluded — no rate available.' : undefined}
              labelTitle="Net money moved in/out of Cash and Bank since the 1st of this month, converted to the preferred currency."
            />
            {netWorthDelta !== null ? (
              <StatCard
                label="This month's change"
                value={`${netWorthDelta >= 0 ? '+' : ''}${fmtMoney(netWorthDelta, preferredCurrency)}`}
                sub={netWorthDeltaPct !== null ? `${netWorthDeltaPct >= 0 ? '+' : ''}${netWorthDeltaPct.toFixed(1)}% vs. last month` : undefined}
                hue={netWorthDelta >= 0 ? 'var(--profit)' : 'var(--loss)'}
                title={lastMonthUnconverted ? 'Some currencies excluded from last month\'s total — no rate available.' : undefined}
                labelTitle="Your real net worth right now minus your real net worth at the end of last month — the whole picture (assets and liabilities across every module), not just cash moved."
              />
            ) : (
              <StatCard
                label="This month's change"
                value="—"
                sub="Not enough history yet"
                hue={HUES[4]}
                labelTitle="Needs at least one full prior month of real data to compare against."
              />
            )}
          </div>
        </Card>

        {/* User-reported (2026-09-09): "Exchange rates should only be
           visible if the user chooses multiple currencies" — converting
           between currencies is meaningless with only one, and the card
           was permanently visible regardless. Gated on `ownCurrencies`
           (currencies with real data), the same list already used for the
           "Rates between your own currencies" table further down. */}
        {ownCurrencies.length > 1 && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Exchange rates</h3>
          <div className="text-muted">
            {rates
              ? `Rates as of ${new Date(rates.fetchedAt).toLocaleString()} (${rates.source === 'api' ? 'auto-fetched' : 'manually entered'}).`
              : 'No exchange rates loaded yet.'}
            {fetchError && ` Auto-fetch failed: ${fetchError} — enter a rate manually below.`}
          </div>
          <button type="button" className="btn-link" onClick={refresh} disabled={fetching} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, marginTop: 2 }}>
            {fetching ? 'Refreshing…' : 'Refresh rates'}
          </button>

          <div style={{ marginTop: 12 }}>
            <div className="text-muted" style={{ marginBottom: 4 }}>Set a rate between any two currencies</div>
            <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
              <Field label="1 unit of">
                <Select value={rateFrom} onChange={(e) => onRateFromChange(e.target.value)} width={110}>
                  {currencyCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="equals">
                <TextInput type="number" step="0.0001" placeholder="Rate" value={crossRateValue} onChange={(e) => setCrossRateValue(e.target.value)} style={{ width: 100 }} />
              </Field>
              <Field label="of">
                <Select value={rateTo} onChange={(e) => onRateToChange(e.target.value)} width={110}>
                  {currencyCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <button type="button" className="btn" onClick={applyCrossRate}>Save rate</button>
            </div>
          </div>

          {ownCurrencies.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div className="text-muted" style={{ marginBottom: 4 }}>Rates between your own currencies</div>
              {ownCurrencies.flatMap((a) =>
                ownCurrencies.filter((b) => b > a).map((b) => {
                  const rAB = effectiveRate(a, b, rates);
                  const rBA = effectiveRate(b, a, rates);
                  return (
                    <div key={`${a}-${b}`} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="text-muted">1 {a} =</span>
                        <span style={{ fontFamily: 'var(--mono)' }}>{rAB !== null ? `${rAB.toFixed(4)} ${b}` : `— ${b} (no rate yet)`}</span>
                      </div>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="text-muted">1 {b} =</span>
                        <span style={{ fontFamily: 'var(--mono)' }}>{rBA !== null ? `${rBA.toFixed(4)} ${a}` : `— ${a} (no rate yet)`}</span>
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          )}
        </Card>
        )}
      </div>

      {/* User-reported (2026-09-06), correcting the previous round's own
         layout: "USE GRID FOR ALL NON_TABLE DATA... YOU DUMPED THE WHOLE
         CHECKLIST VERTICALLY on the main page instead of inline chips/
         checkboxes WITH USE A FAB + POPUP TO UPDATE THIS USER PREFERENCE."
         This is a Rare-tier settings control (per this app's own Main/
         Often/Rare model) — it belongs behind a FAB + Modal, same as every
         other rarely-touched per-entity toggle in this app, not a
         permanently-visible card. Each group of entities is now a wrapping
         row of `.chip` toggle buttons (the exact pattern `ChartFilterBar`'s
         ticker filter already established) instead of one checkbox per
         line. */}
      <IncludeInNetWorthFab
        cashSettings={cashSettings} updateCashSettings={updateCashSettings}
        qseSettings={qse.settings} updateQseSettings={updateQseSettings}
        psxSettings={psx.settings} updatePsxSettings={updatePsxSettings}
        bankAccounts={bank.settings.accounts} updateBankAccount={updateBankAccount}
        personalLoans={personalLoans.loans} updatePersonalLoan={updatePersonalLoan}
        emiLoans={emiLoans} updateEmiLoan={updateEmiLoan}
        funds={funds} setFundsWorkbook={setFundsWorkbook}
        toggleInclude={toggleInclude}
      />

      {rows.length === 0 && (
        <Card><div className="text-muted">No balances recorded yet across any account.</div></Card>
      )}

      {/* Grid of per-currency account summaries (user-specified order,
          2026-09-04) — a responsive grid lets 2-3 currency sections sit
          side by side on a wide viewport instead of stacking. */}
      <div className="grid-auto" style={{ ...gridAutoStyle(360, 12), marginBottom: 16 }}>
        {rows.map((r) => {
          const converted = convertAmount(r.net, r.currency, preferredCurrency, rates);
          const todayFlowC = todayFlow[r.currency] ?? 0;
          const monthFlowC = monthFlow[r.currency] ?? 0;
          const lastMonthC = lastMonthByCurrency[r.currency];
          const deltaC = lastMonthC !== undefined ? r.net - lastMonthC : null;
          const deltaPctC = deltaC !== null && lastMonthC !== 0 ? (deltaC / Math.abs(lastMonthC)) * 100 : null;
          return (
            <details key={r.currency} open className="card" style={{ padding: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
                {r.currency} — {fmtMoney(r.net, r.currency)}
                {converted !== null && r.currency !== preferredCurrency && (
                  <span className="text-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                    ≈ {fmtMoney(converted, preferredCurrency)}
                  </span>
                )}
              </summary>
              <div className="row" style={{ gap: 12, marginTop: 12 }}>
                <div className="stat-card card" style={hueStyle(r.assets >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Assets</div><MoneyValue n={r.assets} currency={r.currency} /></div>
                <div className="stat-card card" style={hueStyle('var(--loss)')}><div className="label">Liabilities</div><MoneyValue n={r.liabilities} currency={r.currency} /></div>
                <div className="stat-card card" style={hueStyle(r.net >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Net</div><MoneyValue n={r.net} currency={r.currency} /></div>
              </div>
              {/* User-reported (2026-09-09): "Per currency stats are
                 missing like Today's net flow, This month's net flow,
                 This month's change" — compact chips (not another row of
                 full stat-cards, per the same report: "making the whole
                 td red/green is bad idea, instead we can make it compact
                 chip-like info") mirroring the converted totals shown up
                 in the Net worth summary card, but in this currency's own
                 real, unconverted terms. */}
              <div className="row" style={{ gap: 6, marginTop: 10, alignItems: 'center' }}>
                <Tooltip text="Net money moved in/out of Cash and Bank today, in this currency.">
                  <span className={`pill ${todayFlowC >= 0 ? 'pill-positive' : 'pill-negative'}`}>
                    Today {todayFlowC >= 0 ? '+' : ''}{fmtMoney(todayFlowC, r.currency)}
                  </span>
                </Tooltip>
                <Tooltip text="Net money moved in/out of Cash and Bank since the 1st of this month, in this currency.">
                  <span className={`pill ${monthFlowC >= 0 ? 'pill-positive' : 'pill-negative'}`}>
                    This month {monthFlowC >= 0 ? '+' : ''}{fmtMoney(monthFlowC, r.currency)}
                  </span>
                </Tooltip>
                {deltaC !== null ? (
                  <Tooltip text="This currency's real net worth right now minus its real net worth at the end of last month.">
                    <span className={`pill ${deltaC >= 0 ? 'pill-positive' : 'pill-negative'}`}>
                      Δ vs. last month {deltaC >= 0 ? '+' : ''}{fmtMoney(deltaC, r.currency)}
                      {deltaPctC !== null ? ` (${deltaPctC >= 0 ? '+' : ''}${deltaPctC.toFixed(1)}%)` : ''}
                    </span>
                  </Tooltip>
                ) : (
                  <span className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>
                    Δ vs. last month — not enough history
                  </span>
                )}
              </div>
              {r.breakdown.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="text-muted" style={{ marginBottom: 4 }}>By account</div>
                  <div className="grid-auto" style={gridAutoStyle(120, 6)}>
                    {r.breakdown.map((b) => (
                      <div key={b.module} className="stat-card card" style={hueStyle(b.amount >= 0 ? 'var(--profit)' : 'var(--loss)')}>
                        <div className="label">{b.module}</div>
                        <MoneyValue n={b.amount} currency={r.currency} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </details>
          );
        })}
      </div>

      {/* User-requested (2026-09-04): the Net Worth 2-in-1 interactive
          chart + Budget Planner's Monthly summary widget, moved here in
          full — see `NetWorthMonthlySection` below. */}
      <NetWorthMonthlySection
        ownCurrencies={ownCurrencies}
        activities={activities}
        emiLoans={emiLoans}
        currentRows={rows}
        netWorthAsOfInputs={netWorthAsOfInputs}
        todayISODate={todayISO}
      />

      {/* Item 4: "add charts to view capital split per currency" —
          supplementary content, not part of the requested reordering. */}
      {splitData.length > 1 && (
        <ChartCard title={`Capital split by currency (converted to ${preferredCurrency})`} empty={false}>
          <div style={{ height: 220 }}>
            <Doughnut
              data={{
                labels: splitData.map((d) => d.currency),
                datasets: [{ data: splitData.map((d) => d.converted), backgroundColor: HUES }],
              }}
              options={{ plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, preferredCurrency)) } }}
            />
          </div>
        </ChartCard>
      )}

      {Object.keys(rentalsNet).length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <div className="label" style={{ marginBottom: 8 }}>Rental net income (informational — not included above)</div>
          <div className="text-muted" style={{ marginBottom: 8 }}>
            Property values aren't tracked in this app, and rental income already lands in whichever Cash/Bank
            account it was deposited to — counting it again here would double-count it.
          </div>
          <div className="row" style={{ gap: 12 }}>
            {Object.entries(rentalsNet).map(([code, amount]) => (
              <div key={code} className="stat-card card"><div className="label">{code}</div><MoneyValue n={amount} currency={code} /></div>
            ))}
          </div>
        </Card>
      )}

      {firebaseReady && cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 12 }}>
          <p style={{ marginTop: 0 }}>No net worth snapshots found in the cloud for this account. This won't upload automatically.</p>
          <button
            className="btn secondary"
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
                `Upload ${snapshots.length} local snapshot${snapshots.length === 1 ? '' : 's'} to the cloud?`,
              );
              if (!ok) return;
              try {
                await uploadLocalToCloud();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Something went wrong.');
              }
            }}
          >
            Upload local data to cloud ({snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'})
          </button>
        </Notice>
      )}
    </div>
  );
}

/** A single toggleable `.chip` — the exact pattern `ChartFilterBar`'s
 * ticker filter already established, reused here instead of a vertical
 * `<label><input type="checkbox">` stack (see `IncludeInNetWorthFab`'s own
 * doc comment for why). */
function IncludeChip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`chip${checked ? ' active' : ''}`} onClick={onToggle}>
      {checked && <CheckIcon size={11} />}{label}
    </button>
  );
}

/** User-reported (2026-09-06), correcting the previous round's own layout:
 * "USE GRID FOR ALL NON_TABLE DATA... YOU DUMPED THE WHOLE CHECKLIST
 * VERTICALLY on the main page instead of inline chips/checkboxes WITH USE
 * A FAB + POPUP TO UPDATE THIS USER PREFERENCE." Per this app's own Main/
 * Often/Rare content model, "which accounts count toward Net Worth" is a
 * Rare-tier setting (touched occasionally, not glanced at every visit) —
 * it belongs behind a FAB + Modal like every other rarely-used per-entity
 * toggle in this app (Archive/Restore, "Link to bank," etc.), not
 * permanently occupying page space. Each entity group renders as a
 * wrapping row of `IncludeChip`s instead of one checkbox per line. */
function IncludeInNetWorthFab({
  cashSettings, updateCashSettings,
  qseSettings, updateQseSettings,
  psxSettings, updatePsxSettings,
  bankAccounts, updateBankAccount,
  personalLoans, updatePersonalLoan,
  emiLoans, updateEmiLoan,
  funds, setFundsWorkbook,
  toggleInclude,
}: {
  cashSettings: CashSettings; updateCashSettings: (patch: Partial<CashSettings>) => void;
  qseSettings: QSESettings; updateQseSettings: (patch: Partial<QSESettings>) => void;
  psxSettings: PSXSettings; updatePsxSettings: (patch: Partial<PSXSettings>) => void;
  bankAccounts: BankAccount[]; updateBankAccount: (id: string, patch: Partial<BankAccount>) => void;
  personalLoans: PersonalLoan[]; updatePersonalLoan: (id: string, patch: Partial<PersonalLoan>) => void;
  emiLoans: EMILoan[]; updateEmiLoan: (id: string, patch: Partial<EMILoan>) => void;
  funds: FundsWorkbook; setFundsWorkbook: (wb: FundsWorkbook) => void;
  toggleInclude: (setter: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleFund = (f: Fund) =>
    toggleInclude(() => setFundsWorkbook({ ...funds, funds: funds.funds.map((x) => (x.id === f.id ? { ...x, includeInNetWorth: x.includeInNetWorth === false } : x)) }));

  return (
    <>
      <FabButton label="Include in Net Worth" onClick={() => setOpen(true)}><SettingsIcon size={18} /></FabButton>
      {open && (
        <Modal title="Include in Net Worth" onClose={() => setOpen(false)}>
          <p className="text-muted" style={{ marginTop: 0 }}>
            Unchecked items are left out of every total on this page — e.g. an EMI loan you closed
            early that the schedule still thinks is owed.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <IncludeChip label="Cash" checked={cashSettings.includeInNetWorth !== false} onToggle={() => toggleInclude(() => updateCashSettings({ includeInNetWorth: cashSettings.includeInNetWorth === false }))} />
              <IncludeChip label="Stock Exchanges (QSE)" checked={qseSettings.includeInNetWorth !== false} onToggle={() => toggleInclude(() => updateQseSettings({ includeInNetWorth: qseSettings.includeInNetWorth === false }))} />
              <IncludeChip label="Stock Exchanges (PSX)" checked={psxSettings.includeInNetWorth !== false} onToggle={() => toggleInclude(() => updatePsxSettings({ includeInNetWorth: psxSettings.includeInNetWorth === false }))} />
            </div>

            {bankAccounts.length > 0 && (
              <div>
                <div className="text-muted" style={{ marginBottom: 6, fontWeight: 600 }}>Banking</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {bankAccounts.map((a) => (
                    <IncludeChip key={a.id} label={`${a.name} (${a.currencyCode})`} checked={a.includeInNetWorth !== false} onToggle={() => toggleInclude(() => updateBankAccount(a.id, { includeInNetWorth: a.includeInNetWorth === false }))} />
                  ))}
                </div>
              </div>
            )}

            {personalLoans.length > 0 && (
              <div>
                <div className="text-muted" style={{ marginBottom: 6, fontWeight: 600 }}>Personal Loans</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {personalLoans.map((l) => (
                    <IncludeChip key={l.id} label={`${l.person} (${l.currencyCode})`} checked={l.includeInNetWorth !== false} onToggle={() => toggleInclude(() => updatePersonalLoan(l.id, { includeInNetWorth: l.includeInNetWorth === false }))} />
                  ))}
                </div>
              </div>
            )}

            {emiLoans.length > 0 && (
              <div>
                <div className="text-muted" style={{ marginBottom: 6, fontWeight: 600 }}>EMI / Loans</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {emiLoans.map((l) => (
                    <IncludeChip key={l.id} label={`${l.name} (${l.currencyCode})`} checked={l.includeInNetWorth !== false} onToggle={() => toggleInclude(() => updateEmiLoan(l.id, { includeInNetWorth: l.includeInNetWorth === false }))} />
                  ))}
                </div>
              </div>
            )}

            {funds.funds.length > 0 && (
              <div>
                <div className="text-muted" style={{ marginBottom: 6, fontWeight: 600 }}>Funds</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {funds.funds.map((f) => (
                    <IncludeChip key={f.id} label={`${f.name} (${f.currencyCode})`} checked={f.includeInNetWorth !== false} onToggle={() => toggleFund(f)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/** User-requested (2026-09-04): "Create a chart of this table as well on
 * Net Worth Page. 2-in-one stacked bar chart of Assets vs Liabilities +
 * net worth, with a line chart showing the monthly trend... charts should
 * be interactive like Budget Planner: Monthly summary instead of 60 years
 * of a man's life messed in a single chart." Moved (not duplicated) from
 * `BudgetPlannerPage.tsx` — see that file's own doc comment. One shared
 * ◀ Earlier/Today/Later ▶ window (default 3 past + current + 2 future
 * months) governs BOTH the chart grid and the table grid below it, exactly
 * like Budget Planner's own single scroll control used to.
 *
 * "Just like the grid of accounts summary per currency, each chart and
 * table should show for all currencies in a grid instead of toggling" —
 * both the chart grid and the table grid render ONE item per currency the
 * user actually holds (`ownCurrencies`), no currency picker at all. */
/** Earliest real calendar month across every dated record this page reads
 * — `earliestActivityDate` covers Cash/Bank/Personal Loans/EMI/Funds/QSE/
 * PSX, and Rentals (which never counts toward Net Worth itself, but its
 * dates still appear in the Income/Expense row via `activities`) is folded
 * in separately here since it isn't part of `NetWorthAsOfInputs`. */
function floorMonthOf(inputs: NetWorthAsOfInputs, activities: BudgetActivity[]): string | undefined {
  const dates = [earliestActivityDate(inputs), ...activities.map((a) => a.date)].filter((d): d is string => !!d);
  return dates.length ? dates.reduce((min, d) => (d < min ? d : min)).slice(0, 7) : undefined;
}

function NetWorthMonthlySection({
  ownCurrencies,
  activities,
  emiLoans,
  currentRows,
  netWorthAsOfInputs,
  todayISODate,
}: {
  ownCurrencies: string[];
  activities: ReturnType<typeof collectBudgetActivities>;
  emiLoans: Parameters<typeof projectedNetWorthTrend>[0]['emiLoans'];
  currentRows: Parameters<typeof projectedNetWorthTrend>[0]['currentRows'];
  netWorthAsOfInputs: NetWorthAsOfInputs;
  todayISODate: string;
}) {
  const nowMonth = useMemo(() => currentMonthOf(), []);
  // User-reported (2026-09-06): "monthly widgets are moving without a check
  // of user's first date of transaction" — `windowStart` used to default to
  // a hardcoded -3 and "◀ Earlier" could scroll indefinitely into the past,
  // well before the user had any real data at all (which the phantom-
  // opening-balance bug fixed in `netWorthAsOfDate` would then show as
  // misleading nonzero figures). `floorWindowStart` is the earliest offset
  // any real record justifies; the window never starts, nor scrolls,
  // earlier than that.
  const floorMonth = useMemo(() => floorMonthOf(netWorthAsOfInputs, activities), [netWorthAsOfInputs, activities]);
  const floorWindowStart = floorMonth ? monthsBetween(nowMonth, floorMonth) : -3;
  const [windowStart, setWindowStart] = useState(() => Math.max(-3, floorWindowStart));
  const months = useMemo(() => monthRange(windowStart, windowStart + 5), [windowStart]);
  const monthly = useMemo(() => monthlyIncomeExpense(activities, months), [activities, months]);
  const trend = useMemo(
    () => projectedNetWorthTrend({ months, currentMonth: nowMonth, todayISODate, currentRows, activities, emiLoans, netWorthAsOfInputs }),
    [months, nowMonth, todayISODate, currentRows, activities, emiLoans, netWorthAsOfInputs],
  );

  if (!ownCurrencies.length) return null;

  const atFloor = windowStart <= floorWindowStart;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button
          className="btn secondary small"
          disabled={atFloor}
          title={atFloor ? 'No data before this — this is as far back as your earliest transaction goes.' : undefined}
          onClick={() => setWindowStart((w) => Math.max(floorWindowStart, w - 1))}
        >
          ◀ Earlier
        </button>
        <button className="btn secondary small" onClick={() => setWindowStart(Math.max(-3, floorWindowStart))}>Today</button>
        <button className="btn secondary small" onClick={() => setWindowStart((w) => w + 1)}>Later ▶</button>
      </div>

      <div className="grid-auto" style={{ ...gridAutoStyle(380, 16), marginBottom: 16 }}>
        {ownCurrencies.map((currency) => (
          <NetWorthComboChart key={currency} currency={currency} months={months} trend={trend} />
        ))}
      </div>

      {/* User-reported (2026-09-09): "Tables should have 100% width...
         unable to read the tables in SS" — this table was one of the
         concrete examples: side-by-side in a 420px grid column left almost
         no room to show more than 2-3 of its 6 months before `.table-scroll`
         kicked in, which is exactly what made the screenshot look broken.
         Stacked full-width instead — each currency's table gets the whole
         page width, only falling back to horizontal scroll if it still
         doesn't fit. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ownCurrencies.map((currency) => (
          <MonthlySummaryTable key={currency} currency={currency} months={months} nowMonth={nowMonth} monthly={monthly} trend={trend} />
        ))}
      </div>
    </div>
  );
}

/** The "2-in-1" chart: stacked Assets (positive)/Liabilities (negative)
 * bars with a Net Worth line overlaid on the same canvas — via `<Bar>`'s
 * per-dataset `type: 'line'` override (needs `BarController`/
 * `LineController` both registered, see `chartSetup.ts`). Liabilities
 * plotted as a NEGATIVE number so the stack diverges from a zero baseline
 * (assets up, liabilities down) — the stacked total then naturally equals
 * Net Worth, which the line dataset also plots explicitly.
 *
 * User-reported (2026-09-06): "Make chart colours transparent, not solid.
 * they are Hiding lines." The bar fills were fully opaque `--profit`/
 * `--loss`, so wherever the Net Worth line's own y-value fell inside a
 * bar's own drawn area, the solid bar painted over it. Fixed with a
 * hex+alpha suffix (`B3` ≈ 70% opacity — same "#RRGGBB + 2-digit alpha
 * hex" technique `chartLabels.ts`'s `dimColor()` already uses) on both
 * bar fills, so the line stays visible through them regardless of Chart.js's
 * own draw order between a mixed bar/line dataset pair; the line itself
 * also got a slightly heavier `borderWidth` so it reads clearly as the
 * foreground series. */
function NetWorthComboChart({ currency, months, trend }: { currency: string; months: string[]; trend: MonthlyNetWorthPoint[] }) {
  const byMonth = new Map(trend.map((t) => [t.month, t]));
  return (
    <ChartCard title={`Net worth — ${currency}`}>
      <Chart
        type="bar"
        data={{
          labels: months.map(monthLabel),
          // Mixed bar+line datasets on one canvas: Chart.js supports a
          // per-dataset `type` override (needs BarController+LineController
          // both registered, see chartSetup.ts) — react-chartjs-2's generic
          // <Chart type="bar"> component (unlike the narrower <Bar>) accepts
          // a mixed 'bar' | 'line' dataset array once explicitly annotated.
          datasets: [
            {
              type: 'bar', label: 'Assets', stack: 'nw',
              data: months.map((m) => byMonth.get(m)?.assetsByCurrency[currency] ?? null),
              backgroundColor: withAlpha(cssVar('--profit'), '#3ecf8e'),
            },
            {
              type: 'bar', label: 'Liabilities', stack: 'nw',
              data: months.map((m) => {
                const v = byMonth.get(m)?.liabilitiesByCurrency[currency];
                return v === undefined ? null : -v;
              }),
              backgroundColor: withAlpha(cssVar('--loss'), '#e5484d'),
            },
            {
              type: 'line', label: 'Net worth',
              data: months.map((m) => byMonth.get(m)?.byCurrency[currency] ?? null),
              borderColor: cssVar('--accent') || '#5aa9c9',
              backgroundColor: 'transparent',
              borderWidth: 3,
              tension: 0.2,
              datalabels: dlLine((v) => fmtMoney(v, currency)),
            },
          ] as ChartDataset<'bar' | 'line', (number | null)[]>[],
        }}
        options={{ scales: { x: { stacked: true }, y: { stacked: true } } }}
      />
    </ChartCard>
  );
}

/** The scrollable multi-month summary table, moved from Budget Planner
 * (README item 107's original design, user-requested 2026-08-27) — now
 * rendered once per currency instead of behind a currency picker. */
function MonthlySummaryTable({
  currency, months, nowMonth, monthly, trend,
}: {
  currency: string; months: string[]; nowMonth: string; monthly: MonthlyIncomeExpense[]; trend: MonthlyNetWorthPoint[];
}) {
  const monthlyByMonth = new Map(monthly.map((m) => [m.month, m]));
  const trendByMonth = new Map(trend.map((m) => [m.month, m]));

  const statusFor = (m: string): 'Actual' | 'Current' | 'Projected' =>
    m < nowMonth ? 'Actual' : m === nowMonth ? 'Current' : 'Projected';

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Monthly summary — {currency}</h3>}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              {months.map((m) => (
                <th key={m} style={{ minWidth: 130 }}>
                  {new Date(`${m}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}<br />
                  <span className="text-muted" style={{ fontWeight: statusFor(m) === 'Current' ? 700 : 400 }}>
                    {statusFor(m)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Tooltip text="Everything that added money in this month — real transactions and planned entries combined, EXCLUDING any linked inter-account transfer (moving your own money between your own accounts isn't real income).">
                  Inflow
                </Tooltip>
              </td>
              {months.map((m) => <td key={m}>{fmtMoney(monthlyByMonth.get(m)?.income[currency] ?? 0, currency)}</td>)}
            </tr>
            <tr>
              <td>
                <Tooltip text="Everything that took money out this month — real transactions and planned entries combined, EXCLUDING any linked inter-account transfer (moving your own money between your own accounts isn't a real expense).">
                  Outflow
                </Tooltip>
              </td>
              {months.map((m) => <td key={m}>{fmtMoney(monthlyByMonth.get(m)?.expense[currency] ?? 0, currency)}</td>)}
            </tr>
            <tr>
              <td>
                <Tooltip text="Inflow minus outflow for this month — real transactions and planned entries combined, EXCLUDING any linked inter-account transfer (which is neither an inflow nor an outflow).">
                  Net flow
                </Tooltip>
              </td>
              {months.map((m) => {
                const row = monthlyByMonth.get(m);
                const net = (row?.income[currency] ?? 0) - (row?.expense[currency] ?? 0);
                return (
                  <td key={m}>
                    <span className={`pill ${net >= 0 ? 'pill-positive' : 'pill-negative'}`}>{fmtMoney(net, currency)}</span>
                  </td>
                );
              })}
            </tr>
            <tr>
              <td>
                <Tooltip text="The real sum of every account as of that month's last day (Assets minus Liabilities) — a completed past month is computed directly from your actual transaction history, not a projection. The current month uses today's real figure. Future months are projected from today plus planned income/expense and each EMI loan's amortization schedule.">
                  Net worth
                </Tooltip>
              </td>
              {months.map((m) => {
                const value = trendByMonth.get(m)?.byCurrency[currency];
                return (
                  <td key={m}>
                    {value === undefined ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={`pill ${value >= 0 ? 'pill-positive' : 'pill-negative'}`}>{fmtMoney(value, currency)}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
        Net worth shows "—" only where this currency had no activity yet as of that month.
      </p>
    </CollapsibleCard>
  );
}
