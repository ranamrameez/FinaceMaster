import type { User } from 'firebase/auth';
import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { toCSV } from '../../../lib/csv';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { emiSchedule, emiSummary, expectedEndDate, installmentDueDate, totalsByCurrency, whatIfExtraPayment } from '../../../lib/calc/emiModule';
import { dlBarV } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar } from '../../../lib/cssVar';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import type { EMILoan } from '../../../types/emiWorkbook';
import type { PlannedBankTransaction } from '../../../types/plannedBank';

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
  const ensureSignedIn = useEnsureSignedIn();
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const [extraPayment, setExtraPayment] = useState(0);
  const whatIf = whatIfExtraPayment(loan, extraPayment);
  const schedule = emiSchedule(loan);

  /** README item 40: extends Banking's statement-export pattern (Done
   * item 58) to this module's own primary record — a loan's "statement"
   * is its full amortization schedule, not just the next-12 slice shown
   * on screen. */
  const exportSchedule = () => {
    const header = ['#', 'Due date', 'Installment', loan.repaymentMode === 'fixedTotal' ? 'Markup' : 'Interest', 'Principal', 'Balance'];
    const body = schedule.rows.map((r) => [r.month, installmentDueDate(loan, r.month), r.emi, r.interest, r.principalComp, r.balance]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${loan.name.replace(/\s+/g, '_')}_schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Schedule downloaded.');
  };

  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const plannedBankEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const addPlannedEntries = usePlannedBankWorkbookStore((s) => s.addEntries);
  const deletePlannedEntry = usePlannedBankWorkbookStore((s) => s.deleteEntry);
  const [linkAccountId, setLinkAccountId] = useState(loan.linkedBankAccountId || accounts[0]?.id || '');
  const linkedAccount = accounts.find((a) => a.id === loan.linkedBankAccountId);

  const linkToBank = async () => {
    const account = accounts.find((a) => a.id === linkAccountId);
    if (!account) return toast('Pick a bank account first.');
    if (!(await ensureSignedIn('Sign in to link this loan to a bank account.'))) return;
    const remaining = sum.rows.slice(sum.elapsed);
    if (!remaining.length) return toast('This loan has no remaining installments to plan.');
    const relinking = !!loan.linkedBankAccountId;
    if (relinking) {
      const ok = await confirmDialog(
        'This replaces this loan\'s not-yet-done planned installments with fresh ones for the new account/date. Already-completed plans are untouched.',
        'Re-link this loan?',
      );
      if (!ok) return;
      plannedBankEntries
        .filter((p) => p.sourceEmiLoanId === loan.id && !p.executed)
        .forEach((p) => deletePlannedEntry(p.id));
    }
    const newPlans: PlannedBankTransaction[] = remaining.map((r) => ({
      id: crypto.randomUUID(),
      accountId: account.id,
      date: installmentDueDate(loan, r.month),
      description: `EMI: ${loan.name} (#${r.month}/${loan.tenureMonths})`,
      amount: -r.emi,
      executed: false,
      sourceEmiLoanId: loan.id,
    }));
    addPlannedEntries(newPlans);
    updateEntry(loan.id, { linkedBankAccountId: account.id });
    toast(`Linked — ${newPlans.length} planned installment${newPlans.length > 1 ? 's' : ''} added to ${account.name}'s Planning tab.`);
  };

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
              <IconButton
                label="Save"
                icon={<SaveIcon size={13} />}
                align="right"
                onClick={() => {
                  updateEntry(loan.id, editRow);
                  toast('Loan updated.');
                  setEditing(false);
                }}
              />
              <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditing(false)} />
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
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => { setEditRow(loan); setEditing(true); }} />
              <IconButton
                label="Delete"
                icon={<TrashIcon size={13} />}
                align="right"
                onClick={async () => {
                  if (await confirmDialog('This cannot be undone.', `Delete loan "${loan.name}"?`)) {
                    deleteEntry(loan.id);
                    onBack();
                  }
                }}
              />
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Monthly installment</div><MoneyValue n={sum.emi} currency={loan.currencyCode} /></div>
          <div className="stat-card card" style={hueStyle(HUES[5])}><div className="label">Outstanding</div><MoneyValue n={sum.outstanding} currency={loan.currencyCode} className="value pill-sell" /></div>
          <div className="stat-card card" style={hueStyle(HUES[2])}><div className="label">Paid so far</div><MoneyValue n={sum.paidSoFar} currency={loan.currencyCode} /></div>
          <div className="stat-card card" style={hueStyle(HUES[4])}>
            <div className="label">{loan.repaymentMode === 'fixedTotal' ? 'Markup so far' : 'Interest so far'}</div>
            <MoneyValue n={sum.interestSoFar} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(HUES[0])}><div className="label">Months remaining</div><div className="value">{sum.monthsRemaining}</div></div>
          <div className="stat-card card" style={hueStyle(HUES[6])}>
            <div className="label">{loan.repaymentMode === 'fixedTotal' ? 'Total markup (life)' : 'Total interest (life)'}</div>
            <MoneyValue n={sum.totalInterest} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(HUES[7])}><div className="label">Expected end date</div><div className="value">{expectedEndDate(loan)}</div></div>
        </div>
      </Card>

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Amortization schedule</h3>} style={{ marginBottom: 16 }}>
        <div style={{ height: 220 }}>
          <Bar
            data={{
              labels: schedule.rows.map((r) => r.month),
              datasets: [
                { label: 'Principal', data: schedule.rows.map((r) => r.principalComp), backgroundColor: cssVar('--profit') || '#3ecf8e', stack: 's' },
                { label: loan.repaymentMode === 'fixedTotal' ? 'Markup' : 'Interest', data: schedule.rows.map((r) => r.interest), backgroundColor: cssVar('--loss') || '#e5484d', stack: 's' },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              scales: { x: { stacked: true, title: { display: true, text: 'Month' } }, y: { stacked: true } },
              plugins: { datalabels: dlBarV((v) => fmtMoney(v, loan.currencyCode)) },
            }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>What if: extra payment</h3>} style={{ marginBottom: 16 }}>
        <p className="footer-note" style={{ marginTop: 0 }}>
          See how much sooner this loan clears — and how much {loan.repaymentMode === 'fixedTotal' ? 'markup' : 'interest'} you'd
          save — by paying a fixed extra amount on top of the normal installment every month. A live estimate, nothing is saved.
        </p>
        <Field label={`Extra per month (${loan.currencyCode})`} width={160}>
          <TextInput type="number" step="0.01" value={extraPayment || ''} onChange={(e) => setExtraPayment(Number(e.target.value))} />
        </Field>
        {extraPayment > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 8, marginTop: 12 }}>
            <div className="stat-card card" style={hueStyle(HUES[0])}><div className="label">New months</div><div className="value">{whatIf.months}</div><div className="sub">{whatIf.monthsSaved} sooner</div></div>
            <div className="stat-card card" style={hueStyle(HUES[7])}><div className="label">New end date</div><div className="value" style={{ fontSize: 14 }}>{whatIf.newEndDate}</div></div>
            <div className="stat-card card" style={hueStyle('var(--profit)')}>
              <div className="label">{loan.repaymentMode === 'fixedTotal' ? 'Markup' : 'Interest'} saved</div>
              <MoneyValue n={whatIf.interestSaved} currency={loan.currencyCode} className="value pill-buy" />
            </div>
          </div>
        )}
      </CollapsibleCard>

      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px' }}>Link to bank</h4>
        {linkedAccount ? (
          <p className="footer-note" style={{ marginBottom: 8 }}>
            Linked to <strong>{linkedAccount.name}</strong> — remaining installments are planned in its Planning tab.
          </p>
        ) : (
          <p className="footer-note" style={{ marginBottom: 8 }}>
            Not linked yet. Linking generates a planned (not-yet-done) entry for every remaining installment in the
            chosen account's Planning tab, dated on this loan's own schedule.
          </p>
        )}
        {accounts.length ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="Bank account">
              <Select value={linkAccountId} onChange={(e) => setLinkAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>
                ))}
              </Select>
            </Field>
            <button className="btn secondary" onClick={linkToBank}>
              {linkedAccount ? 'Re-link / regenerate plans' : 'Link to bank'}
            </button>
          </div>
        ) : (
          <p className="footer-note">No bank accounts yet — add one on the Banking page first.</p>
        )}
      </Card>

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Schedule (next 12 installments from today)</h3>}>
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
      <button className="btn secondary" onClick={exportSchedule}>Export full schedule CSV</button>
      </CollapsibleCard>
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
            <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Monthly total</div><MoneyValue n={totals[code].monthlyInstallment} currency={code} /></div>
            <div className="stat-card card" style={hueStyle(HUES[5])}><div className="label">Outstanding</div><MoneyValue n={totals[code].outstanding} currency={code} className="value pill-sell" /></div>
            <div className="stat-card card" style={hueStyle(HUES[2])}><div className="label">Paid so far</div><MoneyValue n={totals[code].paidSoFar} currency={code} /></div>
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
                <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={(e) => { e.stopPropagation(); onEdit(l); }} />{' '}
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
        <Notice tone="warning" style={{ marginTop: 8 }}>
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
        </Notice>
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
