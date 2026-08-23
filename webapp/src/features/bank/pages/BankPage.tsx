import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Card } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { accountBalance, accountByCategory, accountRunningLedger, totalBalanceByCurrency } from '../../../lib/calc/bankModule';
import { parseCSV } from '../../../lib/csv';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { createEmptyBankWorkbook } from '../../../store/defaultBankWorkbook';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import type { BankAccount, BankTransaction, BankWorkbook } from '../../../types/bankWorkbook';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

function emptyAccount(defaultCurrency: string): Omit<BankAccount, 'id'> {
  return { name: '', currencyCode: defaultCurrency, openingBalance: 0 };
}

/* ============================== Accounts ============================== */

function TotalBalances() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const totals = totalBalanceByCurrency(accounts, transactions);
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="stat-card card">
          <div className="label">Total balance ({code})</div>
          <div className={`value ${totals[code] >= 0 ? 'pill-buy' : 'pill-sell'}`}>{fmtMoney(totals[code], code)}</div>
        </div>
      ))}
    </div>
  );
}

function AddAccountForm() {
  const addAccount = useBankWorkbookStore((s) => s.addAccount);
  const ensureSignedIn = useEnsureSignedIn();
  const [a, setA] = useState(() => emptyAccount('USD'));

  const submit = async () => {
    if (!a.name.trim()) return toast('Enter an account name.');
    if (!(await ensureSignedIn('Sign in to save bank accounts.'))) return;
    addAccount({ ...a, id: uid(), name: a.name.trim() });
    toast(`Account "${a.name.trim()}" added.`);
    setA(emptyAccount(a.currencyCode));
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Account name" width={180}>
          <TextInput value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. Meezan Checking" />
        </Field>
        <Field label="Currency" width={100}>
          <Select value={a.currencyCode} onChange={(e) => setA({ ...a, currencyCode: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Opening balance" width={140}>
          <TextInput type="number" step="0.01" value={a.openingBalance || ''} onChange={(e) => setA({ ...a, openingBalance: Number(e.target.value) })} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add account
      </button>
    </Card>
  );
}

function AccountsList() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateAccount = useBankWorkbookStore((s) => s.updateAccount);
  const deleteAccount = useBankWorkbookStore((s) => s.deleteAccount);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<BankAccount | null>(null);

  const startEdit = (a: BankAccount) => { setEditId(a.id); setEditRow({ ...a }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updateAccount(editId, editRow);
    toast('Account updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>Name</th><th>Currency</th><th>Opening balance</th><th>Current balance</th><th></th></tr></thead>
        <tbody>
          {accounts.map((a) =>
            editId === a.id && editRow ? (
              <tr key={a.id}>
                <td><input value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} /></td>
                <td>
                  <select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </td>
                <td><input type="number" step="0.01" value={editRow.openingBalance} onChange={(e) => setEditRow({ ...editRow, openingBalance: Number(e.target.value) })} style={{ width: 110 }} /></td>
                <td></td>
                <td>
                  <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                  <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.currencyCode}</td>
                <td>{fmtMoney(a.openingBalance, a.currencyCode)}</td>
                <td>{fmtMoney(accountBalance(a, transactions), a.currencyCode)}</td>
                <td>
                  <button className="btn secondary small" onClick={() => startEdit(a)}>Edit</button>{' '}
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      if (await confirmDialog('This deletes the account and all its transactions.', `Delete account "${a.name}"?`)) deleteAccount(a.id);
                    }}
                  >
                    <TrashIcon size={12} />Delete
                  </button>
                </td>
              </tr>
            ),
          )}
          {!accounts.length && <tr><td colSpan={5} className="footer-note">No accounts yet — add one above.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AccountsTab() {
  return (
    <div>
      <TotalBalances />
      <AddAccountForm />
      <AccountsList />
    </div>
  );
}

/* ============================== Transactions ============================== */

function useAccountPicker() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;
  return { accounts, account, accountId: account?.id ?? '', setAccountId };
}

function emptyTxRow(accountId: string): BankTransaction {
  return { id: '', accountId, date: today(), amount: 0, description: '', category: '', source: 'manual' };
}

function AddTransactionsForm({ accountId, knownCategories }: { accountId: string; knownCategories: string[] }) {
  const addTransactions = useBankWorkbookStore((s) => s.addTransactions);
  const ensureSignedIn = useEnsureSignedIn();
  const [rows, setRows] = useState<BankTransaction[]>([emptyTxRow(accountId)]);

  const update = (i: number, patch: Partial<BankTransaction>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    const valid = rows.filter((r) => r.amount !== 0 && r.description.trim());
    if (!valid.length) return toast('Fill in at least one complete row (description + non-zero amount).');
    if (!(await ensureSignedIn('Sign in to save bank transactions.'))) return;
    addTransactions(valid.map((r) => ({ ...r, id: uid(), accountId, category: r.category?.trim() || undefined })));
    toast(`Added ${valid.length} transaction${valid.length > 1 ? 's' : ''}.`);
    setRows([emptyTxRow(accountId)]);
  };

  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
          <input placeholder="Description" value={r.description} onChange={(e) => update(i, { description: e.target.value })} style={{ width: 160 }} />
          <input
            type="number"
            step="0.01"
            placeholder="Amount (+/-)"
            value={r.amount || ''}
            onChange={(e) => update(i, { amount: Number(e.target.value) })}
            style={{ width: 110 }}
            title="Negative = spend/debit, positive = deposit/credit"
          />
          <input
            list="bank-category-datalist"
            placeholder="Category (optional)"
            value={r.category}
            onChange={(e) => update(i, { category: e.target.value })}
            style={{ width: 130 }}
          />
          <button className="btn secondary small" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
            <TrashIcon size={12} />Remove
          </button>
        </div>
      ))}
      <datalist id="bank-category-datalist">
        {knownCategories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn secondary" onClick={() => setRows((rs) => [...rs, emptyTxRow(accountId)])}>
          <PlusIcon />Add row
        </button>
        <button className="btn" onClick={submit}>
          <SaveIcon />Save {rows.length > 1 ? `${rows.length} transactions` : 'transaction'}
        </button>
      </div>
      <p className="footer-note" style={{ marginTop: 8 }}>Negative amount = spend/debit, positive = deposit/credit.</p>
    </div>
  );
}

function TransactionsList({ account }: { account: BankAccount }) {
  const allTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateTransaction = useBankWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = useBankWorkbookStore((s) => s.deleteTransaction);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<BankTransaction | null>(null);

  const ledger = useMemo(() => accountRunningLedger(account, allTransactions), [account, allTransactions]);

  type Col = 'date' | 'description' | 'amount' | 'category';
  const sortValue = (r: (typeof ledger)[number], col: Col): number | string => {
    switch (col) {
      case 'description': return r.tx.description;
      case 'amount': return r.tx.amount;
      case 'category': return r.tx.category ?? '';
      default: return r.tx.date;
    }
  };
  const { sorted, Th } = useSortableRows(ledger, sortValue, 'date', 'desc');

  const startEdit = (tx: BankTransaction) => { setEditId(tx.id); setEditRow({ ...tx }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updateTransaction(editId, editRow);
    toast('Transaction updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="date">Date</Th>
            <Th col="description">Description</Th>
            <Th col="amount">Amount</Th>
            <Th col="category">Category</Th>
            <th>Source</th>
            <th>Balance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ tx, balance }) =>
            editId === tx.id && editRow ? (
              <tr key={tx.id}>
                <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                <td><input value={editRow.description} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 100 }} /></td>
                <td><input value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} style={{ width: 100 }} /></td>
                <td>{editRow.source}</td>
                <td></td>
                <td>
                  <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                  <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description}</td>
                <td className={tx.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(tx.amount, account.currencyCode)}</td>
                <td>{tx.category || '—'}</td>
                <td className="footer-note">{tx.source === 'statement-import' ? `Import${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual'}</td>
                <td>{fmtMoney(balance, account.currencyCode)}</td>
                <td>
                  <button className="btn secondary small" onClick={() => startEdit(tx)}>Edit</button>{' '}
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      if (await confirmDialog('This cannot be undone.', 'Delete this transaction?')) deleteTransaction(tx.id);
                    }}
                  >
                    <TrashIcon size={12} />Delete
                  </button>
                </td>
              </tr>
            ),
          )}
          {!sorted.length && <tr><td colSpan={7} className="footer-note">No transactions for this account yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CategoryBreakdown({ account }: { account: BankAccount }) {
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const byCategory = accountByCategory(account, transactions);
  const cats = Object.keys(byCategory);
  if (!cats.length) return null;

  return (
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>By category</h3>
      <div className="table-scroll">
        <table>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat}>
                <td>{cat}</td>
                <td className={byCategory[cat] >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(byCategory[cat], account.currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TransactionsTab() {
  const { accounts, account, accountId, setAccountId } = useAccountPicker();
  const allTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const knownCategories = useMemo(
    () => [...new Set(allTransactions.filter((t) => t.accountId === accountId).map((t) => t.category).filter((c): c is string => !!c))].sort(),
    [allTransactions, accountId],
  );

  if (!accounts.length) {
    return <p className="footer-note">Add a bank account first (Accounts tab) before logging transactions.</p>;
  }

  return (
    <div>
      <Field label="Account" width={220}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
        </Select>
      </Field>
      {account && (
        <div style={{ marginTop: 12 }}>
          <AddTransactionsForm accountId={account.id} knownCategories={knownCategories} />
          <div style={{ marginTop: 16 }}>
            <CategoryBreakdown account={account} />
            <TransactionsList account={account} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Statement import ============================== */

function ImportTab() {
  const { accounts, account, accountId, setAccountId } = useAccountPicker();
  const addTransactions = useBankWorkbookStore((s) => s.addTransactions);
  const ensureSignedIn = useEnsureSignedIn();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  const [flipSign, setFlipSign] = useState(false);

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
      setDescCol(head[1] ?? '');
      setAmountCol(head[2] ?? '');
    };
    reader.readAsText(file);
  };

  const colIndex = (col: string) => headers.indexOf(col);
  const mappedPreview = rows.slice(0, 5).map((r) => ({
    date: r[colIndex(dateCol)] ?? '',
    description: r[colIndex(descCol)] ?? '',
    amount: Number(r[colIndex(amountCol)] ?? 0) * (flipSign ? -1 : 1),
  }));

  const doImport = async () => {
    if (!account) return toast('Add and select a bank account first.');
    if (!dateCol || !descCol || !amountCol) return toast('Map all three columns (date, description, amount).');
    if (!(await ensureSignedIn('Sign in to import transactions.'))) return;
    const di = colIndex(dateCol);
    const desci = colIndex(descCol);
    const ai = colIndex(amountCol);
    const imported: BankTransaction[] = rows
      .map((r) => ({
        id: uid(),
        accountId: account.id,
        date: (r[di] ?? '').trim(),
        description: (r[desci] ?? '').trim(),
        amount: Number(r[ai]) * (flipSign ? -1 : 1),
        source: 'statement-import' as const,
        statementRef: fileName,
      }))
      .filter((t) => t.date && t.description && !Number.isNaN(t.amount) && t.amount !== 0);
    if (!imported.length) return toast('No valid rows to import after mapping — check your column choices.');
    addTransactions(imported);
    toast(`Imported ${imported.length} transaction${imported.length > 1 ? 's' : ''} from ${fileName}.`);
    setHeaders([]);
    setRows([]);
    setFileName('');
  };

  if (!accounts.length) {
    return <p className="footer-note">Add a bank account first (Accounts tab) before importing a statement.</p>;
  }

  return (
    <div>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Import a CSV export from your bank. This is a simple "map these columns" tool, not a per-bank-format
        parser — pick which column is which below, since every bank's export looks a little different.
      </p>
      <Field label="Import into account" width={220}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
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
            <Field label="Description column" width={160}>
              <Select value={descCol} onChange={(e) => setDescCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <Field label="Amount column" width={160}>
              <Select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 20 }} title="Check this if your bank exports spending as positive numbers instead of negative.">
              <input type="checkbox" checked={flipSign} onChange={(e) => setFlipSign(e.target.checked)} />
              Flip sign
            </label>
          </div>

          <h4>Preview (first 5 rows)</h4>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {mappedPreview.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.description}</td>
                    <td className={r.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{account ? fmtMoney(r.amount, account.currencyCode) : r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={doImport}>
            <PlusIcon />Import {rows.length} transaction{rows.length > 1 ? 's' : ''}
          </button>
        </Card>
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
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
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
            No data found in the cloud for this account's Banking workbook. This won't upload automatically.
          </p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
                `Upload ${transactions.length} local transaction(s) to the cloud?`,
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
            Upload local data to cloud ({transactions.length} transactions)
          </button>
        </div>
      )}
    </Card>
  );
}

function DataManagement() {
  const workbook = useBankWorkbookStore((s) => s.workbook);
  const setWorkbook = useBankWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<BankWorkbook>;
        setWorkbook({ ...createEmptyBankWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all banking data?');
    if (!ok) return;
    setWorkbook(createEmptyBankWorkbook());
    toast('All banking data cleared.');
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

export function BankPage({
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
      <h1 className="pagetitle">Banking</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Bank account balances and transaction history, entered manually or imported from a CSV statement — no
        live bank connection (see Disclaimer &amp; Privacy for why).
      </p>
      <Tabs
        tabs={[
          { key: 'accounts', label: 'Accounts', content: <AccountsTab /> },
          { key: 'transactions', label: 'Transactions', content: <TransactionsTab /> },
          { key: 'import', label: 'Import statement', content: <ImportTab /> },
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
