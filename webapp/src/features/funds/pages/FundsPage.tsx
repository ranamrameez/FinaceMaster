import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Notice';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { defaultTimezoneForCurrency } from '../../../lib/datetime';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { getMarketPrice } from '../../../lib/calc';
import { allocationByCategory, contributionVsValueSeries } from '../../../lib/calc/fundsModule';
import { impliedFundNav } from '../../../lib/calc/fundsDailyHistoryImport';
import {
  buildFundsImportPlan,
  materializeFundsImport,
  parseFundsSnapshotCSV,
  type FundSnapshotPlanRow,
  type FundSnapshotRow,
} from '../../../lib/calc/fundsSnapshotImport';
import { toCSV } from '../../../lib/csv';
import { DailyHistoryImportSection } from '../components/DailyHistoryImportSection';
import { getDailyPriceHistory } from '../../../lib/calc/priceHistory';
import { transferRunningBalance } from '../../../lib/calc/transferBalance';
import { CURRENCIES } from '../../../lib/currencies';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { confirmAndDeleteLinkable, createLinkedTransfer, warnIfLinked } from '../../../lib/linkCascade';
import { getLastTransferSource, rememberTransferSource } from '../../../hooks/useLastTransferSource';
import type { LinkSideConfig } from '../../../types/interEntityTransfer';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { createEmptyFundsWorkbook } from '../../../store/defaultFundsWorkbook';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import type { Fund, FundsWorkbook } from '../../../types/fundsWorkbook';
import type { Transaction, Transfer } from '../../../types/workbook';
import { useFundsDerived } from '../hooks/useFundsDerived';
import { ChartCard } from '../../qse/components/ChartCard';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();
const CATEGORIES: Fund['category'][] = ['Equity', 'Debt', 'Hybrid', 'International', 'Other'];

function emptyFund(defaultCurrency: string): Fund {
  return { id: '', name: '', code: '', platform: '', category: 'Equity', currencyCode: defaultCurrency };
}

/* ============================== Add fund ============================== */

/** Floating "add a fund" button (user feedback 2026-08-27: "who adds
 * Funds... daily? [entity add/edit] isn't a routine task, use FABs" — same
 * round-FAB + popup pattern already established for EMI/Banking/Cash/Bank
 * Planning, README Done items 166/170). */
function AddFundFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500 }}>
        <Tooltip text="Add a fund" align="right">
          <button
            className="btn"
            onClick={() => setOpen(true)}
            aria-label="Add a fund"
            style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, fontSize: 22, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
          >
            <PlusIcon />
          </button>
        </Tooltip>
      </div>
      {open && (
        <Modal title="Add a fund" onClose={() => setOpen(false)}>
          <AddFundForm onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddFundForm({ onSaved }: { onSaved?: () => void } = {}) {
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
    onSaved?.();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Fund name" width={200} required>
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Vanguard Total World Stock ETF" />
        </Field>
        <Field label="Fund code" width={100} required>
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
        <Field label="Currency" width={100} required>
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
    </div>
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
              <div className="stat-card card" style={hueStyle(profit >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Net profit</div><MoneyValue n={profit} currency={code} after={` (${profitPct.toFixed(1)}%)`} /></div>
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

/* ============================== Import (mode switch) ============================== */

/** Two structurally different import sources, so this just picks between
 * two otherwise-independent sections rather than trying to unify them:
 * Snapshot Import (one CSV row per fund, aggregate totals only) and Daily
 * History Import (an xlsx with one sheet per fund, a full day-by-day
 * balance log — see `DailyHistoryImportSection.tsx`'s own doc comment for
 * why that's a meaningfully richer source, not just a different file
 * format for the same data). */
function ImportSection() {
  const [mode, setMode] = useState<'snapshot' | 'daily'>('daily');
  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={mode === 'daily' ? 'chip active' : 'chip'} onClick={() => setMode('daily')}>
          Daily history (XLSX)
        </button>
        <button className={mode === 'snapshot' ? 'chip active' : 'chip'} onClick={() => setMode('snapshot')}>
          Snapshot (CSV)
        </button>
      </div>
      {mode === 'daily' ? <DailyHistoryImportSection /> : <SnapshotImportSection />}
    </div>
  );
}

/* ============================== Snapshot import ============================== */

/** Imports a "portfolio snapshot" CSV — one row per fund with aggregate
 * Total Invested / Withdrawn / Current Balance, as opposed to a dated
 * transaction log (see `lib/calc/fundsSnapshotImport.ts` for the full
 * reasoning and the real-data test that validates it). Deliberately a
 * separate flow from Bank/Cash's "map these columns" statement importer —
 * this source format's columns are fixed, and there's no per-row date to
 * map, only one shared "as of" date for the whole batch. */
function SnapshotImportSection() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const addTransactions = useFundsWorkbookStore((s) => s.addTransactions);
  const setMarketPrice = useFundsWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const [lastCurrency, setLastCurrency] = useLastCurrency('funds', 'USD');
  const fileInput = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<FundSnapshotRow[] | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(today());
  const [currencyCode, setCurrencyCode] = useState(lastCurrency);
  const [defaultCategory, setDefaultCategory] = useState<Fund['category']>('Other');
  const [busy, setBusy] = useState(false);

  const plan: FundSnapshotPlanRow[] = useMemo(
    () => (rows ? buildFundsImportPlan(rows, workbook.funds) : []),
    [rows, workbook.funds],
  );

  const duplicateCodes = useMemo(() => {
    if (!rows) return [];
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.code, (counts.get(r.code) ?? 0) + 1));
    return [...counts.entries()].filter(([, n]) => n > 1).map(([code]) => code);
  }, [rows]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseFundsSnapshotCSV(String(reader.result));
      if (!parsed.length) {
        toast('No fund rows found — expected a "FundCode" column header.');
        return;
      }
      setRows(parsed);
      toast(`Parsed ${parsed.length} fund row(s) — review below before importing.`);
    };
    reader.readAsText(file);
  };

  const editRow = (i: number, patch: Partial<FundSnapshotRow>) => {
    if (!rows) return;
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const runImport = async () => {
    if (!plan.length) return;
    if (!(await ensureSignedIn('Sign in to import funds.'))) return;
    setBusy(true);
    try {
      const { newFunds, transactions, navUpdates } = materializeFundsImport(plan, { snapshotDate, currencyCode, defaultCategory });
      if (newFunds.length) setWorkbook({ ...workbook, funds: [...workbook.funds, ...newFunds] });
      if (transactions.length) addTransactions(transactions);
      navUpdates.forEach((u) => setMarketPrice(u.ticker, u.price));
      setLastCurrency(currencyCode);
      toast(`Imported ${plan.length} fund(s): ${newFunds.length} new, ${transactions.length} transaction(s).`);
      setRows(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        For a spreadsheet that tracks Total Invested / Withdrawn / Current Balance per fund rather than individual
        dated trades. Since there's no real transaction history in that shape, this reconstructs a buy (and, if
        withdrawn, a sell) dated on the single "as of" date below, at whatever NAV reproduces your reported balances
        exactly — it's an approximation of your real trade history, not a replay of it. Re-importing a fund that
        already has transactions here adds another entry rather than replacing anything, so this is best used once,
        as a starting point.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn secondary" onClick={() => fileInput.current?.click()}>Choose CSV file</button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
        {rows && (
          <>
            <Field label="As-of date" width={140}>
              <TextInput type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} />
            </Field>
            <Field label="Currency" width={100}>
              <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
            <Field label="Category for new funds" width={160}>
              <Select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value as Fund['category'])}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </>
        )}
      </div>

      {rows && duplicateCodes.length > 0 && (
        <Notice tone="warning" style={{ marginBottom: 12 }}>
          Fund code{duplicateCodes.length > 1 ? 's' : ''} {duplicateCodes.join(', ')} appear{duplicateCodes.length === 1 ? 's' : ''} more
          than once — each row below still becomes its own fund. If a row is actually a mistake (wrong platform/code
          typed into the wrong line), fix it in the table below before importing rather than after.
        </Notice>
      )}

      {rows && (
        <>
          <div className="table-scroll" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Platform</th><th>Code</th><th>Name</th><th>Invested</th><th>Withdrawn</th><th>Current balance</th><th>Status</th><th>New NAV</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p, i) => (
                  <tr key={i}>
                    <td><TextInput value={p.row.bank} onChange={(e) => editRow(i, { bank: e.target.value })} style={{ width: 140 }} /></td>
                    <td><TextInput value={p.row.code} onChange={(e) => editRow(i, { code: e.target.value.toUpperCase() })} style={{ width: 90 }} /></td>
                    <td><TextInput value={p.row.name} onChange={(e) => editRow(i, { name: e.target.value })} style={{ width: 200 }} /></td>
                    <td>{fmtMoney(p.row.totalInvested, currencyCode)}</td>
                    <td>{fmtMoney(p.row.withdrawn, currencyCode)}</td>
                    <td>{fmtMoney(p.row.currentBalance, currencyCode)}</td>
                    <td className={p.closed ? 'pill-sell' : 'pill-buy'}>{p.closed ? 'Closed' : 'Open'}</td>
                    <td>{p.navUpdate !== null ? fmtPrice(p.navUpdate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" disabled={busy} onClick={runImport}>
            <PlusIcon />Import {plan.length} fund{plan.length === 1 ? '' : 's'}
          </button>
        </>
      )}
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
  const [balanceInput, setBalanceInput] = useState('');
  const [txAction, setTxAction] = useState<'BUY' | 'SELL'>('BUY');
  const [txDate, setTxDate] = useState(today());
  const [txUnits, setTxUnits] = useState(0);
  const [txNav, setTxNav] = useState(0);
  const [txTime, setTxTime] = useState<string | undefined>(undefined);
  const [txTimezone, setTxTimezone] = useState<string | undefined>(() => defaultTimezoneForCurrency(fund.currencyCode));
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

  /** User-reported, urgent (2026-08-27): "I only have info of daily balance
   * update rather than NAV. so give me an option to update fund balance
   * other than deposit and withdraw." Some funds are only ever tracked by
   * their total balance (matches the Daily History Import's own per-row
   * shape, Done item 151) — this is the same math as that importer's
   * per-row NAV point (`newBlc / units`) for the no-cash-flow case, just as
   * a single quick entry instead of a full spreadsheet: given today's total
   * balance and the units already held, the implied per-unit NAV is
   * `balance / units`, assuming no deposit/withdrawal happened since the
   * last update (a real cash flow still goes through the existing Invest/
   * Withdraw form below, same as today). Reuses `setMarketPrice` exactly
   * as `commitNav` does — no new store action needed, since this only
   * changes how the NAV number itself is computed, not how it's saved. */
  const commitBalance = async () => {
    const val = parseFloat(balanceInput);
    if (!val || val <= 0) return toast('Enter a valid balance.');
    const impliedNav = impliedFundNav(val, units);
    if (impliedNav === null) return toast('Add an initial investment first — there are no units to divide this balance across yet.');
    if (!(await ensureSignedIn('Sign in to save balance updates.'))) return;
    setMarketPrice(fund.id, impliedNav);
    toast(`${fund.code} balance saved: ${fmtMoney(val, fund.currencyCode)} → implied NAV ${fmtPrice(impliedNav)}`);
    setBalanceInput('');
  };

  const submitTx = async () => {
    if (!txUnits || !txNav) return toast('Enter units and NAV.');
    if (!(await ensureSignedIn('Sign in to save this transaction.'))) return;
    addTransaction({ date: txDate, ticker: fund.id, action: txAction, shares: txUnits, price: txNav, time: txTime, timezone: txTimezone });
    toast(`${txAction === 'BUY' ? 'Invested' : 'Withdrew'} logged.`);
    setTxUnits(0);
    setTxTime(undefined);
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
              <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveFund} />
              <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditingFund(false)} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{fund.name}</div>
              <div className="footer-note">{fund.code} · {fund.platform} · {fund.category} · {fund.currencyCode}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => { setEditFund(fund); setEditingFund(true); }} />
              <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={deleteFund} />
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card"><div className="label">Units held</div><div className="value">{fmt(units, 2)}</div></div>
          <div className="stat-card card">
            <Tooltip text="NAV = Net Asset Value, the price of one unit of this fund. This is the average price you paid per unit across all your purchases.">
              <div className="label" style={{ cursor: 'pointer' }}>Avg NAV cost</div>
            </Tooltip>
            <div className="value">{fmtPrice(avgNav)}</div>
          </div>
          <div className="stat-card card"><div className="label">Invested</div><MoneyValue n={invested} currency={fund.currencyCode} /></div>
          <div className="stat-card card"><div className="label">Current value</div><MoneyValue n={currentValue} currency={fund.currencyCode} /></div>
          <div className="stat-card card" style={hueStyle(profit >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Net profit</div><MoneyValue n={profit} currency={fund.currencyCode} after={` (${profitPct.toFixed(1)}%)`} /></div>
          <div className="stat-card card">
            <Tooltip text="XIRR: your annualized rate of return, accounting for the exact dates and amounts of every purchase — a fairer comparison than a flat percentage when you've invested at different times.">
              <div className="label" style={{ cursor: 'pointer' }}>XIRR</div>
            </Tooltip>
            <div className="value">{rate !== null ? `${(rate * 100).toFixed(1)}%` : '—'}</div>
          </div>
        </div>
      </Card>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="number" step="0.0001" placeholder="Update NAV" value={navInput} onChange={(e) => setNavInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitNav()} style={{ width: 130 }} />
        <button className="btn secondary small" onClick={commitNav}><SaveIcon size={12} />Save NAV</button>
        <span className="footer-note">Current NAV: {currentNav ? fmtPrice(currentNav) : '—'}</span>
        <span className="footer-note" style={{ margin: '0 4px' }}>or</span>
        <Tooltip text="Don't know the per-unit NAV? Enter your fund's current total balance instead — the app computes the implied NAV from the units you already hold, assuming no deposit/withdrawal happened since your last update.">
          <input
            type="number"
            step="0.01"
            placeholder="Update balance"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitBalance()}
            style={{ width: 140 }}
            disabled={units <= 0}
          />
        </Tooltip>
        <button className="btn secondary small" onClick={commitBalance} disabled={units <= 0}><SaveIcon size={12} />Save balance</button>
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
        <TimeZoneFields time={txTime} timezone={txTimezone} onTimeChange={setTxTime} onTimezoneChange={setTxTimezone} />
        <button className="btn" onClick={submitTx}><PlusIcon />Add</button>
      </div>

      <CollapsibleCard
        title={<h3 style={{ margin: 0 }}>Transactions</h3>}
        headerExtra={
          txs.length > 0 ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="From (optional)">
                <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label="To (optional)">
                <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <button className="btn secondary" onClick={exportStatement}>Export CSV</button>
            </div>
          ) : undefined
        }
      >
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
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditIndex(null)} />
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
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(i, t)} />{' '}
                    <IconButton
                      label="Delete"
                      icon={<TrashIcon size={13} />}
                      align="right"
                      onClick={async () => {
                        if (await confirmDialog('This cannot be undone.', 'Delete this transaction?')) deleteTransaction(i);
                      }}
                    />
                  </td>
                </tr>
              ),
            )}
            {!txs.length && <tr><td colSpan={6} className="footer-note">No transactions for this fund yet.</td></tr>}
          </tbody>
        </table>
      </div>
      </CollapsibleCard>
    </div>
  );
}

/* ============================== Transfers ============================== */

/** Funds' `transfers` field is inherited from the shared `createWorkbookStore`
 * factory (same shape as QSE/PSX's own Transfer, since Funds reuses that
 * factory wholesale) but was never given a native add/edit UI — real
 * deposits/withdrawals of cash into or out of a Funds account (as opposed
 * to buying/selling fund units) had nowhere to go except the standalone
 * Transfers page's generic linking form. This closes that gap, and folds
 * in Pending item 62's direct-link shortcut at the same time — same
 * pattern already built for QSE/PSX/Rentals/Personal Loans. */
function FundsLinkedTransferFields({ date, type, gross, onLinked }: { date: string; type: Transfer['type']; gross: number; onLinked: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const fundsSide: LinkSideConfig = { module: 'funds' };
  const remembered = getLastTransferSource(fundsSide);
  const [otherModule, setOtherModule] = useState<'bank' | 'cash'>(remembered?.module === 'cash' ? 'cash' : 'bank');
  const [otherAccountId, setOtherAccountId] = useState(remembered?.ref ?? bankAccounts[0]?.id ?? '');

  const create = async () => {
    if (gross <= 0) return toast('Enter an amount first.');
    if (otherModule === 'bank' && !otherAccountId) return toast('Add a bank account on the Banking page first.');
    if (!(await ensureSignedIn('Sign in to save transfers.'))) return;
    const other: LinkSideConfig = otherModule === 'bank' ? { module: 'bank', ref: otherAccountId } : { module: 'cash', currencyCode: cashCurrency };
    const input = {
      date,
      fromAmount: gross,
      toAmount: gross,
      from: type === 'DEPOSIT' ? other : fundsSide,
      to: type === 'DEPOSIT' ? fundsSide : other,
    };
    const result = createLinkedTransfer(input);
    if ('error' in result) return toast(result.error);
    rememberTransferSource(fundsSide, other);
    toast('Linked transfer added — also recorded on the other side.');
    onLinked();
  };

  return (
    <>
      <select value={otherModule} onChange={(e) => setOtherModule(e.target.value as 'bank' | 'cash')}>
        <option value="bank">Bank account</option>
        <option value="cash">Cash</option>
      </select>
      {otherModule === 'bank' && (
        bankAccounts.length ? (
          <select value={otherAccountId} onChange={(e) => setOtherAccountId(e.target.value)}>
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
          </select>
        ) : (
          <span className="footer-note">No bank accounts yet.</span>
        )
      )}
      <button className="btn" onClick={create}>
        <PlusIcon />Link &amp; add
      </button>
    </>
  );
}

function FundsTransferForm() {
  const addTransfer = useFundsWorkbookStore((s) => s.addTransfer);
  const ensureSignedIn = useEnsureSignedIn();
  const [t, setT] = useState<Omit<Transfer, 'id'>>({ date: today(), type: 'DEPOSIT', gross: 0, fee: 0 });
  const [linkMode, setLinkMode] = useState(false);

  const reset = () => setT({ date: today(), type: 'DEPOSIT', gross: 0, fee: 0 });

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} />
        <select value={t.type} onChange={(e) => setT({ ...t, type: e.target.value as Transfer['type'] })}>
          <option value="DEPOSIT">Deposit</option>
          <option value="WITHDRAWAL">Withdrawal</option>
        </select>
        <input
          type="number"
          placeholder="Amount"
          value={t.gross || ''}
          onChange={(e) => setT({ ...t, gross: Number(e.target.value) })}
          style={{ width: 100 }}
        />
        {linkMode ? (
          <FundsLinkedTransferFields date={t.date} type={t.type} gross={t.gross} onLinked={reset} />
        ) : (
          <button
            className="btn"
            onClick={async () => {
              if (t.gross <= 0) return toast('Enter an amount.');
              if (!(await ensureSignedIn('Sign in to save transfers.'))) return;
              addTransfer({ ...t, id: crypto.randomUUID() });
              toast('Transfer added.');
              reset();
            }}
          >
            <PlusIcon />Add
          </button>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
        <input type="checkbox" checked={linkMode} onChange={(e) => setLinkMode(e.target.checked)} />
        Link this to a Bank account or Cash (creates a matching entry there too, instead of just here)
      </label>
    </div>
  );
}

function FundsTransfersSection() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const updateTransfer = useFundsWorkbookStore((s) => s.updateTransfer);
  const deleteTransfer = useFundsWorkbookStore((s) => s.deleteTransfer);
  const currency = workbook.settings.defaultCurrency;
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Transfer | null>(null);

  const balances = useMemo(() => transferRunningBalance(workbook.transfers), [workbook.transfers]);

  type TransferCol = 'date' | 'type' | 'gross' | 'fee' | 'balance';
  const sortValue = (t: Transfer, col: TransferCol): number | string => {
    switch (col) {
      case 'type': return t.type;
      case 'gross': return t.gross;
      case 'fee': return t.fee;
      case 'balance': return balances.get(t.id) ?? 0;
      default: return t.date;
    }
  };
  const { sorted, Th } = useSortableRows(workbook.transfers, sortValue, 'date', 'desc');

  const startEdit = (t: Transfer) => { setEditId(t.id); setEditRow({ ...t }); };
  const saveEdit = async () => {
    if (editId === null || !editRow) return;
    if (!(await warnIfLinked('funds', editId))) return;
    updateTransfer(editId, editRow);
    toast('Transfer updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Cash moved into or out of this Funds account, separate from buying/selling fund units —
        e.g. topping up before a purchase, or withdrawing after a redemption.
      </p>
      <FundsTransferForm />
      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <Th col="date">Date</Th>
              <Th col="type">Type</Th>
              <Th col="gross">Gross</Th>
              <Th col="fee">Fee</Th>
              <Th col="balance">Balance</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) =>
              editId === t.id && editRow ? (
                <tr key={t.id}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td>
                    <select value={editRow.type} onChange={(e) => setEditRow({ ...editRow, type: e.target.value as Transfer['type'] })}>
                      <option value="DEPOSIT">Deposit</option>
                      <option value="WITHDRAWAL">Withdrawal</option>
                    </select>
                  </td>
                  <td><input type="number" value={editRow.gross} onChange={(e) => setEditRow({ ...editRow, gross: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td><input type="number" value={editRow.fee} onChange={(e) => setEditRow({ ...editRow, fee: Number(e.target.value) })} style={{ width: 70 }} /></td>
                  <td></td>
                  <td>
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.type}</td>
                  <td>{fmtMoney(t.gross, currency)}</td>
                  <td>{fmtMoney(t.fee, currency)}</td>
                  <td>
                    <Tooltip text="Running net cash contributed, in date order.">
                      <span>{fmtMoney(balances.get(t.id) ?? 0, currency)}</span>
                    </Tooltip>
                  </td>
                  <td>
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(t)} />{' '}
                    <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => confirmAndDeleteLinkable('funds', t.id, () => deleteTransfer(t.id))} />
                  </td>
                </tr>
              ),
            )}
            {!sorted.length && <tr><td colSpan={6} className="footer-note">No transfers yet.</td></tr>}
          </tbody>
        </table>
      </div>
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
                  <FundList onSelect={setSelected} />
                  <AddFundFab />
                </div>
              ),
            },
            { key: 'transfers', label: 'Transfers', content: <FundsTransfersSection /> },
            { key: 'import', label: 'Import', content: <ImportSection /> },
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
