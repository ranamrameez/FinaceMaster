import { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Card, MoneyValue, StatCard } from '../../../components/Card';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { toast } from '../../../components/Toast';
import { ChartCard } from '../../qse/components/ChartCard';
import { cashBalanceByCurrency } from '../../../lib/calc/cashModule';
import { totalBalanceByCurrency } from '../../../lib/calc/bankModule';
import { netPositionByCurrency } from '../../../lib/calc/personalLoansModule';
import { totalsByCurrency as emiTotalsByCurrency } from '../../../lib/calc/emiModule';
import { netIncomeByCurrency as rentalsNetIncomeByCurrency } from '../../../lib/calc/rentalsModule';
import { fundsValueByCurrency } from '../../../lib/calc/fundsModule';
import { computeNetWorthByCurrency, flowByCurrency } from '../../../lib/calc/netWorth';
import { convertAmount, effectiveRate, fetchFxRates, isFxStale, loadCachedFxRates, saveFxRates, setCrossRate, type FxRates } from '../../../lib/fx';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { dlDoughnut } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { HUES } from '../../../lib/statCardHues';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePersonalLoansWorkbookStore } from '../../../store/personalLoansWorkbookStore';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { useQSEDerived } from '../../qse/hooks/useQSEDerived';
import { usePSXDerived } from '../../psx/hooks/usePSXDerived';

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
export function NetWorthPage() {
  const cashEntries = useCashWorkbookStore((s) => s.workbook.entries);
  const bank = useBankWorkbookStore((s) => s.workbook);
  const personalLoans = usePersonalLoansWorkbookStore((s) => s.workbook);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const funds = useFundsWorkbookStore((s) => s.workbook);
  const rentals = useRentalsWorkbookStore((s) => s.workbook);
  const qseSettings = useWorkbookStore((s) => s.workbook.settings);
  const psxSettings = usePSXWorkbookStore((s) => s.workbook.settings);
  const qse = useQSEDerived();
  const psx = usePSXDerived();
  // Charts on this page recompute their CSS-var-derived colors only when
  // this component re-renders — same reasoning as every other chart-bearing
  // page (Dashboard, Analytics, PositionDetail).
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const cash = cashBalanceByCurrency(cashEntries);
  const bankTotals = totalBalanceByCurrency(bank.settings.accounts, bank.transactions);
  const personalLoansNet = netPositionByCurrency(personalLoans.loans, personalLoans.repayments);
  const emiOutstanding: Record<string, number> = {};
  Object.entries(emiTotalsByCurrency(emiLoans)).forEach(([code, t]) => { emiOutstanding[code] = t.outstanding; });
  const fundsValues = fundsValueByCurrency(funds.funds, funds.transactions, funds.marketPrices);
  const rentalsNet = rentalsNetIncomeByCurrency(rentals.settings.properties, rentals.entries);

  // Skip an exchange entirely if it's never been touched — otherwise an
  // unused QSE/PSX account always contributes a spurious "0" row in its
  // default currency, cluttering the dashboard for anyone who only uses
  // one exchange (or neither).
  const qseUsed = qse.workbook.transactions.length > 0 || qse.workbook.transfers.length > 0 || qse.workbook.adjustments.length > 0;
  const psxUsed = psx.workbook.transactions.length > 0 || psx.workbook.transfers.length > 0 || psx.workbook.adjustments.length > 0;

  const rows = computeNetWorthByCurrency({
    cash,
    bank: bankTotals,
    qse: qseUsed ? { [qseSettings.currency]: qse.summary.netWorth } : {},
    psx: psxUsed ? { [psxSettings.currency]: psx.summary.netWorth } : {},
    funds: fundsValues,
    personalLoansNet,
    emiOutstanding,
  });

  // Item 3 of a 2026-08-26 feedback batch: "Default currency should be
  // logical" — `useLastCurrency` already remembers whatever the user picks
  // for next time, but its FIRST-EVER default was a hardcoded 'USD' even
  // for a user who's never touched USD at all. Default instead to whichever
  // currency the user actually has the largest (absolute) net exposure in —
  // a much more likely "the one they care about" than an arbitrary global
  // default — falling back to 'USD' only when there's no data yet to judge by.
  const biggestExposureCurrency = rows.length
    ? [...rows].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))[0].currency
    : 'USD';
  const [preferredCurrency, setPreferredCurrency] = useLastCurrency('net-worth-preferred', biggestExposureCurrency);
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

  const ownCurrencies = [...new Set(rows.map((r) => r.currency))].sort();

  return (
    <div>
      <h1>Net Worth</h1>

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
                  const r = effectiveRate(a, b, rates);
                  return (
                    <div key={`${a}-${b}`} className="row" style={{ justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <span className="footer-note">1 {a} =</span>
                      <span style={{ fontFamily: 'var(--mono)' }}>{r !== null ? `${r.toFixed(4)} ${b}` : `— ${b} (no rate yet)`}</span>
                    </div>
                  );
                }),
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Item 4: "add charts to view capital split per currency" — a
          net-worth-over-time chart would need periodic snapshots this app
          doesn't take yet (net worth is always computed live from current
          data, nothing is logged historically) — that's a real design
          decision (how often to snapshot, where to store it) not guessed
          at here; tracked as its own Pending item instead. The split-by-
          currency chart below needs no new storage, so it's built now. */}
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
                  summed Assets/Liabilities/Net. */}
              {r.breakdown.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="footer-note" style={{ marginBottom: 4 }}>By module</div>
                  {r.breakdown.map((b) => (
                    <div key={b.module} className="row" style={{ justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <span className="footer-note">{b.module}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: b.amount >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                        {fmtMoney(b.amount, r.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </details>
          );
        })}
      </div>

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
    </div>
  );
}
