import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Card } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { netIncomeByCurrency, propertyByCategory, propertyMonthlyRollup, propertyNetIncome } from '../../../lib/calc/rentalsModule';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { createEmptyRentalsWorkbook } from '../../../store/defaultRentalsWorkbook';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import type { Property, RentalEntry, RentalsWorkbook } from '../../../types/rentalsWorkbook';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

function emptyProperty(defaultCurrency: string): Property {
  return { id: '', name: '', currencyCode: defaultCurrency, purchasePrice: undefined };
}

/* ============================== Properties ============================== */

function NetIncomeSummary() {
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const totals = netIncomeByCurrency(properties, entries);
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="stat-card card">
          <div className="label">Net income ({code})</div>
          <div className={`value ${totals[code] >= 0 ? 'pill-buy' : 'pill-sell'}`}>{fmtMoney(totals[code], code)}</div>
        </div>
      ))}
    </div>
  );
}

function AddPropertyForm() {
  const addProperty = useRentalsWorkbookStore((s) => s.addProperty);
  const ensureSignedIn = useEnsureSignedIn();
  const [p, setP] = useState(() => emptyProperty('USD'));

  const submit = async () => {
    if (!p.name.trim()) return toast('Enter a property name.');
    if (!(await ensureSignedIn('Sign in to save rental properties.'))) return;
    addProperty({ ...p, id: uid(), name: p.name.trim() });
    toast(`Property "${p.name.trim()}" added.`);
    setP(emptyProperty(p.currencyCode));
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Property name" width={180}>
          <TextInput value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Apartment 4B" />
        </Field>
        <Field label="Currency" width={100}>
          <Select value={p.currencyCode} onChange={(e) => setP({ ...p, currencyCode: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Purchase price (optional)" width={160}>
          <TextInput type="number" step="0.01" value={p.purchasePrice ?? ''} onChange={(e) => setP({ ...p, purchasePrice: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add property
      </button>
    </Card>
  );
}

function PropertiesList() {
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const updateProperty = useRentalsWorkbookStore((s) => s.updateProperty);
  const deleteProperty = useRentalsWorkbookStore((s) => s.deleteProperty);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Property | null>(null);

  const startEdit = (p: Property) => { setEditId(p.id); setEditRow({ ...p }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updateProperty(editId, editRow);
    toast('Property updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>Name</th><th>Currency</th><th>Purchase price</th><th>Net income (all time)</th><th></th></tr></thead>
        <tbody>
          {properties.map((p) =>
            editId === p.id && editRow ? (
              <tr key={p.id}>
                <td><input value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} /></td>
                <td>
                  <select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </td>
                <td><input type="number" step="0.01" value={editRow.purchasePrice ?? ''} onChange={(e) => setEditRow({ ...editRow, purchasePrice: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 110 }} /></td>
                <td></td>
                <td>
                  <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                  <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.currencyCode}</td>
                <td>{p.purchasePrice ? fmtMoney(p.purchasePrice, p.currencyCode) : '—'}</td>
                <td className={propertyNetIncome(p, entries) >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(propertyNetIncome(p, entries), p.currencyCode)}</td>
                <td>
                  <button className="btn secondary small" onClick={() => startEdit(p)}>Edit</button>{' '}
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      if (await confirmDialog('This deletes the property and all its income/expense entries.', `Delete property "${p.name}"?`)) deleteProperty(p.id);
                    }}
                  >
                    <TrashIcon size={12} />Delete
                  </button>
                </td>
              </tr>
            ),
          )}
          {!properties.length && <tr><td colSpan={5} className="footer-note">No properties yet — add one above.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PropertiesTab() {
  return (
    <div>
      <NetIncomeSummary />
      <AddPropertyForm />
      <PropertiesList />
    </div>
  );
}

/* ============================== Entries ============================== */

function usePropertyPicker() {
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const [propertyId, setPropertyId] = useState<string>(properties[0]?.id ?? '');
  const property = properties.find((p) => p.id === propertyId) ?? properties[0] ?? null;
  return { properties, property, propertyId: property?.id ?? '', setPropertyId };
}

function emptyEntry(propertyId: string): RentalEntry {
  return { id: '', propertyId, date: today(), type: 'RENT_INCOME', amount: 0, category: '', note: '' };
}

function AddEntryForm({ propertyId, knownCategories }: { propertyId: string; knownCategories: string[] }) {
  const addEntry = useRentalsWorkbookStore((s) => s.addEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [e, setE] = useState<RentalEntry>(() => emptyEntry(propertyId));

  const submit = async () => {
    if (!e.amount || e.amount <= 0) return toast('Enter an amount.');
    if (!(await ensureSignedIn('Sign in to save rental entries.'))) return;
    addEntry({ ...e, id: uid(), propertyId, category: e.category?.trim() || undefined, note: e.note?.trim() || undefined });
    toast(`${e.type === 'RENT_INCOME' ? 'Rent income' : 'Expense'} logged.`);
    setE(emptyEntry(propertyId));
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Date">
          <TextInput type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={e.type} onChange={(ev) => setE({ ...e, type: ev.target.value as RentalEntry['type'] })} width={130}>
            <option value="RENT_INCOME">Rent income</option>
            <option value="EXPENSE">Expense</option>
          </Select>
        </Field>
        <Field label="Amount" width={110}>
          <TextInput type="number" step="0.01" value={e.amount || ''} onChange={(ev) => setE({ ...e, amount: Number(ev.target.value) })} />
        </Field>
        {e.type === 'EXPENSE' && (
          <Field label="Category (optional)" width={150}>
            <TextInput list="rentals-category-datalist" value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })} placeholder="e.g. Maintenance" />
          </Field>
        )}
        <Field label="Note (optional)" width={180}>
          <TextInput value={e.note} onChange={(ev) => setE({ ...e, note: ev.target.value })} />
        </Field>
      </div>
      <datalist id="rentals-category-datalist">
        {knownCategories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add entry
      </button>
    </Card>
  );
}

function EntriesList({ property }: { property: Property }) {
  const allEntries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const updateEntry = useRentalsWorkbookStore((s) => s.updateEntry);
  const deleteEntry = useRentalsWorkbookStore((s) => s.deleteEntry);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<RentalEntry | null>(null);

  const entries = useMemo(() => allEntries.filter((e) => e.propertyId === property.id), [allEntries, property.id]);
  type Col = 'date' | 'type' | 'amount' | 'category';
  const sortValue = (e: RentalEntry, col: Col): number | string => {
    switch (col) {
      case 'type': return e.type;
      case 'amount': return e.amount;
      case 'category': return e.category ?? '';
      default: return e.date;
    }
  };
  const { sorted, Th } = useSortableRows(entries, sortValue, 'date', 'desc');

  const startEdit = (e: RentalEntry) => { setEditId(e.id); setEditRow({ ...e }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
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
            <Th col="date">Date</Th><Th col="type">Type</Th><Th col="amount">Amount</Th>
            <Th col="category">Category</Th><th>Note</th><th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) =>
            editId === e.id && editRow ? (
              <tr key={e.id}>
                <td><input type="date" value={editRow.date} onChange={(ev) => setEditRow({ ...editRow, date: ev.target.value })} style={{ width: 130 }} /></td>
                <td>
                  <select value={editRow.type} onChange={(ev) => setEditRow({ ...editRow, type: ev.target.value as RentalEntry['type'] })}>
                    <option value="RENT_INCOME">Rent income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </td>
                <td><input type="number" step="0.01" value={editRow.amount} onChange={(ev) => setEditRow({ ...editRow, amount: Number(ev.target.value) })} style={{ width: 90 }} /></td>
                <td><input value={editRow.category ?? ''} onChange={(ev) => setEditRow({ ...editRow, category: ev.target.value })} style={{ width: 100 }} /></td>
                <td><input value={editRow.note ?? ''} onChange={(ev) => setEditRow({ ...editRow, note: ev.target.value })} /></td>
                <td>
                  <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                  <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td className={e.type === 'RENT_INCOME' ? 'pill-buy' : 'pill-sell'}>{e.type === 'RENT_INCOME' ? 'Rent income' : 'Expense'}</td>
                <td className={e.type === 'RENT_INCOME' ? 'pill-buy' : 'pill-sell'}>{fmtMoney(e.type === 'RENT_INCOME' ? e.amount : -e.amount, property.currencyCode)}</td>
                <td>{e.type === 'RENT_INCOME' ? '—' : e.category || '—'}</td>
                <td>{e.note}</td>
                <td>
                  <button className="btn secondary small" onClick={() => startEdit(e)}>Edit</button>{' '}
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      if (await confirmDialog('This cannot be undone.', 'Delete this entry?')) deleteEntry(e.id);
                    }}
                  >
                    <TrashIcon size={12} />Delete
                  </button>
                </td>
              </tr>
            ),
          )}
          {!sorted.length && <tr><td colSpan={6} className="footer-note">No entries for this property yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CategoryAndRollup({ property }: { property: Property }) {
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const byCategory = propertyByCategory(property, entries);
  const rollup = useMemo(() => propertyMonthlyRollup(property, entries), [property, entries]);
  const cats = Object.keys(byCategory);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 16, marginBottom: 16 }}>
      {cats.length > 0 && (
        <Card>
          <h3 style={{ marginTop: 0 }}>By category</h3>
          <div className="table-scroll">
            <table>
              <tbody>
                {cats.map((cat) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className={byCategory[cat] >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(byCategory[cat], property.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {rollup.length > 0 && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Monthly rollup</h3>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Month</th><th>Income</th><th>Expense</th><th>Net</th></tr></thead>
              <tbody>
                {rollup.map((r) => (
                  <tr key={r.month}>
                    <td>{r.month}</td>
                    <td>{fmtMoney(r.income, property.currencyCode)}</td>
                    <td>{fmtMoney(r.expense, property.currencyCode)}</td>
                    <td className={r.net >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(r.net, property.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function EntriesTab() {
  const { properties, property, propertyId, setPropertyId } = usePropertyPicker();
  const allEntries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const knownCategories = useMemo(
    () => [...new Set(allEntries.filter((e) => e.propertyId === propertyId && e.type === 'EXPENSE').map((e) => e.category).filter((c): c is string => !!c))].sort(),
    [allEntries, propertyId],
  );

  if (!properties.length) {
    return <p className="footer-note">Add a property first (Properties tab) before logging income/expenses.</p>;
  }

  return (
    <div>
      <Field label="Property" width={220}>
        <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currencyCode})</option>)}
        </Select>
      </Field>
      {property && (
        <div style={{ marginTop: 12 }}>
          <AddEntryForm propertyId={property.id} knownCategories={knownCategories} />
          <CategoryAndRollup property={property} />
          <EntriesList property={property} />
        </div>
      )}
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
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
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
          <p style={{ marginTop: 0 }}>No data found in the cloud for this account's Rentals workbook. This won't upload automatically.</p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
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

function DataManagement() {
  const workbook = useRentalsWorkbookStore((s) => s.workbook);
  const setWorkbook = useRentalsWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentals-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<RentalsWorkbook>;
        setWorkbook({ ...createEmptyRentalsWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all rentals data?');
    if (!ok) return;
    setWorkbook(createEmptyRentalsWorkbook());
    toast('All rentals data cleared.');
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

export function RentalsPage({
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
      <h1 className="pagetitle">Rentals</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Rental property income and expenses — recurring rent received and costs (maintenance, property tax,
        management fees) against one or more properties, not discrete buy/sell trades.
      </p>
      <Tabs
        tabs={[
          { key: 'properties', label: 'Properties', content: <PropertiesTab /> },
          { key: 'entries', label: 'Income & expenses', content: <EntriesTab /> },
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
