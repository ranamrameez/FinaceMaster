import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { getMarketPrice } from '../../../lib/calc';
import { allocationByCategory, contributionVsValueSeries } from '../../../lib/calc/fundsModule';
import { toCSV } from '../../../lib/csv';
import { getDailyPriceHistory } from '../../../lib/calc/priceHistory';
import { CURRENCIES } from '../../../lib/currencies';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { createEmptyFundsWorkbook } from '../../../store/defaultFundsWorkbook';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import type { Fund, FundsWorkbook } from '../../../types/fundsWorkbook';
import type { Transaction } from '../../../types/workbook';
import { useFundsDerived } from '../hooks/useFundsDerived';
import { ChartCard } from '../../qse/components/ChartCard';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();
const CATEGORIES: Fund['category'][] = ['Equity', 'Debt', 'Hybrid', 'International', 'Other'];

function emptyFund(defaultCurrency: string): Fund {
  return { id: '', name: '', code: '', platform: '', category: 'Equity', currencyCode: defaultCurrency };
}

/* ============================== Add fund ============================== */

function AddFundForm() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const addTransaction = useFundsWorkbookStore((s) => s.addTransaction);
  const [lastCurrency, setLastCurrency] = useLastCurrency('funds', 'USD');
  const ensureSignedIn = useEnsureSignedIn();
  const [f, setF] = useState<Fund>(() => emptyFund(lastCurrency));
  const [initialDate, setInitialDate] = useState(today());
  const [initialAmount, setInitialAmount] = useState(0);
  const [initialNav, setInitialNav] = useState(1);

  const submit = async () => {
    if (!f.name.trim()) return toast('Enter a fund name.');
    if (!f.code.trim()) return toast('Enter a fund code.');
    if (!(await ensureSignedIn('Sign in to save funds.'))) return;
    const id = uid();
    setWorkbook({ ...workbook, funds: [...workbook.funds, { ...f, id, name: f.name.trim(), code: f.code.trim().toUpperCase(), platform: f.platform.trim() }] });
    if (initialAmount > 0 && initialNav > 0) {
      addTransaction({ date: initialDate, ticker: id, action: 'BUY', shares: initialAmount / initialNav, price: initialNav });
    }
    toast(`Fund "${f.name.trim()}" added.`);
    setF(emptyFund(f.currencyCode));
    setInitialAmount(0);
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Fund name" width={200}>
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Vanguard Total World Stock ETF" />
        </Field>
        <Field label="Fund code" width={100}>
          <TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="e.g. VT" />
        </Field>
        <Field label="Invested via" width={140}>
          <TextInput value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} placeholder="e.g. Fidelity" />
        </Field>
        <Field label="Category" width={130}>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Fund['category'] })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Currency" width={100}>
          <Select value={f.currencyCode} onChange={(e) => { setF({ ...f, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
      </div>
      <p className="footer-note" style={{ marginTop: 8 }}>Optional initial investment (leave amount blank to just add the fund with no transactions yet):</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Date">
          <TextInput type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} />
        </Field>
        <Field label="Amount invested" width={130}>
          <TextInput type="number" step="0.01" value={initialAmount || ''} onChange={(e) => setInitialAmount(Number(e.target.value))} />
        </Field>
        <Field label="NAV per unit" width={110}>
          <TextInput type="number" step="0.0001" value={initialNav || ''} onChange={(e) => setInitialNav(Number(e.target.value))} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add fund
      </button>
    </Card>
  );
}

/* ============================== Fund list ============================== */

/** Overall stats across every fund, shown on the landing view before any
 * fund is opened — user feedback: every module needs an at-a-glance
 * accumulative summary, not just per-fund detail. Aggregate XIRR isn't
 * meaningful to sum/average across funds bought at different times, so
 * this only totals invested/value/profit, same convention as every other
 * module's currency-grouped totals (never blended across currencies). */
function OverallSummary() {
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const { positions, workbook } = useFundsDerived();

  const totals: Record<string, { invested: number; value: number }> = {};
  funds.forEach((fund) => {
    const p = positions.find((pos) => pos.ticker === fund.id);
    const invested = p?.invested ?? 0;
    const units = p?.shares ?? 0;
    const nav = getMarketPrice(fund.id, workbook.marketPrices, workbook.transactions);
    const value = units * nav;
    if (!totals[fund.currencyCode]) totals[fund.currencyCode] = { invested: 0, value: 0 };
    totals[fund.currencyCode].invested += invested;
    totals[fund.currencyCode].value += value;
  });
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => {
        const profit = totals[code].value - totals[code].invested;
        const profitPct = totals[code].invested > 0 ? (profit / totals[code].invested) * 100 : 0;
        return (
          <div key={code} className="card" style={{ padding: 12 }}>
            <div className="footer-note" style={{ marginBottom: 6 }}>{code}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 8 }}>
              <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Invested</div><MoneyValue n={totals[code].invested} currency={code} /></div>
              <div className="stat-card card" style={hueStyle(HUES[6])}><div className="label">Current value</div><MoneyValue n={totals[code].value} currency={code} /></div>
              <div className="stat-card card" style={hueStyle(profit >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Net profit</div><MoneyValue n={profit} currency={code} className={`value ${profit >= 0 ? 'pill-buy' : 'pill-sell'}`} after={` (${profitPct.toFixed(1)}%)`} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FundList({ onSelect }: { onSelect: (fund: Fund) => void }) {
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const { positions, fundXIRR, workbook } = useFundsDerived();

  type Row = { fund: Fund; units: number; invested: number; value: number; profit: number; profitPct: number; xirrPct: number | null };
  const rows: Row[] = funds.map((fund) => {
    const p = positions.find((pos) => pos.ticker === fund.id);
    const units = p?.shares ?? 0;
    const invested = p?.invested ?? 0;
    const nav = getMarketPrice(fund.id, workbook.marketPrices, workbook.transactions);
    const value = units * nav;
    const profit = value - invested;
    const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
    const rate = fundXIRR(fund.id);
    return { fund, units, invested, value, profit, profitPct, xirrPct: rate !== null ? rate * 100 : null };
  });

  type Col = 'name' | 'category' | 'units' | 'value' | 'profit' | 'xirr';
  const sortValue = (r: Row, col: Col): number | string => {
    switch (col) {
      case 'category': return r.fund.category;
      case 'units': return r.units;
      case 'value': return r.value;
      case 'profit': return r.profitPct;
      case 'xirr': return r.xirrPct ?? -Infinity;
      default: return r.fund.name;
    }
  };
  const { sorted, Th } = useSortableRows(rows, sortValue, 'name', 'asc');

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="name">Fund</Th><th>Code</th><Th col="category">Category</Th>
            <Th col="units">Units</Th><Th col="value">Value</Th><Th col="profit">Net P/L</Th><Th col="xirr">XIRR</Th><th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.fund.id} onClick={() => onSelect(r.fund)} style={{ cursor: 'pointer' }}>
              <td>{r.fund.name}</td>
              <td>{r.fund.code}</td>
              <td>{r.fund.category}</td>
              <td>{fmt(r.units, 2)}</td>
              <td>{fmtMoney(r.value, r.fund.currencyCode)}</td>
              <td className={r.profit >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(r.profit, r.fund.currencyCode)} ({r.profitPct.toFixed(1)}%)</td>
              <td>{r.xirrPct !== null ? `${r.xirrPct.toFixed(1)}%` : '—'}</td>
              <td><button className="btn secondary small" onClick={(e) => { e.stopPropagation(); onSelect(r.fund); }}>Open</button></td>
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={8} className="footer-note">No funds yet — add one above.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ============================== Fund detail ============================== */

function FundDetail({ fund, onBack }: { fund: Fund; onBack: () => void }) {
  const { positions, fundXIRR, workbook } = useFundsDerived();
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const addTransaction = useFundsWorkbookStore((s) => s.addTransaction);
  const updateTransaction = useFundsWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = useFundsWorkbookStore((s) => s.deleteTransaction);
  const setMarketPrice = useFundsWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();

  const [editingFund, setEditingFund] = useState(false);
  const [editFund, setEditFund] = useState<Fund>(fund);
  const [navInput, setNavInput] = useState('');
  const [txAction, setTxAction] = useState<'BUY' | 'SELL'>('BUY');
  const [txDate, setTxDate] = useState(today());
  const [txUnits, setTxUnits] = useState(0);
  const [txNav, setTxNav] = useState(0);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const position = positions.find((p) => p.ticker === fund.id);
  const units = position?.shares ?? 0;
  const invested = position?.invested ?? 0;
  const avgNav = units > 0 ? invested / units : 0;
  const currentNav = getMarketPrice(fund.id, workbook.marketPrices, workbook.transactions);
  const currentValue = units * currentNav;
  const profit = currentValue - invested;
  const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
  const rate = fundXIRR(fund.id);

  const txs = workbook.transactions.map((t, i) => ({ t, i })).filter((r) => r.t.ticker === fund.id).sort((a, b) => b.t.date.localeCompare(a.t.date));

  /** README item 40: extends Banking's statement-export pattern (Done
   * item 58) to this module's own primary record — a fund's "statement"
   * is its buy/sell transaction history. */
  const exportStatement = () => {
    const rows = txs
      .filter((r) => (!fromDate || r.t.date >= fromDate) && (!toDate || r.t.date <= toDate))
      .slice()
      .reverse();
    const header = ['Date', 'Type', 'Units', 'NAV', 'Amount'];
    const body = rows.map((r) => [r.t.date, r.t.action === 'BUY' ? 'Invested' : 'Withdrew', r.t.shares, r.t.price, r.t.shares * r.t.price]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'now'}` : '';
    a.download = `${fund.code || fund.name.replace(/\s+/g, '_')}_statement${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Statement downloaded.');
  };

  const saveFund = () => {
    setWorkbook({ ...workbook, funds: workbook.funds.map((f) => (f.id === fund.id ? editFund : f)) });
    toast('Fund updated.');
    setEditingFund(false);
  };

  const deleteFund = async () => {
    if (!(await confirmDialog('This deletes the fund and all its transactions.', `Delete fund "${fund.name}"?`))) return;
    setWorkbook({
      ...workbook,
      funds: workbook.funds.filter((f) => f.id !== fund.id),
      transactions: workbook.transactions.filter((t) => t.ticker !== fund.id),
    });
    onBack();
  };

  const commitNav = async () => {
    const val = parseFloat(navInput);
    if (!val || val <= 0) return;
    if (!(await ensureSignedIn('Sign in to save NAV updates.'))) return;
    setMarketPrice(fund.id, val);
    toast(`${fund.code} NAV saved: ${fmtPrice(val)}`);
    setNavInput('');
  };

  const submitTx = async () => {
    if (!txUnits || !txNav) return toast('Enter units and NAV.');
    if (!(await ensureSignedIn('Sign in to save this transaction.'))) return;
    addTransaction({ date: txDate, ticker: fund.id, action: txAction, shares: txUnits, price: txNav });
    toast(`${txAction === 'BUY' ? 'Invested' : 'Withdrew'} logged.`);
    setTxUnits(0);
  };

  const startEdit = (i: number, t: Transaction) => { setEditIndex(i); setEditRow({ ...t }); };
  const saveEdit = () => {
    if (editIndex === null || !editRow) return;
    updateTransaction(editIndex, editRow);
    toast('Transaction updated.');
    setEditIndex(null);
    setEditRow(null);
  };

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All funds</button>
      <Card style={{ marginBottom: 16 }}>
        {editingFund ? (
          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <TextInput value={editFund.name} onChange={(e) => setEditFund({ ...editFund, name: e.target.value })} />
              <TextInput value={editFund.code} onChange={(e) => setEditFund({ ...editFund, code: e.target.value.toUpperCase() })} />
              <TextInput value={editFund.platform} onChange={(e) => setEditFund({ ...editFund, platform: e.target.value })} />
              <Select value={editFund.category} onChange={(e) => setEditFund({ ...editFund, category: e.target.value as Fund['category'] })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select value={editFund.currencyCode} onChange={(e) => setEditFund({ ...editFund, currencyCode: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn secondary small" onClick={saveFund}><SaveIcon size={12} />Save</button>
              <button className="btn secondary small" onClick={() => setEditingFund(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{fund.name}</div>
              <div className="footer-note">{fund.code} · {fund.platform} · {fund.category} · {fund.currencyCode}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn secondary small" onClick={() => { setEditFund(fund); setEditingFund(true); }}>Edit</button>
              <button className="btn secondary small" onClick={deleteFund}><TrashIcon size={12} />Delete</button>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card"><div className="label">Units held</div><div className="value">{fmt(units, 2)}</div></div>
          <div className="stat-card card"><div className="label">Avg NAV cost</div><div className="value">{fmtPrice(avgNav)}</div></div>
          <div className="stat-card card"><div className="label">Invested</div><MoneyValue n={invested} currency={fund.currencyCode} /></div>
          <div className="stat-card card"><div className="label">Current value</div><MoneyValue n={currentValue} currency={fund.currencyCode} /></div>
          <div className="stat-card card"><div className="label">Net profit</div><MoneyValue n={profit} currency={fund.currencyCode} className={`value ${profit >= 0 ? 'pill-buy' : 'pill-sell'}`} after={` (${profitPct.toFixed(1)}%)`} /></div>
          <div className="stat-card card"><div className="label">XIRR</div><div className="value">{rate !== null ? `${(rate * 100).toFixed(1)}%` : '—'}</div></div>
        </div>
      </Card>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <input type="number" step="0.0001" placeholder="Update NAV" value={navInput} onChange={(e) => setNavInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitNav()} style={{ width: 130 }} />
        <button className="btn secondary small" onClick={commitNav}><SaveIcon size={12} />Save NAV</button>
        <span className="footer-note">Current NAV: {currentNav ? fmtPrice(currentNav) : '—'}</span>
      </div>

      <h3>Add transaction</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={txAction} onChange={(e) => setTxAction(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">Invest</option>
          <option value="SELL">Withdraw</option>
        </select>
        <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        <input type="number" placeholder="Units" value={txUnits || ''} onChange={(e) => setTxUnits(Number(e.target.value))} style={{ width: 100 }} />
        <input type="number" step="0.0001" placeholder="NAV" value={txNav || ''} onChange={(e) => setTxNav(Number(e.target.value))} style={{ width: 100 }} />
        <button className="btn" onClick={submitTx}><PlusIcon />Add</button>
      </div>

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Transactions</h3>}>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Units</th><th>NAV</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {txs.map(({ t, i }) =>
              editIndex === i && editRow ? (
                <tr key={i}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td>
                    <select value={editRow.action} onChange={(e) => setEditRow({ ...editRow, action: e.target.value as 'BUY' | 'SELL' })}>
                      <option value="BUY">Invest</option>
                      <option value="SELL">Withdraw</option>
                    </select>
                  </td>
                  <td><input type="number" value={editRow.shares} onChange={(e) => setEditRow({ ...editRow, shares: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td><input type="number" step="0.0001" value={editRow.price} onChange={(e) => setEditRow({ ...editRow, price: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td>{fmtMoney(editRow.shares * editRow.price, fund.currencyCode)}</td>
                  <td>
                    <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => setEditIndex(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td>{t.date}</td>
                  <td className={t.action === 'BUY' ? 'pill-buy' : 'pill-sell'}>{t.action === 'BUY' ? 'Invested' : 'Withdrew'}</td>
                  <td>{fmt(t.shares, 2)}</td>
                  <td>{fmtPrice(t.price)}</td>
                  <td>{fmtMoney(t.shares * t.price, fund.currencyCode)}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => startEdit(i, t)}>Edit</button>{' '}
                    <button
                      className="btn secondary small"
                      onClick={async () => {
                        if (await confirmDialog('This cannot be undone.', 'Delete this transaction?')) deleteTransaction(i);
                      }}
                    >
                      <TrashIcon size={12} />Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
            {!txs.length && <tr><td colSpan={6} className="footer-note">No transactions for this fund yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {txs.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="From (optional)">
            <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="To (optional)">
            <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <button className="btn secondary" onClick={exportStatement}>Export CSV</button>
        </div>
      )}
      </CollapsibleCard>
    </div>
  );
}

/* ============================== Analytics ============================== */

function AnalyticsTab() {
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const { workbook } = useFundsDerived();
  // Charts read CSS-var-derived colors — subscribe so this re-renders (and
  // recomputes those colors) on a live theme switch, same pattern as every
  // other chart-bearing page in this app.
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const currencies = useMemo(() => [...new Set(funds.map((f) => f.currencyCode))].sort(), [funds]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

  const [fundId, setFundId] = useState(funds[0]?.id ?? '');
  const selectedFund = funds.find((f) => f.id === fundId) ?? funds[0] ?? null;

  const allocation = useMemo(
    () => allocationByCategory(funds, workbook.transactions, workbook.marketPrices, effectiveCurrency),
    [funds, workbook.transactions, workbook.marketPrices, effectiveCurrency],
  );
  const categories = Object.keys(allocation);

  const navHistory = useMemo(
    () => (selectedFund ? getDailyPriceHistory(selectedFund.id, workbook.priceHistory) : []),
    [selectedFund, workbook.priceHistory],
  );
  const contribution = useMemo(
    () => (selectedFund ? contributionVsValueSeries(selectedFund.id, workbook.transactions, workbook.priceHistory) : []),
    [selectedFund, workbook.transactions, workbook.priceHistory],
  );

  if (!funds.length) {
    return <p className="footer-note">Add a fund first (Funds tab) to see charts here.</p>;
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {currencies.length > 1 && (
          <Field label="Currency" width={120}>
            <Select value={effectiveCurrency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Fund" width={220}>
          <Select value={selectedFund?.id ?? ''} onChange={(e) => setFundId(e.target.value)}>
            {funds.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
          </Select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
        <ChartCard title="Allocation by category" empty={!categories.length}>
          <Doughnut
            data={{
              labels: categories,
              datasets: [{ data: categories.map((c) => allocation[c]), backgroundColor: categories.map((c) => tickerColor(c)) }],
            }}
            options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
        {selectedFund && (
          <>
            <ChartCard title={`NAV over time — ${selectedFund.code}`} empty={!navHistory.length}>
              <Line
                data={{
                  labels: navHistory.map((p) => p.date),
                  datasets: [{ label: 'NAV', data: navHistory.map((p) => p.price), borderColor: '#5aa9c9', backgroundColor: '#5aa9c933', fill: true, tension: 0.2 }],
                }}
                options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtPrice(v)) } }}
              />
            </ChartCard>
            <ChartCard title={`Contribution vs. value — ${selectedFund.code}`} empty={!contribution.length}>
              <Line
                data={{
                  labels: contribution.map((c) => c.date),
                  datasets: [
                    { label: 'Invested', data: contribution.map((c) => c.invested), borderColor: cssVar('--warn') || '#e8a23d', backgroundColor: 'transparent', tension: 0.2 },
                    { label: 'Value', data: contribution.map((c) => c.value), borderColor: cssVar('--profit') || '#3ecf8e', backgroundColor: 'transparent', tension: 0.2 },
                  ],
                }}
                options={{ plugins: { datalabels: dlLine((v) => fmtMoney(v, selectedFund.currencyCode)) } }}
              />
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================== Settings ============================== */

function AccountSection({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady) {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Account</h3>
        <p className="footer-note">Cloud sync is unavailable — Firebase failed to load in this browser.</p>
      </Card>
    );
  }
  return (
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Account</h3>
      <p className="footer-note">{syncStatus}</p>
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
          <p style={{ marginTop: 0 }}>No data found in the cloud for this account's Funds workbook. This won't upload automatically.</p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
                `Upload ${funds.length} local fund(s) to the cloud?`,
              );
              if (!ok) return;
              setBusy(true);
              try {
                await uploadLocalToCloud();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Something went wrong.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Upload local data to cloud ({funds.length} funds)
          </button>
        </Notice>
      )}
    </Card>
  );
}

function DataManagement() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funds-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<FundsWorkbook>;
        setWorkbook({ ...createEmptyFundsWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all funds data?');
    if (!ok) return;
    setWorkbook(createEmptyFundsWorkbook());
    toast('All funds data cleared.');
  };

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Data management</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn secondary" onClick={exportJSON}>Export JSON</button>
        <button className="btn secondary" onClick={() => fileInput.current?.click()}>Import JSON</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importJSON(file);
            e.target.value = '';
          }}
        />
        <button className="btn secondary" onClick={clearAll}><TrashIcon size={12} />Clear all data</button>
      </div>
    </Card>
  );
}

export function FundsPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Fund | null>(null);
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const liveSelected = selected ? funds.find((f) => f.id === selected.id) ?? null : null;

  return (
    <div>
      <h1 className="pagetitle">Funds</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Mutual fund unit holdings and performance — buy/sell units at a NAV per unit, same shape as a stock
        trade. Returns are shown as XIRR, which accounts for when each investment happened, not just totals.
      </p>
      {liveSelected ? (
        <FundDetail fund={liveSelected} onBack={() => setSelected(null)} />
      ) : (
        <Tabs
          tabs={[
            {
              key: 'funds',
              label: 'Funds',
              content: (
                <div>
                  <OverallSummary />
                  <AddFundForm />
                  <FundList onSelect={setSelected} />
                </div>
              ),
            },
            { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
            {
              key: 'settings',
              label: 'Settings',
              content: (
                <div>
                  <AccountSection syncStatus={syncStatus} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
                  <DataManagement />
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
