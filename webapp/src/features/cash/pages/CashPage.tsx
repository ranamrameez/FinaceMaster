import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { Tabs } from '../../../components/Tabs';
import { Tooltip } from '../../../components/Tooltip';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { useAmountFormat } from '../../../hooks/useAmountFormat';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { hueStyle } from '../../../lib/statCardHues';
import { cashBalanceByCurrency, cashByCategory, cashMonthlyFlow, cashRunningLedger } from '../../../lib/calc/cashModule';
import { plannedCashProjection } from '../../../lib/calc/plannedBalance';
import { dlBarV, dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { defaultTimezoneForCurrency } from '../../../lib/datetime';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { ChartCard } from '../../qse/components/ChartCard';
import { parseCSV } from '../../../lib/csv';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { confirmAndDeleteLinkable, warnIfLinked } from '../../../lib/linkCascade';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { createEmptyCashWorkbook } from '../../../store/defaultCashWorkbook';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../../store/plannedCashWorkbookStore';
import type { CashEntry, CashWorkbook } from '../../../types/cashWorkbook';
import type { PlannedCashEntry } from '../../../types/plannedCash';

const today = () => new Date().toISOString().slice(0, 10);

function emptyEntry(defaultCurrency: string): CashEntry {
  return {
    id: crypto.randomUUID(), date: today(), type: 'IN', amount: 0, currencyCode: defaultCurrency,
    category: '', note: '', source: 'manual', timezone: defaultTimezoneForCurrency(defaultCurrency),
  };
}

function AddEntryForm({ knownCategories }: { knownCategories: string[] }) {
  const addEntry = useCashWorkbookStore((s) => s.addEntry);
  const defaultCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const [lastCurrency, setLastCurrency] = useLastCurrency('cash', defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [e, setE] = useState<CashEntry>(() => emptyEntry(lastCurrency));

  const submit = async () => {
    if (!e.amount || e.amount <= 0) return toast('Enter an amount.');
    if (!(await ensureSignedIn('Sign in to save cash entries.'))) return;
    addEntry({ ...e, category: e.category?.trim() || undefined, note: e.note?.trim() || undefined });
    toast(`${e.type === 'IN' ? 'Cash in' : 'Cash out'} logged.`);
    setE(emptyEntry(e.currencyCode));
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Date">
          <TextInput type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={e.type} onChange={(ev) => setE({ ...e, type: ev.target.value as 'IN' | 'OUT' })} width={90}>
            <option value="IN">Cash in</option>
            <option value="OUT">Cash out</option>
          </Select>
        </Field>
        <Field label="Amount" width={110}>
          <TextInput type="number" step="0.01" value={e.amount || ''} onChange={(ev) => setE({ ...e, amount: Number(ev.target.value) })} />
        </Field>
        <Field label="Currency" width={110}>
          <Select value={e.currencyCode} onChange={(ev) => { setE({ ...e, currencyCode: ev.target.value, timezone: defaultTimezoneForCurrency(ev.target.value) }); setLastCurrency(ev.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Category (optional)" width={140}>
          <TextInput
            list="cash-category-datalist"
            value={e.category}
            onChange={(ev) => setE({ ...e, category: ev.target.value })}
            placeholder="e.g. Gift, Misc"
          />
        </Field>
        <Field label="Note (optional)" width={180}>
          <TextInput value={e.note} onChange={(ev) => setE({ ...e, note: ev.target.value })} />
        </Field>
        <TimeZoneFields
          time={e.time}
          timezone={e.timezone}
          onTimeChange={(time) => setE({ ...e, time })}
          onTimezoneChange={(timezone) => setE({ ...e, timezone })}
        />
      </div>
      <datalist id="cash-category-datalist">
        {knownCategories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add entry
      </button>
    </Card>
  );
}

function BalancesSummary() {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
  const plannedEntries = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const { num } = useAmountFormat();
  const balances = cashBalanceByCurrency(entries);
  const codes = Object.keys(balances);
  if (!codes.length) return null;

  // Not-yet-executed plans, per currency — surfaced here (not just inside
  // the Planning tab) so "how much is still hanging over my balance" is
  // visible at a glance without a click, per a user report that stats
  // didn't show upcoming/in-process planned payments at all.
  const upcoming = plannedEntries.filter((p) => !p.executed);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => {
        const pending = upcoming.filter((p) => p.currencyCode === code);
        const net = pending.reduce((s, p) => s + (p.type === 'IN' ? p.amount : -p.amount), 0);
        return (
          <div key={code} className="stat-card card" style={hueStyle(balances[code] >= 0 ? 'var(--profit)' : 'var(--loss)')}>
            <div className="label">Balance ({code})</div>
            <MoneyValue n={balances[code]} currency={code} />
            {pending.length > 0 && (
              <div className="sub">
                {pending.length} upcoming plan{pending.length > 1 ? 's' : ''} (net {net >= 0 ? '+' : ''}
                {num(net)} {code})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CategoryBreakdown() {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
  const byCategory = cashByCategory(entries);
  const currencies = Object.keys(byCategory);
  if (!currencies.length) return null;

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>By category</h3>} style={{ marginBottom: 16 }}>
      {currencies.map((code) => (
        <div key={code} style={{ marginBottom: 12 }}>
          <div className="footer-note" style={{ marginBottom: 4 }}>{code}</div>
          <div className="table-scroll">
            <table>
              <tbody>
                {Object.entries(byCategory[code]).map(([cat, amount]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className={amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(amount, code)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </CollapsibleCard>
  );
}

function EntryList() {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
  const updateEntry = useCashWorkbookStore((s) => s.updateEntry);
  const deleteEntry = useCashWorkbookStore((s) => s.deleteEntry);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CashEntry | null>(null);

  const ledger = useMemo(() => cashRunningLedger(entries), [entries]);
  type Col = 'date' | 'type' | 'amount' | 'category';
  const sortValue = (r: (typeof ledger)[number], col: Col): number | string => {
    switch (col) {
      case 'type': return r.entry.type;
      case 'amount': return r.entry.amount;
      case 'category': return r.entry.category ?? '';
      default: return r.entry.date;
    }
  };
  const { sorted, Th } = useSortableRows(ledger, sortValue, 'date', 'desc');

  const startEdit = (e: CashEntry) => { setEditId(e.id); setEditRow({ ...e }); };
  const saveEdit = async () => {
    if (editId === null || !editRow) return;
    if (!(await warnIfLinked('cash', editId))) return;
    updateEntry(editId, editRow);
    toast('Entry updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="date">Date</Th>
            <Th col="type">Type</Th>
            <Th col="amount">Amount</Th>
            <Th col="category">Category</Th>
            <th>Note</th>
            <th>Balance</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ entry, balance }) =>
            editId === entry.id && editRow ? (
              <tr key={entry.id}>
                <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                <td>
                  <select value={editRow.type} onChange={(e) => setEditRow({ ...editRow, type: e.target.value as 'IN' | 'OUT' })}>
                    <option value="IN">Cash in</option>
                    <option value="OUT">Cash out</option>
                  </select>
                </td>
                <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
                <td><input value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} style={{ width: 100 }} /></td>
                <td><input value={editRow.note ?? ''} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} /></td>
                <td></td>
                <td className="footer-note">{entry.source === 'statement-import' ? `Import${entry.statementRef ? ` (${entry.statementRef})` : ''}` : 'Manual'}</td>
                <td>
                  <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                  <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                </td>
              </tr>
            ) : (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td className={entry.type === 'IN' ? 'pill-buy' : 'pill-sell'}>{entry.type === 'IN' ? 'Cash in' : 'Cash out'}</td>
                <td>{fmtMoney(entry.amount, entry.currencyCode)}</td>
                <td>{entry.category || '—'}</td>
                <td>{entry.note}</td>
                <td>{fmtMoney(balance, entry.currencyCode)}</td>
                <td className="footer-note">{entry.source === 'statement-import' ? `Import${entry.statementRef ? ` (${entry.statementRef})` : ''}` : 'Manual'}</td>
                <td>
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(entry)} />{' '}
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon size={13} />}
                    align="right"
                    onClick={() => confirmAndDeleteLinkable('cash', entry.id, () => deleteEntry(entry.id))}
                  />
                </td>
              </tr>
            ),
          )}
          {!sorted.length && <tr><td colSpan={8} className="footer-note">No cash entries yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function LedgerTab() {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
  const knownCategories = useMemo(
    () => [...new Set(entries.map((e) => e.category).filter((c): c is string => !!c))].sort(),
    [entries],
  );

  return (
    <div>
      <AddEntryForm knownCategories={knownCategories} />
      <BalancesSummary />
      <CategoryBreakdown />
      <EntryList />
    </div>
  );
}

/** README item 23 / MODULES_PLAN.md §11: per-module Analytics, first pass
 * for Cash — the three charts suggested for Cash there (category
 * breakdown, income/expense trend, balance-over-time). Since a Cash
 * workbook can hold entries in more than one currency (never converted,
 * per the app's cross-cutting rule), a currency picker selects which
 * currency's charts to show — QSE/PSX don't need this since each exchange
 * has exactly one settings.currency. */
function AnalyticsTab() {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
  // Charts read CSS-var-derived colors — subscribe so this re-renders (and
  // recomputes those colors) on a live theme switch, same pattern as every
  // other chart-bearing page in this app.
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const currencies = useMemo(() => [...new Set(entries.map((e) => e.currencyCode))].sort(), [entries]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

  const byCategory = useMemo(() => cashByCategory(entries)[effectiveCurrency] ?? {}, [entries, effectiveCurrency]);
  const categories = Object.keys(byCategory);
  const monthlyFlow = useMemo(() => cashMonthlyFlow(entries, effectiveCurrency), [entries, effectiveCurrency]);
  const balanceOverTime = useMemo(
    () => cashRunningLedger(entries).filter((r) => r.entry.currencyCode === effectiveCurrency),
    [entries, effectiveCurrency],
  );

  if (!currencies.length) {
    return <p className="footer-note">Add a cash entry first (Ledger tab) to see charts here.</p>;
  }

  return (
    <div>
      {currencies.length > 1 && (
        <Field label="Currency" width={120}>
          <Select value={effectiveCurrency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
        <ChartCard title="Category breakdown" empty={!categories.length}>
          <Doughnut
            data={{
              labels: categories,
              datasets: [{ data: categories.map((c) => Math.abs(byCategory[c])), backgroundColor: categories.map((c) => tickerColor(c)) }],
            }}
            options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
        <ChartCard title="Income vs. expense by month" empty={!monthlyFlow.length}>
          <Bar
            data={{
              labels: monthlyFlow.map((f) => f.month),
              datasets: [
                { label: 'Income', data: monthlyFlow.map((f) => f.income), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                { label: 'Expense', data: monthlyFlow.map((f) => f.expense), backgroundColor: cssVar('--loss') || '#e5484d' },
              ],
            }}
            options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
        <ChartCard title="Balance over time" empty={!balanceOverTime.length}>
          <Line
            data={{
              labels: balanceOverTime.map((r) => r.entry.date),
              datasets: [{ label: 'Balance', data: balanceOverTime.map((r) => r.balance), borderColor: '#5aa9c9', backgroundColor: '#5aa9c933', fill: true, tension: 0.2 }],
            }}
            options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
      </div>
    </div>
  );
}

/** README item 25 / MODULES_PLAN.md §13: browser-only CSV import, same
 * simple "map these columns" pattern already proven in Banking's statement
 * import (`BankPage.tsx`'s `ImportTab`) — no new infra. Cash entries don't
 * have a signed amount field like Bank does; instead the mapped Amount
 * column's sign (after an optional flip) decides IN vs OUT, and the stored
 * `amount` is always the absolute value. */
function ImportTab() {
  const addEntries = useCashWorkbookStore((s) => s.addEntries);
  const defaultCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  const [categoryCol, setCategoryCol] = useState('');
  const [flipSign, setFlipSign] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result));
      if (parsed.length < 2) {
        toast('Could not find any data rows in that file.');
        return;
      }
      const [head, ...body] = parsed;
      setFileName(file.name);
      setHeaders(head);
      setRows(body);
      setDateCol(head[0] ?? '');
      setAmountCol(head[1] ?? '');
      setCategoryCol('');
    };
    reader.readAsText(file);
  };

  const colIndex = (col: string) => headers.indexOf(col);
  const mapRow = (r: string[]) => {
    const rawAmount = Number(r[colIndex(amountCol)] ?? 0) * (flipSign ? -1 : 1);
    return {
      date: (r[colIndex(dateCol)] ?? '').trim(),
      type: (rawAmount >= 0 ? 'IN' : 'OUT') as 'IN' | 'OUT',
      amount: Math.abs(rawAmount),
      category: categoryCol ? (r[colIndex(categoryCol)] ?? '').trim() || undefined : undefined,
    };
  };
  const mappedPreview = rows.slice(0, 5).map(mapRow);

  const doImport = async () => {
    if (!dateCol || !amountCol) return toast('Map at least the date and amount columns.');
    if (!(await ensureSignedIn('Sign in to import entries.'))) return;
    const imported: CashEntry[] = rows
      .map(mapRow)
      .filter((r) => r.date && !Number.isNaN(r.amount) && r.amount !== 0)
      .map((r) => ({
        id: crypto.randomUUID(),
        date: r.date,
        type: r.type,
        amount: r.amount,
        currencyCode,
        category: r.category,
        source: 'statement-import' as const,
        statementRef: fileName,
      }));
    if (!imported.length) return toast('No valid rows to import after mapping — check your column choices.');
    addEntries(imported);
    toast(`Imported ${imported.length} entr${imported.length === 1 ? 'y' : 'ies'} from ${fileName}.`);
    setHeaders([]);
    setRows([]);
    setFileName('');
  };

  return (
    <div>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Import a CSV export of cash entries. This is a simple "map these columns" tool, not a parser for a
        specific spreadsheet format — pick which column is which below. A positive amount is treated as cash in,
        negative as cash out (check "Flip sign" if your export does the opposite).
      </p>
      <Field label="Currency for imported entries" width={140}>
        <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </Select>
      </Field>
      <div style={{ marginTop: 8 }}>
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
        {fileName && <span className="footer-note" style={{ marginLeft: 8 }}>{fileName} ({rows.length} rows)</span>}
      </div>

      {headers.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Map columns</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Field label="Date column" width={160}>
              <Select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <Field label="Amount column" width={160}>
              <Select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <Field label="Category column (optional)" width={160}>
              <Select value={categoryCol} onChange={(e) => setCategoryCol(e.target.value)}>
                <option value="">None</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 20 }} title="Check this if your export uses positive numbers for cash out.">
              <input type="checkbox" checked={flipSign} onChange={(e) => setFlipSign(e.target.checked)} />
              Flip sign
            </label>
          </div>

          <h4>Preview (first 5 rows)</h4>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th></tr></thead>
              <tbody>
                {mappedPreview.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td className={r.type === 'IN' ? 'pill-buy' : 'pill-sell'}>{r.type === 'IN' ? 'Cash in' : 'Cash out'}</td>
                    <td>{fmtMoney(r.amount, currencyCode)}</td>
                    <td>{r.category || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={doImport}>
            <PlusIcon />Import {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}
          </button>
        </Card>
      )}
    </div>
  );
}

/** User request 2026-08-23: a "what if I spend on this" scenario planner —
 * see `types/plannedCash.ts`'s doc comment for the full reasoning. Mirrors
 * the QSE/PSX Trade Planner's "separate plan, mark as done converts it
 * into a real entry" pattern rather than an in-place status flag on a
 * normal CashEntry. */
function emptyPlan(defaultCurrency: string): PlannedCashEntry {
  return { id: crypto.randomUUID(), date: today(), type: 'OUT', amount: 0, currencyCode: defaultCurrency, category: '', note: '' };
}

function BalanceProjectionSummary() {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
  const plannedEntries = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const settings = usePlannedCashWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePlannedCashWorkbookStore((s) => s.updateSettings);
  const projection = useMemo(() => plannedCashProjection(entries, plannedEntries), [entries, plannedEntries]);
  const codes = Object.keys(projection);

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Balance projection</h3>} style={{ marginBottom: 16 }}>
      <p className="footer-note" style={{ marginTop: 0 }}>
        See what your balance would look like if every plan below actually happened — a reality check before you
        spend. Choose what you want to see:
      </p>
      <div className="row" style={{ gap: 16, marginBottom: 12 }}>
        <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={settings.showRealBalance} onChange={(e) => updateSettings({ showRealBalance: e.target.checked })} />
          Real balance
        </label>
        <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={settings.showPlannedBalance} onChange={(e) => updateSettings({ showPlannedBalance: e.target.checked })} />
          Planned balance
        </label>
      </div>
      {!codes.length ? (
        <p className="footer-note">No balance yet — add a cash entry or a plan below.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8 }}>
          {codes.map((code) => (
            <div key={code} className="stat-card card">
              <div className="label">{code}</div>
              {settings.showRealBalance && (
                <div className={projection[code].real >= 0 ? 'pill-buy' : 'pill-sell'}>Real: {fmtMoney(projection[code].real, code)}</div>
              )}
              {settings.showPlannedBalance && (
                <div className={projection[code].planned >= 0 ? 'pill-buy' : 'pill-sell'}>
                  Planned: {fmtMoney(projection[code].planned, code)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}

/** README item 86 (2026-08-26 feedback): "Add a plan" shouldn't be
 * permanently visible either — same FAB+popup treatment already used for
 * EMI's "Add a loan" (Done item 166) and Banking's "Add an account". */
function AddPlanFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500 }}>
        <Tooltip text="Add a plan" align="right">
          <button
            className="btn"
            onClick={() => setOpen(true)}
            aria-label="Add a plan"
            style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, fontSize: 22, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
          >
            <PlusIcon />
          </button>
        </Tooltip>
      </div>
      {open && (
        <Modal title="Add a plan" onClose={() => setOpen(false)}>
          <AddPlanForm onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddPlanForm({ onSaved }: { onSaved?: () => void }) {
  const addPlan = usePlannedCashWorkbookStore((s) => s.addEntry);
  const defaultCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const [lastCurrency, setLastCurrency] = useLastCurrency('cash', defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [p, setP] = useState<PlannedCashEntry>(() => emptyPlan(lastCurrency));

  const submit = async () => {
    if (!p.amount || p.amount <= 0) return toast('Enter an amount.');
    if (!(await ensureSignedIn('Sign in to save plans.'))) return;
    addPlan({ ...p, id: crypto.randomUUID(), category: p.category?.trim() || undefined, note: p.note?.trim() || undefined });
    toast('Plan added.');
    setP(emptyPlan(p.currencyCode));
    onSaved?.();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Expected date">
          <TextInput type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={p.type} onChange={(e) => setP({ ...p, type: e.target.value as 'IN' | 'OUT' })} width={90}>
            <option value="IN">Cash in</option>
            <option value="OUT">Cash out</option>
          </Select>
        </Field>
        <Field label="Amount" width={110}>
          <TextInput type="number" step="0.01" value={p.amount || ''} onChange={(e) => setP({ ...p, amount: Number(e.target.value) })} />
        </Field>
        <Field label="Currency" width={110}>
          <Select value={p.currencyCode} onChange={(e) => { setP({ ...p, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Category (optional)" width={140}>
          <TextInput value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} placeholder="e.g. Rent" />
        </Field>
        <Field label="Note (optional)" width={180}>
          <TextInput value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add plan
      </button>
    </div>
  );
}

function PlanList() {
  const plans = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const updatePlan = usePlannedCashWorkbookStore((s) => s.updateEntry);
  const deletePlan = usePlannedCashWorkbookStore((s) => s.deleteEntry);
  const addEntry = useCashWorkbookStore((s) => s.addEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PlannedCashEntry | null>(null);

  const sorted = useMemo(() => [...plans].sort((a, b) => a.date.localeCompare(b.date)), [plans]);

  const startEdit = (p: PlannedCashEntry) => { setEditId(p.id); setEditRow({ ...p }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updatePlan(editId, editRow);
    toast('Plan updated.');
    setEditId(null);
    setEditRow(null);
  };

  const markDone = async (p: PlannedCashEntry) => {
    if (!(await ensureSignedIn('Sign in to save cash entries.'))) return;
    addEntry({
      id: crypto.randomUUID(),
      date: p.date,
      type: p.type,
      amount: p.amount,
      currencyCode: p.currencyCode,
      category: p.category,
      note: p.note,
      source: 'manual',
    });
    updatePlan(p.id, { executed: true });
    toast('Marked as done — added to your Cash ledger.');
  };

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Plans</h3>}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th><th>Note</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {sorted.map((p) =>
              editId === p.id && editRow ? (
                <tr key={p.id}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td>
                    <select value={editRow.type} onChange={(e) => setEditRow({ ...editRow, type: e.target.value as 'IN' | 'OUT' })}>
                      <option value="IN">Cash in</option>
                      <option value="OUT">Cash out</option>
                    </select>
                  </td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td><input value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} style={{ width: 100 }} /></td>
                  <td><input value={editRow.note ?? ''} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} /></td>
                  <td></td>
                  <td>
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td className={p.type === 'IN' ? 'pill-buy' : 'pill-sell'}>{p.type === 'IN' ? 'Cash in' : 'Cash out'}</td>
                  <td>{fmtMoney(p.amount, p.currencyCode)}</td>
                  <td>{p.category || '—'}</td>
                  <td>{p.note}</td>
                  <td className="footer-note">{p.executed ? 'Done' : 'Planned'}</td>
                  <td>
                    {!p.executed && (
                      <button className="btn secondary small" onClick={() => markDone(p)}>Mark as done</button>
                    )}{' '}
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(p)} />{' '}
                    <IconButton
                      label="Delete"
                      icon={<TrashIcon size={13} />}
                      align="right"
                      onClick={async () => {
                        if (await confirmDialog('This cannot be undone.', 'Delete this plan?')) deletePlan(p.id);
                      }}
                    />
                  </td>
                </tr>
              ),
            )}
            {!sorted.length && <tr><td colSpan={7} className="footer-note">No plans yet — add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

function PlanningAccountSection({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const plans = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady) return null;
  return (
    <Card style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Plans — account</h3>
      <p className="footer-note">{syncStatus}</p>
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
          <p style={{ marginTop: 0 }}>No data found in the cloud for this account's plans. This won't upload automatically.</p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                `This will overwrite anything currently in the cloud for this account's plans (there is nothing there now, but confirming since this can't be undone).`,
                `Upload ${plans.length} local plan${plans.length === 1 ? '' : 's'} to the cloud?`,
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
            Upload local data to cloud ({plans.length} plans)
          </button>
        </Notice>
      )}
    </Card>
  );
}

function PlanningTab({
  plannedSyncStatus,
  plannedCloudEmpty,
  uploadPlannedLocalToCloud,
}: {
  plannedSyncStatus: string;
  plannedCloudEmpty: boolean;
  uploadPlannedLocalToCloud: () => Promise<void>;
}) {
  return (
    <div>
      <BalanceProjectionSummary />
      <PlanList />
      <AddPlanFab />
      <PlanningAccountSection syncStatus={plannedSyncStatus} cloudEmpty={plannedCloudEmpty} uploadLocalToCloud={uploadPlannedLocalToCloud} />
    </div>
  );
}

function DataManagement() {
  const workbook = useCashWorkbookStore((s) => s.workbook);
  const setWorkbook = useCashWorkbookStore((s) => s.setWorkbook);
  const updateSettings = useCashWorkbookStore((s) => s.updateSettings);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<CashWorkbook>;
        setWorkbook({ ...createEmptyCashWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all cash entries?');
    if (!ok) return;
    setWorkbook(createEmptyCashWorkbook());
    toast('All cash data cleared.');
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>General</h3>
        <Field label="Default currency (pre-fills new entries only)" width={140}>
          <Select value={workbook.settings.defaultCurrency} onChange={(e) => updateSettings({ defaultCurrency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
      </Card>
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
    </div>
  );
}

function AccountSection({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
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
          <p style={{ marginTop: 0 }}>
            No data found in the cloud for this account's Cash workbook. This app will <strong>not</strong> upload
            anything automatically — if you expected existing data here and don't see it, stop and investigate
            before uploading rather than overwriting.
          </p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                `This will overwrite anything currently in the cloud for this account's Cash data (there is nothing there now, but confirming since this can't be undone).`,
                `Upload ${entries.length} local entr${entries.length === 1 ? 'y' : 'ies'} to the cloud?`,
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
            Upload local data to cloud ({entries.length} entries)
          </button>
        </Notice>
      )}
    </Card>
  );
}

export function CashPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
  plannedSyncStatus,
  plannedCloudEmpty,
  uploadPlannedLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
  plannedSyncStatus: string;
  plannedCloudEmpty: boolean;
  uploadPlannedLocalToCloud: () => Promise<void>;
}) {
  return (
    <div>
      <h1 className="pagetitle">Cash</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Track physical/informal cash — cash in hand, gifts, small informal amounts. Each entry keeps its own
        currency; balances and category totals are grouped per currency, never converted.
      </p>
      <Tabs
        tabs={[
          { key: 'ledger', label: 'Ledger', content: <LedgerTab /> },
          { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
          {
            key: 'planning',
            label: 'Planning',
            content: (
              <PlanningTab
                plannedSyncStatus={plannedSyncStatus}
                plannedCloudEmpty={plannedCloudEmpty}
                uploadPlannedLocalToCloud={uploadPlannedLocalToCloud}
              />
            ),
          },
          { key: 'import', label: 'Import', content: <ImportTab /> },
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
    </div>
  );
}
