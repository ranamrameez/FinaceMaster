import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Card } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { cashBalanceByCurrency, cashByCategory, cashRunningLedger } from '../../../lib/calc/cashModule';
import { parseCSV } from '../../../lib/csv';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { confirmAndDeleteLinkable } from '../../../lib/linkCascade';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { createEmptyCashWorkbook } from '../../../store/defaultCashWorkbook';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import type { CashEntry, CashWorkbook } from '../../../types/cashWorkbook';

const today = () => new Date().toISOString().slice(0, 10);

function emptyEntry(defaultCurrency: string): CashEntry {
  return { id: crypto.randomUUID(), date: today(), type: 'IN', amount: 0, currencyCode: defaultCurrency, category: '', note: '', source: 'manual' };
}

function AddEntryForm({ knownCategories }: { knownCategories: string[] }) {
  const addEntry = useCashWorkbookStore((s) => s.addEntry);
  const defaultCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [e, setE] = useState<CashEntry>(() => emptyEntry(defaultCurrency));

  const submit = async () => {
    if (!e.amount || e.amount <= 0) return toast('Enter an amount.');
    if (!(await ensureSignedIn('Sign in to save cash entries.'))) return;
    addEntry({ ...e, category: e.category?.trim() || undefined, note: e.note?.trim() || undefined });
    toast(`${e.type === 'IN' ? 'Cash in' : 'Cash out'} logged.`);
    setE(emptyEntry(defaultCurrency));
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
          <Select value={e.currencyCode} onChange={(ev) => setE({ ...e, currencyCode: ev.target.value })}>
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
  const balances = cashBalanceByCurrency(entries);
  const codes = Object.keys(balances);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="stat-card card">
          <div className="label">Balance ({code})</div>
          <div className={`value ${balances[code] >= 0 ? 'pill-buy' : 'pill-sell'}`}>{fmtMoney(balances[code], code)}</div>
        </div>
      ))}
    </div>
  );
}

function CategoryBreakdown() {
  const entries = useCashWorkbookStore((s) => s.workbook.entries);
  const byCategory = cashByCategory(entries);
  const currencies = Object.keys(byCategory);
  if (!currencies.length) return null;

  return (
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>By category</h3>
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
    </Card>
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
  const saveEdit = () => {
    if (editId === null || !editRow) return;
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
                  <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                  <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
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
                  <button className="btn secondary small" onClick={() => startEdit(entry)}>Edit</button>{' '}
                  <button
                    className="btn secondary small"
                    onClick={() => confirmAndDeleteLinkable('cash', entry.id, () => deleteEntry(entry.id))}
                  >
                    <TrashIcon size={12} />Delete
                  </button>
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
        <div className="card" style={{ marginTop: 8, borderLeft: '3px solid var(--warn, orange)' }}>
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
        </div>
      )}
    </Card>
  );
}

export function CashPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
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
