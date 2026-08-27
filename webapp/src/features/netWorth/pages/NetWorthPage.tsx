import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, MoneyValue, StatCard } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Notice } from '../../../components/Notice';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { toast } from '../../../components/Toast';
import { ChartCard } from '../../qse/components/ChartCard';
import { netIncomeByCurrency as rentalsNetIncomeByCurrency } from '../../../lib/calc/rentalsModule';
import { flowByCurrency } from '../../../lib/calc/netWorth';
import { collectBudgetActivities, monthlyIncomeExpense, threeMonthWindow } from '../../../lib/calc/budgetPlanner';
import { upcomingRenewals } from '../../../lib/calc/subscriptionsModule';
import { useSubscriptionsWorkbookStore } from '../../../store/subscriptionsWorkbookStore';
import { useNetWorthSummary } from '../hooks/useNetWorthSummary';
import { convertAmount, effectiveRate, fetchFxRates, isFxStale, loadCachedFxRates, saveFxRates, setCrossRate, type FxRates } from '../../../lib/fx';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useAuthState } from '../../../lib/firebase/useAuthState';
import { firebaseReady } from '../../../lib/firebase/client';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { dlBarV, dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar } from '../../../lib/cssVar';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../../store/plannedCashWorkbookStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useNetWorthSnapshotsWorkbookStore } from '../../../store/netWorthSnapshotsWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../../../store/plannedRentalsWorkbookStore';

/** Cross-module net worth summary (README item 39 / MODULES_PLAN.md §16).
 * Currency conversion is best-effort and NEVER blocks the page: rates come
 * from a free, no-key API fetched at most once a day and cached locally
 * (the user explicitly chose "free API if it works, otherwise manual
 * entry" over paying for the scheduled-Cloud-Function version originally
 * scoped — see MODULES_PLAN.md §16). If the fetch fails for any reason
 * (network, CORS — untestable from this dev sandbox, which blocks
 * arbitrary outbound hosts; needs a real browser to confirm), every
 * per-currency section still renders in its own currency with zero
 * dependency on FX — only the single converted grand-total line degrades. */
export function NetWorthPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const cashEntries = useCashWorkbookStore((s) => s.workbook.entries);
  const plannedCash = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const bank = useBankWorkbookStore((s) => s.workbook);
  const plannedBank = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const rentals = useRentalsWorkbookStore((s) => s.workbook);
  const plannedRentals = usePlannedRentalsWorkbookStore((s) => s.workbook.entries);
  const subscriptions = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  // User-requested (2026-08-26): renewal/expiry alerts on the "homepage" —
  // a 14-day glance window, broader than any one subscription's own
  // configured alert lead time (which might be shorter, or unset), so this
  // stays useful even for a subscription with no alerts configured at all.
  const renewalsSoon = upcomingRenewals(subscriptions, 14);

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

  // User-requested (2026-08-26): "the app must display current, previous
  // and next month's projected incomes and expenses" — this IS the
  // primary home for that projection (the same numbers are also shown on
  // the Budget Planner page, per the user's own follow-up: "3 months
  // projection is for Net worth dashboard. But it can also be reflected
  // in the planner."). See `lib/calc/budgetPlanner.ts` for the combine
  // logic — real transactions plus each module's own not-yet-executed
  // planned entries, unified across Cash/Bank/Rentals.
  const budgetActivities = useMemo(
    () => collectBudgetActivities({
      cashEntries, plannedCash,
      bankAccounts: bank.settings.accounts, bankTransactions: bank.transactions, plannedBank,
      rentalProperties: rentals.settings.properties, rentalEntries: rentals.entries, plannedRentals,
    }),
    [cashEntries, plannedCash, bank, plannedBank, rentals, plannedRentals],
  );
  const projectionMonths = useMemo(() => threeMonthWindow(), []);
  const monthlyProjection = useMemo(() => monthlyIncomeExpense(budgetActivities, projectionMonths), [budgetActivities, projectionMonths]);
  const projectionCurrencies = useMemo(() => [...new Set(budgetActivities.map((a) => a.currencyCode))].sort(), [budgetActivities]);
  const [projectionCurrency, setProjectionCurrency] = useLastCurrency('net-worth-projection', projectionCurrencies[0] ?? preferredCurrency);
  const effectiveProjectionCurrency = projectionCurrencies.includes(projectionCurrency) ? projectionCurrency : (projectionCurrencies[0] ?? projectionCurrency);
  const monthLabel = (m: string) => new Date(`${m}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

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

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const todayFlow = flowByCurrency(cashEntries, bank.settings.accounts, bank.transactions, today, today);
  const monthFlow = flowByCurrency(cashEntries, bank.settings.accounts, bank.transactions, monthStart, today);
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

  // README Pending item 78: unlike splitData above, a currency with more
  // liabilities than assets (net <= 0) still belongs here — an Assets vs.
  // Liabilities bar chart shows that fine (Assets bar shorter than
  // Liabilities), only a doughnut's single net-value slice can't.
  const assetsLiabilitiesData = rows
    .map((r) => ({
      currency: r.currency,
      assets: convertAmount(r.assets, r.currency, preferredCurrency, rates),
      liabilities: convertAmount(r.liabilities, r.currency, preferredCurrency, rates),
    }))
    .filter((r): r is { currency: string; assets: number; liabilities: number } => r.assets !== null && r.liabilities !== null);

  const selectedCurrencyRow = rows.find((r) => r.currency === preferredCurrency);

  const ownCurrencies = [...new Set(rows.map((r) => r.currency))].sort();

  // README Pending item 64: a real net-worth-over-time chart, built on an
  // explicit on-demand snapshot (see types/netWorthSnapshot.ts's own doc
  // comment for the locked design decisions — cadence/storage/staleness).
  const snapshots = useNetWorthSnapshotsWorkbookStore((s) => s.workbook.entries);
  const addSnapshot = useNetWorthSnapshotsWorkbookStore((s) => s.addEntry);
  const updateSnapshot = useNetWorthSnapshotsWorkbookStore((s) => s.updateEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const { user } = useAuthState();
  const todaysSnapshot = snapshots.find((s) => s.date === today);

  // README Pending item 73: automatic once-per-calendar-day snapshot,
  // reversing the earlier on-demand-only design (see
  // types/netWorthSnapshot.ts's own doc comment for the full reasoning).
  // Idempotent (skips once today's snapshot already exists) and only ever
  // fires for an ALREADY signed-in user — never pops a sign-in prompt on
  // its own, since that would be a surprising side effect of just loading
  // a page. `rows` is deliberately left out of the dependency array: it's
  // a live-derived value that can change on every render, and this effect
  // only needs to run once per (user, day, existing-snapshot) combination,
  // not every time the underlying totals recompute.
  useEffect(() => {
    if (!user || todaysSnapshot || !rows.length) return;
    const byCurrency: Record<string, number> = {};
    rows.forEach((r) => { byCurrency[r.currency] = r.net; });
    addSnapshot({ id: crypto.randomUUID(), date: today, byCurrency });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, todaysSnapshot, today]);

  const saveSnapshot = async () => {
    if (!(await ensureSignedIn('Sign in to save a net worth snapshot.'))) return;
    const byCurrency: Record<string, number> = {};
    rows.forEach((r) => { byCurrency[r.currency] = r.net; });
    if (todaysSnapshot) {
      updateSnapshot(todaysSnapshot.id, { byCurrency });
      toast('Updated today\'s net worth snapshot.');
    } else {
      addSnapshot({ id: crypto.randomUUID(), date: today, byCurrency });
      toast('Net worth snapshot saved.');
    }
  };

  const history = [...snapshots]
    .filter((s) => s.byCurrency[preferredCurrency] != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <h1>Net Worth</h1>

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
          <Link to="/subscriptions" className="footer-note" style={{ display: 'inline-block', marginTop: 6 }}>Manage subscriptions →</Link>
        </Notice>
      )}

      {/* User-requested (2026-08-26): "current, previous and next month's
          projected incomes and expenses" — combines each module's real
          transactions with its own not-yet-executed planned entries (see
          `lib/calc/budgetPlanner.ts`), so "current month" already blends
          what's actually happened with what's still expected. The same
          view is also reachable (with an add-plan shortcut) from the
          Budget Planner page — this is the summary; that page is where
          you act on it. */}
      {budgetActivities.length > 0 && (
        <div style={{ marginBottom: 24 }}>
        <ChartCard title="Income vs. expense — previous / current / next month">
          {projectionCurrencies.length > 1 && (
            <Field label="Currency" width={110}>
              <Select value={effectiveProjectionCurrency} onChange={(e) => setProjectionCurrency(e.target.value)}>
                {projectionCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          )}
          <Bar
            data={{
              labels: projectionMonths.map(monthLabel),
              datasets: [
                { label: 'Income', data: monthlyProjection.map((m) => m.income[effectiveProjectionCurrency] ?? 0), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                { label: 'Expense', data: monthlyProjection.map((m) => m.expense[effectiveProjectionCurrency] ?? 0), backgroundColor: cssVar('--loss') || '#e5484d' },
              ],
            }}
            options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, effectiveProjectionCurrency)) } }}
          />
          <Link to="/budget" className="footer-note" style={{ display: 'inline-block', marginTop: 6 }}>Open Budget Planner →</Link>
        </ChartCard>
        </div>
      )}

      {/* Items 2/3/4/5 of a 2026-08-26 follow-up batch: the previous single
          Card had the big number eating ~80% width with mostly blank space
          while the rate controls were squeezed into a ~20% sliver, "Show
          total in" sat in the page header disconnected from the number it
          controls, and FX entry was locked to "1 USD = X". Now two
          separate, roughly-equal Cards: "Net worth summary" (the currency
          picker grouped directly with the big number it controls) and
          "Exchange rates" (its own Card, with a From/To pair — any two of
          the user's own currencies, not just vs. USD — plus a read-only
          table of every rate between currencies the user actually holds). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16, alignItems: 'start' }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Net worth summary</h3>
          <Field label="Show total in" width={150}>
            <Select value={preferredCurrency} onChange={(e) => setPreferredCurrency(e.target.value)} width={150}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </Field>
          <div style={{ marginTop: 12 }}>
            <StatCard label={`Estimated net worth (${preferredCurrency})`} value={fmtMoney(grandTotal, preferredCurrency)} hue={grandTotal >= 0 ? 'var(--profit)' : 'var(--loss)'} />
          </div>
          <button type="button" className="btn secondary small" style={{ marginTop: 8 }} onClick={saveSnapshot}>
            {todaysSnapshot ? 'Update today\'s snapshot' : 'Save snapshot'}
          </button>
          <span className="footer-note" style={{ marginLeft: 8 }}>
            {todaysSnapshot ? 'Already saved today — click again to overwrite with the current numbers.' : 'Logs today\'s net worth for the history chart below.'}
          </span>
          {unconverted.length > 0 && (
            <div className="footer-note" style={{ marginTop: 8 }}>
              No {preferredCurrency} rate available for {unconverted.join(', ')} — those currencies' totals
              aren't included above; see their own sections below for real figures.
            </div>
          )}
          {/* Item 5 of a 2026-08-26 feedback batch: "more useful info & stat
              cards... Debts, inflow/outflow today, month". All three are a
              converted SUM alongside the real per-currency figures below —
              never a replacement for them. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8, marginTop: 12 }}>
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
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Exchange rates</h3>
          <div className="footer-note">
            {rates
              ? `Rates as of ${new Date(rates.fetchedAt).toLocaleString()} (${rates.source === 'api' ? 'auto-fetched' : 'manually entered'}).`
              : 'No exchange rates loaded yet.'}
            {fetchError && ` Auto-fetch failed: ${fetchError} — enter a rate manually below.`}
          </div>
          <button type="button" className="btn-link" onClick={refresh} disabled={fetching} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, marginTop: 2 }}>
            {fetching ? 'Refreshing…' : 'Refresh rates'}
          </button>

          <div style={{ marginTop: 12 }}>
            <div className="footer-note" style={{ marginBottom: 4 }}>Set a rate between any two currencies</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
              <div className="footer-note" style={{ marginBottom: 4 }}>Rates between your own currencies</div>
              {ownCurrencies.flatMap((a) =>
                ownCurrencies.filter((b) => b > a).map((b) => {
                  const rAB = effectiveRate(a, b, rates);
                  const rBA = effectiveRate(b, a, rates);
                  return (
                    <div key={`${a}-${b}`} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="footer-note">1 {a} =</span>
                        <span style={{ fontFamily: 'var(--mono)' }}>{rAB !== null ? `${rAB.toFixed(4)} ${b}` : `— ${b} (no rate yet)`}</span>
                      </div>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="footer-note">1 {b} =</span>
                        <span style={{ fontFamily: 'var(--mono)' }}>{rBA !== null ? `${rBA.toFixed(4)} ${a}` : `— ${a} (no rate yet)`}</span>
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Item 4: "add charts to view capital split per currency" — the
          split-by-currency chart below needs no new storage. */}
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

      {/* README Pending item 78: the doughnut above only ever shows the NET
          per currency — this adds the two comparisons the item itself
          named as the likely gap: assets vs. liabilities across every
          currency, and a breakdown of just the currently-selected one. */}
      {assetsLiabilitiesData.length > 0 && (
        <ChartCard
          title={`Assets vs. liabilities — one bar pair per currency you hold, values shown in ${preferredCurrency} so they're comparable`}
          empty={false}
        >
          <div style={{ height: 220 }}>
            <Bar
              data={{
                labels: assetsLiabilitiesData.map((d) => d.currency),
                datasets: [
                  { label: 'Assets', data: assetsLiabilitiesData.map((d) => d.assets), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                  { label: 'Liabilities', data: assetsLiabilitiesData.map((d) => d.liabilities), backgroundColor: cssVar('--loss') || '#e5484d' },
                ],
              }}
              options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, preferredCurrency)) } }}
            />
          </div>
        </ChartCard>
      )}

      {selectedCurrencyRow && selectedCurrencyRow.breakdown.length > 0 && (
        <ChartCard title={`Breakdown within ${preferredCurrency}, by module`} empty={false}>
          <div style={{ height: Math.max(160, selectedCurrencyRow.breakdown.length * 32) }}>
            <Bar
              data={{
                labels: selectedCurrencyRow.breakdown.map((b) => b.module),
                datasets: [
                  {
                    data: selectedCurrencyRow.breakdown.map((b) => b.amount),
                    backgroundColor: selectedCurrencyRow.breakdown.map((b) => (b.amount >= 0 ? cssVar('--profit') || '#3ecf8e' : cssVar('--loss') || '#e5484d')),
                  },
                ],
              }}
              options={{ indexAxis: 'y', plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmtMoney(v, preferredCurrency)) } }}
            />
          </div>
        </ChartCard>
      )}

      {rows.length === 0 && (
        <Card><div className="footer-note">No balances recorded yet across any module.</div></Card>
      )}

      {/* Item 6 (app-wide note): a fixed-column list of full-width cards
          forces scrolling past mostly-blank space to see a handful of
          numbers. A responsive grid lets 2-3 currency sections sit
          side by side on a wide viewport instead of stacking one under
          the other — this page is the first concrete instance of that
          general principle; a fuller app-wide pass is tracked separately. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        {rows.map((r) => {
          const converted = convertAmount(r.net, r.currency, preferredCurrency, rates);
          return (
            <details key={r.currency} open className="card" style={{ padding: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
                {r.currency} — {fmtMoney(r.net, r.currency)}
                {converted !== null && r.currency !== preferredCurrency && (
                  <span className="footer-note" style={{ marginLeft: 8, fontWeight: 400 }}>
                    ≈ {fmtMoney(converted, preferredCurrency)}
                  </span>
                )}
              </summary>
              <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <div className="stat-card card"><div className="label">Assets</div><MoneyValue n={r.assets} currency={r.currency} /></div>
                <div className="stat-card card"><div className="label">Liabilities</div><MoneyValue n={r.liabilities} currency={r.currency} /></div>
                <div className="stat-card card"><div className="label">Net</div><MoneyValue n={r.net} currency={r.currency} /></div>
              </div>
              {/* Item 2: "grouped info of all finances" — which modules
                  actually made up this currency's total, not just the
                  summed Assets/Liabilities/Net. README item 79 (2026-08-26):
                  small cards instead of long table-style rows. */}
              {r.breakdown.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="footer-note" style={{ marginBottom: 4 }}>By module</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 6 }}>
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

      {/* README item 75 of a 2026-08-26 feedback batch: this chart should
          render AFTER the per-currency summaries above, not before them. */}
      <ChartCard title={`Net worth over time (${preferredCurrency})`} empty={history.length < 2}>
        <div style={{ height: 220 }}>
          <Line
            data={{
              labels: history.map((s) => s.date),
              datasets: [{
                label: preferredCurrency,
                data: history.map((s) => s.byCurrency[preferredCurrency]),
                borderColor: cssVar('--accent') || '#3ecf8e',
                backgroundColor: cssVar('--accent') || '#3ecf8e',
                tension: 0.2,
              }],
            }}
            options={{ plugins: { datalabels: dlLine((v) => fmtMoney(v, preferredCurrency)) } }}
          />
        </div>
      </ChartCard>

      {Object.keys(rentalsNet).length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <div className="label" style={{ marginBottom: 8 }}>Rental net income (informational — not included above)</div>
          <div className="footer-note" style={{ marginBottom: 8 }}>
            Property values aren't tracked in this app, and rental income already lands in whichever Cash/Bank
            account it was deposited to — counting it again here would double-count it.
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(rentalsNet).map(([code, amount]) => (
              <div key={code} className="stat-card card"><div className="label">{code}</div><MoneyValue n={amount} currency={code} /></div>
            ))}
          </div>
        </Card>
      )}

      {firebaseReady && (
        <Card style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Account</h3>
          <p className="footer-note">{syncStatus}</p>
          {cloudEmpty && (
            <Notice tone="warning" style={{ marginTop: 8 }}>
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
        </Card>
      )}
    </div>
  );
}
