import { useEffect, useState } from 'react';
import { Card, MoneyValue, StatCard } from '../../../components/Card';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { toast } from '../../../components/Toast';
import { cashBalanceByCurrency } from '../../../lib/calc/cashModule';
import { totalBalanceByCurrency } from '../../../lib/calc/bankModule';
import { netPositionByCurrency } from '../../../lib/calc/personalLoansModule';
import { totalsByCurrency as emiTotalsByCurrency } from '../../../lib/calc/emiModule';
import { netIncomeByCurrency as rentalsNetIncomeByCurrency } from '../../../lib/calc/rentalsModule';
import { fundsValueByCurrency } from '../../../lib/calc/fundsModule';
import { computeNetWorthByCurrency } from '../../../lib/calc/netWorth';
import { convertAmount, fetchFxRates, isFxStale, loadCachedFxRates, saveFxRates, setManualRate, type FxRates } from '../../../lib/fx';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
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

  const [preferredCurrency, setPreferredCurrency] = useLastCurrency('net-worth-preferred', 'USD');
  const [rates, setRates] = useState<FxRates | null>(() => loadCachedFxRates());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualValue, setManualValue] = useState('');

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

  // Item 1/3 of a 2026-08-26 feedback batch: picking a currency here used to
  // always start the Rate field blank, forcing the user to type a value from
  // scratch even when a rate (auto-fetched or previously entered by hand) is
  // already known for it — prefill with the current known value instead, so
  // this reads as "edit the current rate" rather than "guess a new one".
  const onManualCodeChange = (code: string) => {
    setManualCode(code);
    const known = code ? rates?.rates[code] : undefined;
    setManualValue(typeof known === 'number' ? String(known) : '');
  };

  const applyManualRate = () => {
    const value = Number(manualValue);
    if (!manualCode || !value || value <= 0) return toast('Enter a currency and a positive rate.');
    const next = setManualRate(manualCode, value, rates);
    saveFxRates(next);
    setRates(next);
    setManualValue('');
    toast(`${manualCode} rate saved.`);
  };

  let grandTotal = 0;
  const unconverted: string[] = [];
  rows.forEach((r) => {
    const converted = convertAmount(r.net, r.currency, preferredCurrency, rates);
    if (converted === null) unconverted.push(r.currency);
    else grandTotal += converted;
  });

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1>Net Worth</h1>
        <Field label="Show total in" width={150}>
          <Select value={preferredCurrency} onChange={(e) => setPreferredCurrency(e.target.value)} width={150}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
      </div>

      {/* Item 4/5 of a 2026-08-26 feedback batch: the big number used to be a
          bare `.stat-card` missing the `.card` class (so its colored
          gradient background filled edge-to-edge with the inline
          `padding:0` it had, reading as a stray colored strip behind the
          text) and the rate-management controls ran the full page width
          below it. Now a two-column layout: the big number on the left
          (using the real shared StatCard component, so it gets a proper
          inset/rounded card like every other stat card in the app) and a
          narrow, stacked "rates" panel pinned to the right instead of
          spanning the width. */}
      <Card style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            <StatCard label={`Estimated net worth (${preferredCurrency})`} value={fmtMoney(grandTotal, preferredCurrency)} hue={grandTotal >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            {unconverted.length > 0 && (
              <div className="footer-note" style={{ marginTop: 8 }}>
                No {preferredCurrency} rate available for {unconverted.join(', ')} — those currencies' totals
                aren't included above; see their own sections below for real figures.
              </div>
            )}
          </div>
          <div style={{ flex: '0 1 260px', minWidth: 220, maxWidth: 280 }}>
            <div className="footer-note">
              {rates
                ? `Rates as of ${new Date(rates.fetchedAt).toLocaleString()} (${rates.source === 'api' ? 'auto-fetched' : 'manually entered'}).`
                : 'No exchange rates loaded yet.'}
              {fetchError && ` Auto-fetch failed: ${fetchError} — enter a rate manually below.`}
            </div>
            <button type="button" className="btn-link" onClick={refresh} disabled={fetching} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, marginTop: 2 }}>
              {fetching ? 'Refreshing…' : 'Refresh rates'}
            </button>
            <div style={{ marginTop: 10 }}>
              <div className="footer-note" style={{ marginBottom: 4 }}>Manual rate override — 1 USD =</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Select value={manualCode} onChange={(e) => onManualCodeChange(e.target.value)} width={150}>
                  <option value="">Currency…</option>
                  {CURRENCIES.filter((c) => c.code !== 'USD').map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
                <TextInput type="number" step="0.0001" placeholder="Rate" value={manualValue} onChange={(e) => setManualValue(e.target.value)} style={{ width: 150 }} />
                <button type="button" className="btn" style={{ width: 150 }} onClick={applyManualRate}>Save rate</button>
              </div>
            </div>
          </div>
        </div>
      </Card>

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
