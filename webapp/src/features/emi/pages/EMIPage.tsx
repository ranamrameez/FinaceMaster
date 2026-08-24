import type { User } from 'firebase/auth';
import { useState } from 'react';
import { Card, MoneyValue } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { emiSummary, totalsByCurrency } from '../../../lib/calc/emiModule';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import type { EMILoan } from '../../../types/emiWorkbook';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLoan(defaultCurrency: string): EMILoan {
  return {
    id: '', name: '', lender: '', currencyCode: defaultCurrency, principal: 0,
    tenureMonths: 12, startDate: today(), repaymentMode: 'interest', annualRatePct: 0,
  };
}

function AddLoanForm() {
  const addEntry = useEMIWorkbookStore((s) => s.addEntry);
  const defaultCurrency = useEMIWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const [lastCurrency, setLastCurrency] = useLastCurrency('emi', defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [l, setL] = useState<EMILoan>(() => emptyLoan(lastCurrency));

  const submit = async () => {
    if (!l.name.trim()) return toast('Enter a loan name.');
    if (!l.principal || l.principal <= 0) return toast('Enter a principal amount.');
    if (!l.tenureMonths || l.tenureMonths <= 0) return toast('Enter a tenure in months.');
    if (l.repaymentMode === 'fixedTotal' && (!l.totalToReturn || l.totalToReturn <= 0)) return toast('Enter the total amount to return.');
    if (!(await ensureSignedIn('Sign in to save loans.'))) return;
    addEntry({ ...l, id: crypto.randomUUID(), name: l.name.trim(), lender: l.lender.trim() });
    toast(`Loan "${l.name.trim()}" saved.`);
    setL(emptyLoan(l.currencyCode));
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Loan name" width={160}>
          <TextInput value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder="e.g. Home Mortgage" />
        </Field>
        <Field label="Lender" width={140}>
          <TextInput value={l.lender} onChange={(e) => setL({ ...l, lender: e.target.value })} placeholder="e.g. Chase Bank" />
        </Field>
        <Field label="Currency" width={100}>
          <Select value={l.currencyCode} onChange={(e) => { setL({ ...l, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Principal" width={120}>
          <TextInput type="number" step="0.01" value={l.principal || ''} onChange={(e) => setL({ ...l, principal: Number(e.target.value) })} />
        </Field>
        <Field label="Repayment type" width={220}>
          <Select value={l.repaymentMode} onChange={(e) => setL({ ...l, repaymentMode: e.target.value as EMILoan['repaymentMode'] })}>
            <option value="interest">Interest rate (reducing balance)</option>
            <option value="fixedTotal">Fixed total to return (no-interest / Sharia)</option>
          </Select>
        </Field>
        {l.repaymentMode === 'interest' ? (
          <Field label="Annual interest rate (%)" width={140}>
            <TextInput type="number" step="0.01" value={l.annualRatePct ?? ''} onChange={(e) => setL({ ...l, annualRatePct: Number(e.target.value) })} />
          </Field>
        ) : (
          <Field label="Total amount to return" width={160}>
            <TextInput type="number" step="0.01" value={l.totalToReturn ?? ''} onChange={(e) => setL({ ...l, totalToReturn: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Tenure (months)" width={110}>
          <TextInput type="number" value={l.tenureMonths || ''} onChange={(e) => setL({ ...l, tenureMonths: Number(e.target.value) })} />
        </Field>
        <Field label="Start date">
          <TextInput type="date" value={l.startDate} onChange={(e) => setL({ ...l, startDate: e.target.value })} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add loan
      </button>
    </Card>
  );
}

function LoanDetail({ loan, onBack, startInEditMode }: { loan: EMILoan; onBack: () => void; startInEditMode?: boolean }) {
  const deleteEntry = useEMIWorkbookStore((s) => s.deleteEntry);
  const updateEntry = useEMIWorkbookStore((s) => s.updateEntry);
  const [editing, setEditing] = useState(!!startInEditMode);
  const [editRow, setEditRow] = useState<EMILoan>(loan);
  const sum = emiSummary(loan);

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All loans</button>
      <Card style={{ marginBottom: 16 }}>
        {editing ? (
          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <TextInput value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} />
              <TextInput value={editRow.lender} onChange={(e) => setEditRow({ ...editRow, lender: e.target.value })} />
              <Select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
              <TextInput type="number" step="0.01" value={editRow.principal} onChange={(e) => setEditRow({ ...editRow, principal: Number(e.target.value) })} />
              <Select value={editRow.repaymentMode} onChange={(e) => setEditRow({ ...editRow, repaymentMode: e.target.value as EMILoan['repaymentMode'] })}>
                <option value="interest">Interest rate</option>
                <option value="fixedTotal">Fixed total</option>
              </Select>
              {editRow.repaymentMode === 'interest' ? (
                <TextInput type="number" step="0.01" value={editRow.annualRatePct ?? ''} onChange={(e) => setEditRow({ ...editRow, annualRatePct: Number(e.target.value) })} placeholder="Annual rate %" />
              ) : (
                <TextInput type="number" step="0.01" value={editRow.totalToReturn ?? ''} onChange={(e) => setEditRow({ ...editRow, totalToReturn: Number(e.target.value) })} placeholder="Total to return" />
              )}
              <TextInput type="number" value={editRow.tenureMonths} onChange={(e) => setEditRow({ ...editRow, tenureMonths: Number(e.target.value) })} placeholder="Tenure (months)" />
              <TextInput type="date" value={editRow.startDate} onChange={(e) => setEditRow({ ...editRow, startDate: e.target.value })} />
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button
                className="btn secondary small"
                onClick={() => {
                  updateEntry(loan.id, editRow);
                  toast('Loan updated.');
                  setEditing(false);
                }}
              >
                <SaveIcon size={12} />Save
              </button>
              <button className="btn secondary small" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{loan.name}</div>
              <div className="footer-note">
                {loan.lender} · {loan.currencyCode} · {loan.repaymentMode === 'fixedTotal' ? 'Fixed total (no interest)' : `${loan.annualRatePct}% p.a.`} · {loan.tenureMonths} months
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn secondary small" onClick={() => { setEditRow(loan); setEditing(true); }}>Edit</button>
              <button
                className="btn secondary small"
                onClick={async () => {
                  if (await confirmDialog('This cannot be undone.', `Delete loan "${loan.name}"?`)) {
                    deleteEntry(loan.id);
                    onBack();
                  }
                }}
              >
                <TrashIcon size={12} />Delete
              </button>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card"><div className="label">Monthly installment</div><MoneyValue n={sum.emi} currency={loan.currencyCode} /></div>
          <div className="stat-card card"><div className="label">Outstanding</div><MoneyValue n={sum.outstanding} currency={loan.currencyCode} className="value pill-sell" /></div>
          <div className="stat-card card"><div className="label">Paid so far</div><MoneyValue n={sum.paidSoFar} currency={loan.currencyCode} /></div>
          <div className="stat-card card">
            <div className="label">{loan.repaymentMode === 'fixedTotal' ? 'Markup so far' : 'Interest so far'}</div>
            <MoneyValue n={sum.interestSoFar} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card"><div className="label">Months remaining</div><div className="value">{sum.monthsRemaining}</div></div>
          <div className="stat-card card">
            <div className="label">{loan.repaymentMode === 'fixedTotal' ? 'Total markup (life)' : 'Total interest (life)'}</div>
            <MoneyValue n={sum.totalInterest} currency={loan.currencyCode} />
          </div>
        </div>
      </Card>

      <h3>Schedule (next 12 installments from today)</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Installment</th>
              <th>{loan.repaymentMode === 'fixedTotal' ? 'Markup' : 'Interest'}</th>
              <th>Principal</th><th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {sum.rows.slice(sum.elapsed, sum.elapsed + 12).map((r) => (
              <tr key={r.month}>
                <td>#{r.month}</td>
                <td>{fmtMoney(r.emi, loan.currencyCode)}</td>
                <td>{fmtMoney(r.interest, loan.currencyCode)}</td>
                <td>{fmtMoney(r.principalComp, loan.currencyCode)}</td>
                <td>{fmtMoney(r.balance, loan.currencyCode)}</td>
              </tr>
            ))}
            {sum.elapsed >= loan.tenureMonths && <tr><td colSpan={5} className="footer-note">Loan fully repaid.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Overall stats across every loan, shown on the landing view before any
 * loan is opened — user feedback: every module needs an at-a-glance
 * accumulative summary, not just per-loan detail. */
function OverallSummary() {
  const loans = useEMIWorkbookStore((s) => s.workbook.entries);
  const totals = totalsByCurrency(loans);
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="card" style={{ padding: 12 }}>
          <div className="footer-note" style={{ marginBottom: 6 }}>{code}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 8 }}>
            <div className="stat-card card"><div className="label">Monthly total</div><MoneyValue n={totals[code].monthlyInstallment} currency={code} /></div>
            <div className="stat-card card"><div className="label">Outstanding</div><MoneyValue n={totals[code].outstanding} currency={code} className="value pill-sell" /></div>
            <div className="stat-card card"><div className="label">Paid so far</div><MoneyValue n={totals[code].paidSoFar} currency={code} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoanList({ onSelect, onEdit }: { onSelect: (loan: EMILoan) => void; onEdit: (loan: EMILoan) => void }) {
  const loans = useEMIWorkbookStore((s) => s.workbook.entries);

  type Row = { loan: EMILoan; sum: ReturnType<typeof emiSummary> };
  const rows: Row[] = loans.map((loan) => ({ loan, sum: emiSummary(loan) }));
  type Col = 'name' | 'lender' | 'monthly' | 'outstanding' | 'monthsLeft';
  const sortValue = (r: Row, col: Col): number | string => {
    switch (col) {
      case 'lender': return r.loan.lender;
      case 'monthly': return r.sum.emi;
      case 'outstanding': return r.sum.outstanding;
      case 'monthsLeft': return r.sum.monthsRemaining;
      default: return r.loan.name;
    }
  };
  const { sorted, Th } = useSortableRows(rows, sortValue, 'name', 'asc');

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="name">Name</Th><Th col="lender">Lender</Th><Th col="monthly">Monthly</Th>
            <Th col="outstanding">Outstanding</Th><Th col="monthsLeft">Months left</Th><th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ loan: l, sum }) => (
            <tr key={l.id} onClick={() => onSelect(l)} style={{ cursor: 'pointer' }}>
              <td>{l.name}</td>
              <td>{l.lender}{l.repaymentMode === 'fixedTotal' ? ' · no-interest' : ''}</td>
              <td>{fmtMoney(sum.emi, l.currencyCode)}</td>
              <td className="pill-sell">{fmtMoney(sum.outstanding, l.currencyCode)}</td>
              <td>{sum.monthsRemaining}</td>
              <td>
                <button className="btn secondary small" onClick={(e) => { e.stopPropagation(); onEdit(l); }}>Edit</button>{' '}
                <button className="btn secondary small" onClick={(e) => { e.stopPropagation(); onSelect(l); }}>Open</button>
              </td>
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={6} className="footer-note">No loans yet — add one above.</td></tr>}
        </tbody>
      </table>
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
  const loans = useEMIWorkbookStore((s) => s.workbook.entries);
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
    <Card style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Account</h3>
      <p className="footer-note">{syncStatus}</p>
      {cloudEmpty && (
        <div className="card" style={{ marginTop: 8, borderLeft: '3px solid var(--warn, orange)' }}>
          <p style={{ marginTop: 0 }}>No data found in the cloud for this account's EMI/Loans workbook. This won't upload automatically.</p>
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

export function EMIPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<EMILoan | null>(null);
  const [editOnOpen, setEditOnOpen] = useState(false);
  const loans = useEMIWorkbookStore((s) => s.workbook.entries);
  const liveSelected = selected ? loans.find((l) => l.id === selected.id) ?? null : null;

  const openLoan = (loan: EMILoan) => { setEditOnOpen(false); setSelected(loan); };
  const editLoan = (loan: EMILoan) => { setEditOnOpen(true); setSelected(loan); };

  return (
    <div>
      <h1 className="pagetitle">EMI / Loans</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        A loan you're repaying on a fixed schedule — a mortgage, car financing, or similar — with an
        auto-calculated amortization schedule. Assumes on-schedule payment; doesn't track missed/late payments.
      </p>
      {liveSelected ? (
        <LoanDetail loan={liveSelected} onBack={() => setSelected(null)} startInEditMode={editOnOpen} />
      ) : (
        <div>
          <OverallSummary />
          <AddLoanForm />
          <LoanList onSelect={openLoan} onEdit={editLoan} />
          <AccountSection syncStatus={syncStatus} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
        </div>
      )}
    </div>
  );
}
