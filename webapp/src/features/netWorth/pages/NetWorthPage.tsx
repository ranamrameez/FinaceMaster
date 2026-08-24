import { useEffect, useState } from 'react';
import { Card, MoneyValue } from '../../../components/Card';
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
        <Field label="Show total in">
          <Select value={preferredCurrency} onChange={(e) => setPreferredCurrency(e.target.value)} width={110}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ padding: 0 }}>
          <div className="label">Estimated net worth ({preferredCurrency})</div>
          <MoneyValue n={grandTotal} currency={preferredCurrency} />
        </div>
        {unconverted.length > 0 && (
          <div className="footer-note" style={{ marginTop: 8 }}>
            No {preferredCurrency} rate available for {unconverted.join(', ')} — those currencies' totals aren't
            included above; see their own sections below for real figures.
          </div>
        )}
        <div className="footer-note" style={{ marginTop: 8 }}>
          {rates
            ? `Rates as of ${new Date(rates.fetchedAt).toLocaleString()} (${rates.source === 'api' ? 'auto-fetched' : 'manually entered'}).`
            : 'No exchange rates loaded yet.'}
          {fetchError && ` Auto-fetch failed: ${fetchError} — enter a rate manually below.`}
          {' '}
          <button type="button" className="btn-link" onClick={refresh} disabled={fetching} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            {fetching ? 'Refreshing…' : 'Refresh rates'}
          </button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Field label="Manual rate: 1 USD =" width={110}>
            <Select value={manualCode} onChange={(e) => setManualCode(e.target.value)}>
              <option value="">Currency…</option>
              {CURRENCIES.filter((c) => c.code !== 'USD').map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </Field>
          <Field label="Rate" width={110}>
            <TextInput type="number" step="0.0001" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
          </Field>
          <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={applyManualRate}>Save rate</button>
        </div>
      </Card>

      {rows.length === 0 && (
        <Card><div className="footer-note">No balances recorded yet across any module.</div></Card>
      )}

      {rows.map((r) => {
        const converted = convertAmount(r.net, r.currency, preferredCurrency, rates);
        return (
          <details key={r.currency} open className="card" style={{ marginBottom: 12, padding: 16 }}>
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
          </details>
        );
      })}

      {Object.keys(rentalsNet).length > 0 && (
        <Card style={{ marginTop: 4 }}>
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
