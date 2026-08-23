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
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { createEmptyCashWorkbook } from '../../../store/defaultCashWorkbook';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import type { CashEntry, CashWorkbook } from '../../../types/cashWorkbook';

const today = () => new Date().toISOString().slice(0, 10);

function emptyEntry(defaultCurrency: string): CashEntry {
  return { date: today(), type: 'IN', amount: 0, currencyCode: defaultCurrency, category: '', note: '', source: 'manual' };
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
  const [editIndex, setEditIndex] = useState<number | null>(null);
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

  const startEdit = (i: number, e: CashEntry) => { setEditIndex(i); setEditRow({ ...e }); };
  const saveEdit = () => {
    if (editIndex === null || !editRow) return;
    updateEntry(editIndex, editRow);
    toast('Entry updated.');
    setEditIndex(null);
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ entry, index, balance }) =>
            editIndex === index && editRow ? (
              <tr key={index}>
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
                  <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                  <button className="btn secondary small" onClick={() => setEditIndex(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={index}>
                <td>{entry.date}</td>
                <td className={entry.type === 'IN' ? 'pill-buy' : 'pill-sell'}>{entry.type === 'IN' ? 'Cash in' : 'Cash out'}</td>
                <td>{fmtMoney(entry.amount, entry.currencyCode)}</td>
                <td>{entry.category || '—'}</td>
                <td>{entry.note}</td>
                <td>{fmtMoney(balance, entry.currencyCode)}</td>
                <td>
                  <button className="btn secondary small" onClick={() => startEdit(index, entry)}>Edit</button>{' '}
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      if (await confirmDialog('This cannot be undone.', 'Delete this entry?')) deleteEntry(index);
                    }}
                  >
                    <TrashIcon size={12} />Delete
                  </button>
                </td>
              </tr>
            ),
          )}
          {!sorted.length && <tr><td colSpan={7} className="footer-note">No cash entries yet.</td></tr>}
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
