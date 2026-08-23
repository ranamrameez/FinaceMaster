import type { User } from 'firebase/auth';
import { useMemo, useState } from 'react';
import { Card } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { confirmAndDeleteLinkable } from '../../../lib/linkCascade';
import { loanOutstanding, netPositionByCurrency } from '../../../lib/calc/personalLoansModule';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { usePersonalLoansWorkbookStore } from '../../../store/personalLoansWorkbookStore';
import type { PersonalLoan, PersonalLoanRepayment } from '../../../types/personalLoansWorkbook';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLoan(defaultCurrency: string): PersonalLoan {
  return { id: '', person: '', direction: 'owed_to_me', currencyCode: defaultCurrency, principal: 0, date: today(), note: '' };
}

function NetPositionSummary() {
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const net = netPositionByCurrency(loans, repayments);
  const codes = Object.keys(net);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="stat-card card">
          <div className="label">Net position ({code})</div>
          <div className={`value ${net[code] >= 0 ? 'pill-buy' : 'pill-sell'}`}>{fmtMoney(net[code], code)}</div>
          <div className="sub">{net[code] >= 0 ? 'Net owed to you' : 'Net you owe'}</div>
        </div>
      ))}
    </div>
  );
}

function AddLoanForm() {
  const addLoan = usePersonalLoansWorkbookStore((s) => s.addLoan);
  const defaultCurrency = usePersonalLoansWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [l, setL] = useState<PersonalLoan>(() => emptyLoan(defaultCurrency));

  const submit = async () => {
    if (!l.person.trim()) return toast('Enter a person/lender name.');
    if (!l.principal || l.principal <= 0) return toast('Enter a principal amount.');
    if (!(await ensureSignedIn('Sign in to save personal loans.'))) return;
    addLoan({ ...l, id: crypto.randomUUID(), person: l.person.trim(), note: l.note?.trim() || undefined });
    toast(`Loan with ${l.person.trim()} saved.`);
    setL(emptyLoan(defaultCurrency));
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Person / lender" width={160}>
          <TextInput value={l.person} onChange={(e) => setL({ ...l, person: e.target.value })} placeholder="e.g. Bilal" />
        </Field>
        <Field label="Direction" width={160}>
          <Select value={l.direction} onChange={(e) => setL({ ...l, direction: e.target.value as PersonalLoan['direction'] })}>
            <option value="owed_to_me">Money I lent out</option>
            <option value="i_owe">Money I owe</option>
          </Select>
        </Field>
        <Field label="Currency" width={100}>
          <Select value={l.currencyCode} onChange={(e) => setL({ ...l, currencyCode: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Principal" width={110}>
          <TextInput type="number" step="0.01" value={l.principal || ''} onChange={(e) => setL({ ...l, principal: Number(e.target.value) })} />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={l.date} onChange={(e) => setL({ ...l, date: e.target.value })} />
        </Field>
        <Field label="Note (optional)" width={180}>
          <TextInput value={l.note} onChange={(e) => setL({ ...l, note: e.target.value })} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add loan
      </button>
    </Card>
  );
}

function RepaymentsSection({ loan }: { loan: PersonalLoan }) {
  // Select the raw array (a stable reference from the store) and filter it
  // in a memo — filtering *inside* the zustand selector would return a new
  // array identity on every render, which zustand's useSyncExternalStore
  // reads as "state changed", risking an infinite re-render loop.
  const allRepayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const repayments = useMemo(() => allRepayments.filter((r) => r.loanId === loan.id), [allRepayments, loan.id]);
  const addRepayment = usePersonalLoansWorkbookStore((s) => s.addRepayment);
  const updateRepayment = usePersonalLoansWorkbookStore((s) => s.updateRepayment);
  const deleteRepayment = usePersonalLoansWorkbookStore((s) => s.deleteRepayment);
  const ensureSignedIn = useEnsureSignedIn();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PersonalLoanRepayment | null>(null);

  const submit = async () => {
    if (!amount || amount <= 0) return toast('Enter a repayment amount.');
    if (!(await ensureSignedIn('Sign in to save repayments.'))) return;
    addRepayment({ id: crypto.randomUUID(), loanId: loan.id, date, amount });
    toast('Repayment logged.');
    setAmount(0);
  };

  const startEdit = (r: PersonalLoanRepayment) => { setEditId(r.id); setEditRow({ ...r }); };
  const saveEdit = () => {
    if (editId === null || !editRow) return;
    updateRepayment(editId, editRow);
    toast('Repayment updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="number" step="0.01" placeholder="Amount" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 100 }} />
        <button className="btn secondary" onClick={submit}><PlusIcon />Add repayment</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Date</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {repayments.map((r) =>
              editId === r.id && editRow ? (
                <tr key={r.id}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td>
                    <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{fmtMoney(r.amount, loan.currencyCode)}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => startEdit(r)}>Edit</button>{' '}
                    <button
                      className="btn secondary small"
                      onClick={() => confirmAndDeleteLinkable('personalLoans', r.id, () => deleteRepayment(r.id))}
                    >
                      <TrashIcon size={12} />Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
            {!repayments.length && <tr><td colSpan={3} className="footer-note">No repayments logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoanDetail({ loan, onBack }: { loan: PersonalLoan; onBack: () => void }) {
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const deleteLoan = usePersonalLoansWorkbookStore((s) => s.deleteLoan);
  const updateLoan = usePersonalLoansWorkbookStore((s) => s.updateLoan);
  const [editing, setEditing] = useState(false);
  const [editRow, setEditRow] = useState<PersonalLoan>(loan);
  const outstanding = loanOutstanding(loan, repayments);

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All personal loans</button>
      <Card style={{ marginBottom: 16 }}>
        {editing ? (
          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <TextInput value={editRow.person} onChange={(e) => setEditRow({ ...editRow, person: e.target.value })} />
              <Select value={editRow.direction} onChange={(e) => setEditRow({ ...editRow, direction: e.target.value as PersonalLoan['direction'] })}>
                <option value="owed_to_me">Money I lent out</option>
                <option value="i_owe">Money I owe</option>
              </Select>
              <Select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
              <TextInput type="number" step="0.01" value={editRow.principal} onChange={(e) => setEditRow({ ...editRow, principal: Number(e.target.value) })} />
              <TextInput type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} />
              <TextInput value={editRow.note ?? ''} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} placeholder="Note" />
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn secondary small" onClick={() => { updateLoan(loan.id, editRow); toast('Loan updated.'); setEditing(false); }}>
                <SaveIcon size={12} />Save
              </button>
              <button className="btn secondary small" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{loan.person}</div>
              <div className="footer-note">
                {loan.direction === 'owed_to_me' ? 'Money lent out' : 'Money I owe'} · {loan.currencyCode} · since {loan.date}
              </div>
              {loan.note && <div className="footer-note">{loan.note}</div>}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn secondary small" onClick={() => { setEditRow(loan); setEditing(true); }}>Edit</button>
              <button
                className="btn secondary small"
                onClick={async () => {
                  if (await confirmDialog('This deletes the loan and all its logged repayments.', `Delete loan with ${loan.person}?`)) {
                    deleteLoan(loan.id);
                    onBack();
                  }
                }}
              >
                <TrashIcon size={12} />Delete
              </button>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card"><div className="label">Principal</div><div className="value">{fmtMoney(loan.principal, loan.currencyCode)}</div></div>
          <div className={`stat-card card`}>
            <div className="label">Outstanding</div>
            <div className={`value ${loan.direction === 'owed_to_me' ? 'pill-buy' : 'pill-sell'}`}>{fmtMoney(outstanding, loan.currencyCode)}</div>
          </div>
        </div>
      </Card>
      <h3>Repayments</h3>
      <RepaymentsSection loan={loan} />
    </div>
  );
}

function LoanList({ onSelect }: { onSelect: (loan: PersonalLoan) => void }) {
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const [filter, setFilter] = useState<'all' | 'owed_to_me' | 'i_owe'>('all');
  const filtered = filter === 'all' ? loans : loans.filter((l) => l.direction === filter);

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All directions</option>
          <option value="owed_to_me">Money I lent out</option>
          <option value="i_owe">Money I owe</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Person</th><th>Direction</th><th>Outstanding</th><th></th></tr></thead>
          <tbody>
            {filtered.map((l) => {
              const outstanding = loanOutstanding(l, repayments);
              return (
                <tr key={l.id} onClick={() => onSelect(l)} style={{ cursor: 'pointer' }}>
                  <td>{l.person}</td>
                  <td className={l.direction === 'owed_to_me' ? 'pill-buy' : 'pill-sell'}>{l.direction === 'owed_to_me' ? 'Lent out' : 'I owe'}</td>
                  <td>{fmtMoney(outstanding, l.currencyCode)}</td>
                  <td><button className="btn secondary small" onClick={(e) => { e.stopPropagation(); onSelect(l); }}>Open</button></td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={4} className="footer-note">No personal loans yet.</td></tr>}
          </tbody>
        </table>
      </div>
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
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
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
    <Card>
      <h3 style={{ marginTop: 0 }}>Account</h3>
      <p className="footer-note">{syncStatus}</p>
      {cloudEmpty && (
        <div className="card" style={{ marginTop: 8, borderLeft: '3px solid var(--warn, orange)' }}>
          <p style={{ marginTop: 0 }}>
            No data found in the cloud for this account's Personal Loans workbook. This won't upload automatically.
          </p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
                `Upload ${loans.length} local loan(s) to the cloud?`,
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
            Upload local data to cloud ({loans.length} loans)
          </button>
        </div>
      )}
    </Card>
  );
}

export function PersonalLoansPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<PersonalLoan | null>(null);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const liveSelected = selected ? loans.find((l) => l.id === selected.id) ?? null : null;

  return (
    <div>
      <h1 className="pagetitle">Personal Loans</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Informal loans with another person, tracked in either direction — money you lent out, or money you owe —
        with a combined net position. No repayment schedule automation; if this loan actually has a real interest
        schedule, it probably belongs in EMI/Loans instead.
      </p>
      {liveSelected ? (
        <LoanDetail loan={liveSelected} onBack={() => setSelected(null)} />
      ) : (
        <div>
          <NetPositionSummary />
          <AddLoanForm />
          <LoanList onSelect={setSelected} />
          <div style={{ marginTop: 16 }}>
            <AccountSection syncStatus={syncStatus} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
          </div>
        </div>
      )}
    </div>
  );
}
