import type { User } from 'firebase/auth';
import { useState, type ReactNode } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { toCSV } from '../../../lib/csv';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { emiSchedule, emiSummary, expectedEndDate, generateBigEmiOverrides, installmentDueDate, markupPercentage, markupRateEquivalents, resolvedDueDate, totalsByCurrency, whatIfExtraPayment, type EMISummary } from '../../../lib/calc/emiModule';
import { dlBarV, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar } from '../../../lib/cssVar';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { confirmAndDeleteLinkable, createLinkedTransfer, warnIfLinked } from '../../../lib/linkCascade';
import { getLastTransferSource, rememberTransferSource } from '../../../hooks/useLastTransferSource';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import type { LinkSideConfig } from '../../../types/interEntityTransfer';
import type { EMILoan, EMIRepayment } from '../../../types/emiWorkbook';
import type { PlannedBankTransaction } from '../../../types/plannedBank';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLoan(defaultCurrency: string): EMILoan {
  return {
    id: '', name: '', lender: '', currencyCode: defaultCurrency, principal: 0,
    tenureMonths: 12, startDate: today(), repaymentMode: 'interest', annualRatePct: 0,
  };
}

/** Floating "add a loan" button (README user feedback 2026-08-26: adding a
 * loan is rare, so it shouldn't permanently occupy the top of the page) —
 * same round-FAB + popup pattern the Calculator button already uses
 * elsewhere in the app. */
function AddLoanFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500 }}>
        <Tooltip text="Add a loan" align="right">
          <button
            className="btn"
            onClick={() => setOpen(true)}
            aria-label="Add a loan"
            style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, fontSize: 22, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
          >
            <PlusIcon />
          </button>
        </Tooltip>
      </div>
      {open && (
        <Modal title="Add a loan" onClose={() => setOpen(false)}>
          <AddLoanForm onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddLoanForm({ onSaved }: { onSaved?: () => void }) {
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
    if (l.paymentDayOfMonth != null && (l.paymentDayOfMonth < 1 || l.paymentDayOfMonth > 31)) return toast('Payment day must be between 1 and 31.');
    if (!(await ensureSignedIn('Sign in to save loans.'))) return;
    addEntry({ ...l, id: crypto.randomUUID(), name: l.name.trim(), lender: l.lender.trim() });
    toast(`Loan "${l.name.trim()}" saved.`);
    setL(emptyLoan(l.currencyCode));
    onSaved?.();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Loan name" width={160} required>
          <TextInput value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder="e.g. Home Mortgage" />
        </Field>
        <Field label="Lender" width={140}>
          <TextInput value={l.lender} onChange={(e) => setL({ ...l, lender: e.target.value })} placeholder="e.g. Chase Bank" />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={l.currencyCode} onChange={(e) => { setL({ ...l, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Principal" width={120} required title="The original loan amount, before any interest/markup or repayments.">
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
          <Field label="Total amount to return" width={160} required>
            <TextInput type="number" step="0.01" value={l.totalToReturn ?? ''} onChange={(e) => setL({ ...l, totalToReturn: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Tenure (months)" width={110} required title="How many months the loan runs for, from the start date to when it's fully paid off.">
          <TextInput type="number" value={l.tenureMonths || ''} onChange={(e) => setL({ ...l, tenureMonths: Number(e.target.value) })} />
        </Field>
        <Field label="Installment start date">
          <TextInput type="date" value={l.startDate} onChange={(e) => setL({ ...l, startDate: e.target.value })} />
        </Field>
        <Field
          label="Custom monthly payment (optional)"
          width={180}
          title="Pay a fixed amount every month instead of the computed installment above — whatever's still owed gets charged in full as a one-time final payment instead of repeating this amount past the point it fully covers the loan."
        >
          <TextInput type="number" step="0.01" value={l.customMonthlyPayment ?? ''} onChange={(e) => setL({ ...l, customMonthlyPayment: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
        <Field
          label="Payment day of month (optional)"
          width={180}
          title="Which day each installment is due on (e.g. 28), regardless of the start date's own day. Falls back to the start date's day when left blank; a day that doesn't exist in a given month (like 31 in a 30-day month) clamps to that month's last day."
        >
          <TextInput
            type="number"
            min={1}
            max={31}
            value={l.paymentDayOfMonth ?? ''}
            onChange={(e) => setL({ ...l, paymentDayOfMonth: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add loan
      </button>
    </div>
  );
}

/** README Pending item 62's remainder: the direct transfer-link shortcut
 * already on QSE/PSX/Rentals/Personal Loans/Funds, now on EMI's Schedule
 * editor — the moment a specific month's installment amount is set is
 * exactly EMI's "log a payment" moment (see `saveOverride`), so this hooks
 * into the same inline editor row rather than a separate add-form. Like
 * `personalLoans`, an EMI repayment's own amount always ignores link
 * direction (see `interEntityLink.ts`'s documented exception) — but the
 * REAL money always leaves the paying Bank/Cash account, so that side is
 * always `from` here, unlike Personal Loans where direction varies. */
function LinkedEMIRepaymentFields({ loan, month, amount, date, onLinked }: { loan: EMILoan; month: number; amount: number; date: string; onLinked: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const loanSide: LinkSideConfig = { module: 'emi', ref: loan.id, emiMonth: month };
  const remembered = getLastTransferSource(loanSide);
  const [otherModule, setOtherModule] = useState<'bank' | 'cash'>(remembered?.module === 'cash' ? 'cash' : 'bank');
  const [otherAccountId, setOtherAccountId] = useState(remembered?.ref ?? bankAccounts[0]?.id ?? '');

  const create = async () => {
    if (!(amount > 0)) return toast('Enter an amount greater than zero.');
    if (otherModule === 'bank' && !otherAccountId) return toast('Add a bank account on the Banking page first.');
    if (!(await ensureSignedIn('Sign in to link this repayment.'))) return;
    const other: LinkSideConfig = otherModule === 'bank' ? { module: 'bank', ref: otherAccountId } : { module: 'cash', currencyCode: cashCurrency };
    const result = createLinkedTransfer({ date, fromAmount: amount, toAmount: amount, from: other, to: loanSide });
    if ('error' in result) return toast(result.error);
    rememberTransferSource(loanSide, other);
    toast('Linked repayment added — also recorded on the other side.');
    onLinked();
  };

  return (
    <div className="row" style={{ gap: 6, alignItems: 'flex-end' }}>
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
      <button className="btn small" onClick={create}>Link &amp; add</button>
    </div>
  );
}

/** Loan-detail stat cards, redesigned into three grouped zones (2026-08-26
 * user feedback — the flat 7-card list was missing several basic figures
 * and didn't group related ones together). Each zone answers one distinct
 * question about the loan:
 * - **Origination**: what was agreed at the start — never changes once the
 *   loan is created (Total Amount Sanctioned, Markup Percentage, Net to
 *   Return).
 * - **Current Status**: where things stand right now (Net Remaining, Net
 *   Paid, the current Monthly EMI — which CAN differ from origination if a
 *   `customMonthlyPayment` or per-month override is set).
 * - **Timeline**: what's coming (Next Due Date, Expected Completion Date,
 *   Remaining EMI Count).
 * "Overdue Balance / Penalties" (part of the user's original zone spec) is
 * deliberately NOT included here — the user's own explicit call, via
 * AskUserQuestion, was to skip it for now rather than build a fake or
 * inconsistent version: this app has no missed-payment/penalty tracking at
 * all (Outstanding/Paid so far already assume on-schedule payment
 * regardless of whether a repayment was actually logged), so a real
 * "Overdue" figure needs its own design pass, not a bolt-on here. */
function LoanStatZones({ loan, sum, loanRepayments }: { loan: EMILoan; sum: EMISummary; loanRepayments: EMIRepayment[] }) {
  const netToReturn = loan.principal + sum.totalInterest;
  const nextDueRow = sum.rows[sum.elapsed];
  const nextDueDate = nextDueRow ? resolvedDueDate(loan, nextDueRow.month, loanRepayments) : null;
  const markupLabel = loan.repaymentMode === 'fixedTotal' ? 'Markup percentage' : 'Interest rate (annual)';

  const zone = (title: string, cards: ReactNode) => (
    <div>
      <div className="footer-note" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>{cards}</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 16, marginTop: 12 }}>
      {zone('Origination', (
        <>
          <div className="stat-card card" style={hueStyle(HUES[3])}>
            <div className="label">Total amount sanctioned</div>
            <MoneyValue n={loan.principal} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(HUES[4])}>
            <Tooltip text={loan.repaymentMode === 'fixedTotal' ? 'Equivalent markup, as a percentage of the principal — this loan has no annual rate, just a flat total to return.' : 'The annual interest rate this loan was agreed at.'}>
              <div className="label" style={{ cursor: 'pointer' }}>{markupLabel}</div>
            </Tooltip>
            <div className="value">{markupPercentage(loan).toFixed(2)}%</div>
            {loan.repaymentMode === 'fixedTotal' ? (
              <Tooltip text="Assumes the flat lifetime markup is spread evenly across the tenure — not a real compounding rate, just a comparable run-rate since this loan has no annual rate of its own.">
                <div className="sub" style={{ cursor: 'pointer' }}>
                  Annual equiv.: {markupRateEquivalents(loan).annual.toFixed(2)}% · Monthly equiv.: {markupRateEquivalents(loan).monthly.toFixed(2)}%
                </div>
              </Tooltip>
            ) : (
              <div className="sub">Monthly: {markupRateEquivalents(loan).monthly.toFixed(2)}%</div>
            )}
          </div>
          <div className="stat-card card" style={hueStyle(HUES[6])}>
            <Tooltip text="Principal plus every interest/markup payment across the whole loan — the total amount you'll have paid by the time it's fully repaid.">
              <div className="label" style={{ cursor: 'pointer' }}>Net to return (total cost)</div>
            </Tooltip>
            <MoneyValue n={netToReturn} currency={loan.currencyCode} />
          </div>
        </>
      ))}
      {zone('Current status', (
        <>
          <div className="stat-card card" style={hueStyle('var(--loss)')}>
            <Tooltip text={loan.repaymentMode === 'fixedTotal' ? 'How much you still owe in total to fully repay this loan, including remaining markup.' : 'The remaining principal you still owe — doesn\'t include interest that hasn\'t accrued yet.'}>
              <div className="label" style={{ cursor: 'pointer' }}>Net remaining (outstanding)</div>
            </Tooltip>
            <MoneyValue n={sum.outstanding} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(HUES[2])}>
            <div className="label">Net paid (to date)</div>
            <MoneyValue n={sum.paidSoFar} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(HUES[0])}>
            <Tooltip text="The current effective installment — can differ from a plain origination EMI if a custom monthly payment or per-month override is set.">
              <div className="label" style={{ cursor: 'pointer' }}>Monthly EMI</div>
            </Tooltip>
            <MoneyValue n={sum.emi} currency={loan.currencyCode} />
          </div>
        </>
      ))}
      {zone('Timeline', (
        <>
          <div className="stat-card card" style={hueStyle(HUES[1])}>
            <div className="label">Next due date</div>
            <div className="value" style={{ fontSize: 16 }}>{nextDueDate || 'Fully repaid'}</div>
          </div>
          <div className="stat-card card" style={hueStyle(HUES[7])}>
            <div className="label">Expected completion date</div>
            <div className="value" style={{ fontSize: 16 }}>{expectedEndDate(loan)}</div>
          </div>
          <div className="stat-card card" style={hueStyle(HUES[2])}>
            <div className="label">Paid EMI count</div>
            <div className="value">{sum.elapsed}</div>
          </div>
          <div className="stat-card card" style={hueStyle(HUES[5])}>
            <div className="label">Remaining EMI count</div>
            <div className="value">{sum.monthsRemaining}</div>
          </div>
        </>
      ))}
    </div>
  );
}

function LoanDetail({ loan, onBack, startInEditMode }: { loan: EMILoan; onBack: () => void; startInEditMode?: boolean }) {
  const deleteEntry = useEMIWorkbookStore((s) => s.deleteEntry);
  const updateEntry = useEMIWorkbookStore((s) => s.updateEntry);
  const repayments = useEMIWorkbookStore((s) => s.workbook.repayments);
  const addRepayment = useEMIWorkbookStore((s) => s.addRepayment);
  const updateRepayment = useEMIWorkbookStore((s) => s.updateRepayment);
  const deleteRepayment = useEMIWorkbookStore((s) => s.deleteRepayment);
  const loanRepayments = repayments.filter((r) => r.loanId === loan.id);
  const [editing, setEditing] = useState(!!startInEditMode);
  const [editRow, setEditRow] = useState<EMILoan>(loan);
  const sum = emiSummary(loan);
  const netToReturn = loan.principal + sum.totalInterest;
  const ensureSignedIn = useEnsureSignedIn();
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const [extraPayment, setExtraPayment] = useState(0);
  const whatIf = whatIfExtraPayment(loan, extraPayment);
  const schedule = emiSchedule(loan);
  const [overrideMonth, setOverrideMonth] = useState<number | null>(null);
  const [overrideValue, setOverrideValue] = useState(0);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideLinkMode, setOverrideLinkMode] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [bigEmiInterval, setBigEmiInterval] = useState(6);
  const [bigEmiAmount, setBigEmiAmount] = useState(0);
  const [bigEmiMode, setBigEmiMode] = useState<'majorOnly' | 'regularPlusMajor'>('majorOnly');
  const [bigEmiReconcile, setBigEmiReconcile] = useState(true);
  const plannedBankEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const addPlannedEntries = usePlannedBankWorkbookStore((s) => s.addEntries);
  const deletePlannedEntry = usePlannedBankWorkbookStore((s) => s.deleteEntry);

  /** README item 6 of a 2026-08-26 feedback batch: some real loans aren't
   * a flat EMI every month — e.g. a property installment plan with one
   * bigger payment every 6th month. User's explicit design choice (via
   * AskUserQuestion) was a per-month override table over a recurring-
   * pattern rule: the regular schedule stays the default, and any single
   * month can be given a different actual payment.
   *
   * README Pending items 21/62's remainder (2026-08-26): this now goes
   * through a real, addressable `EMIRepayment` record (`addRepayment`/
   * `updateRepayment`/`deleteRepayment`, defined in `emiWorkbookStore.ts`)
   * instead of writing `installmentOverrides` directly — those actions keep
   * `installmentOverrides` in sync as a side effect, so the schedule engine
   * itself is untouched, but the payment is now a real ledger row a
   * Bank/Cash transfer can link to (see the Transfers page). */
  const saveOverride = async (month: number, value: number, date?: string) => {
    if (!(value > 0)) return toast('Enter an amount greater than zero.');
    if (!(await ensureSignedIn('Sign in to customize this loan\'s schedule.'))) return;
    const dueDate = date || installmentDueDate(loan, month);
    const existing = loanRepayments.find((r) => r.month === month);
    if (existing) {
      if (!(await warnIfLinked('emi', existing.id))) return;
      updateRepayment(existing.id, { amount: value, date: dueDate });
    } else {
      addRepayment({ id: crypto.randomUUID(), loanId: loan.id, month, amount: value, date: dueDate, source: 'manual' });
    }
    setOverrideMonth(null);
    toast(`Month #${month} set to ${fmtMoney(value, loan.currencyCode)}.`);
  };

  const clearOverride = async (month: number) => {
    const existing = loanRepayments.find((r) => r.month === month);
    if (existing) {
      await confirmAndDeleteLinkable('emi', existing.id, () => deleteRepayment(existing.id));
    } else if (loan.installmentOverrides?.[month] != null) {
      // A pre-2026-08-26 override with no matching repayment record (real
      // user data written before this feature existed) — clear it directly.
      if (!(await ensureSignedIn('Sign in to customize this loan\'s schedule.'))) return;
      const overrides = { ...(loan.installmentOverrides || {}) };
      delete overrides[month];
      updateEntry(loan.id, { installmentOverrides: overrides });
    }
    setOverrideMonth(null);
    toast(`Month #${month} reset to the regular installment.`);
  };

  /** "Big EMI every N months" (2026-08-26, user-requested — see
   * `generateBigEmiOverrides`'s own doc comment for the resolved design).
   * Applies the computed batch of month→amount overrides through the same
   * addRepayment/updateRepayment path a single manual override already
   * uses, so nothing here duplicates the calc engine's own logic — this
   * function is purely "generate the numbers, then write them one month at
   * a time." Only touches not-yet-elapsed months (`sum.elapsed + 1`
   * onward), same as `linkToBank`'s own "remaining installments" scope. */
  const applyBigEmi = async (opts: { intervalMonths: number; amount: number; mode: 'majorOnly' | 'regularPlusMajor'; reconcileLastMonth: boolean }) => {
    if (!(opts.amount > 0)) return toast('Enter an amount greater than zero.');
    if (!(opts.intervalMonths > 0)) return toast('Enter an interval of at least 1 month.');
    if (!(await ensureSignedIn('Sign in to customize this loan\'s schedule.'))) return;
    const overrides = generateBigEmiOverrides(loan, sum.elapsed + 1, opts);
    const months = Object.keys(overrides).map(Number);
    if (!months.length) return toast('No remaining months to apply this to.');
    for (const month of months) {
      const value = overrides[month];
      const dueDate = installmentDueDate(loan, month);
      const existing = loanRepayments.find((r) => r.month === month);
      if (existing) {
        if (!(await warnIfLinked('emi', existing.id))) continue;
        updateRepayment(existing.id, { amount: value, date: existing.date || dueDate });
      } else {
        addRepayment({ id: crypto.randomUUID(), loanId: loan.id, month, amount: value, date: dueDate, source: 'manual' });
      }
    }
    toast(`Applied a bigger installment to ${months.length} month${months.length > 1 ? 's' : ''}.`);
  };

  /** README item 40: extends Banking's statement-export pattern (Done
   * item 58) to this module's own primary record — a loan's "statement"
   * is its full amortization schedule, not just the next-12 slice shown
   * on screen. */
  const exportSchedule = () => {
    const header = ['#', 'Due date', 'Installment', loan.repaymentMode === 'fixedTotal' ? 'Markup' : 'Interest', 'Principal', 'Balance'];
    const body = schedule.rows.map((r) => [r.month, resolvedDueDate(loan, r.month, loanRepayments), r.emi, r.interest, r.principalComp, r.balance]);
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
      date: resolvedDueDate(loan, r.month, loanRepayments),
      description: `EMI: ${loan.name} (#${r.month}/${loan.tenureMonths})`,
      amount: -r.emi,
      executed: false,
      sourceEmiLoanId: loan.id,
      sourceEmiMonth: r.month,
    }));
    addPlannedEntries(newPlans);
    updateEntry(loan.id, { linkedBankAccountId: account.id });
    toast(`Linked — ${newPlans.length} planned installment${newPlans.length > 1 ? 's' : ''} added to ${account.name}'s Planning tab.`);
  };

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All loans</button>
      {/* README item 66 (2026-08-26 feedback): Save/Cancel (and Edit/Delete)
         should sit at the card's top-right corner like every other single-
         stranded-action card in the app (Done item 121) — this previously
         swapped the WHOLE Card body (title included) between a display view
         and an edit view, so the buttons ended up below the field grid
         instead. Restructured onto CollapsibleCard's title/headerExtra
         slots so the action buttons live in a fixed header position in
         both modes, only the body content underneath changes. */}
      <CollapsibleCard
        style={{ marginBottom: 16 }}
        title={
          editing ? (
            <h3 style={{ margin: 0 }}>Editing {loan.name}</h3>
          ) : (
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{loan.name}</div>
              <div className="footer-note" style={{ fontWeight: 400 }}>
                {loan.lender} · {loan.currencyCode} · {loan.repaymentMode === 'fixedTotal' ? 'Fixed total (no interest)' : `${loan.annualRatePct}% p.a.`} · {loan.tenureMonths} months
              </div>
            </div>
          )
        }
        headerExtra={
          editing ? (
            <div className="row" style={{ gap: 8 }}>
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
          ) : (
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
          )
        }
      >
        {editing && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Field label="Loan name">
              <TextInput value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} />
            </Field>
            <Field label="Lender">
              <TextInput value={editRow.lender} onChange={(e) => setEditRow({ ...editRow, lender: e.target.value })} />
            </Field>
            <Field label="Currency">
              <Select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
            <Field label="Principal">
              <TextInput type="number" step="0.01" value={editRow.principal} onChange={(e) => setEditRow({ ...editRow, principal: Number(e.target.value) })} />
            </Field>
            <Field label="Repayment type">
              <Select value={editRow.repaymentMode} onChange={(e) => setEditRow({ ...editRow, repaymentMode: e.target.value as EMILoan['repaymentMode'] })}>
                <option value="interest">Interest rate</option>
                <option value="fixedTotal">Fixed total</option>
              </Select>
            </Field>
            {editRow.repaymentMode === 'interest' ? (
              <Field label="Annual rate (%)">
                <TextInput type="number" step="0.01" value={editRow.annualRatePct ?? ''} onChange={(e) => setEditRow({ ...editRow, annualRatePct: Number(e.target.value) })} />
              </Field>
            ) : (
              <Field label="Total to return">
                <TextInput type="number" step="0.01" value={editRow.totalToReturn ?? ''} onChange={(e) => setEditRow({ ...editRow, totalToReturn: Number(e.target.value) })} />
              </Field>
            )}
            <Field label="Tenure (months)">
              <TextInput type="number" value={editRow.tenureMonths} onChange={(e) => setEditRow({ ...editRow, tenureMonths: Number(e.target.value) })} />
            </Field>
            <Field label="Installment start date">
              <TextInput type="date" value={editRow.startDate} onChange={(e) => setEditRow({ ...editRow, startDate: e.target.value })} />
            </Field>
            <Field label="Custom monthly payment (optional)">
              <TextInput
                type="number"
                step="0.01"
                value={editRow.customMonthlyPayment ?? ''}
                onChange={(e) => setEditRow({ ...editRow, customMonthlyPayment: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
            <Field label="Payment day of month (optional)">
              <TextInput
                type="number"
                min={1}
                max={31}
                value={editRow.paymentDayOfMonth ?? ''}
                onChange={(e) => setEditRow({ ...editRow, paymentDayOfMonth: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
          </div>
        )}
        {/* README Pending item 67: "Big EMI every N months" and "Link to
           bank" used to live as separate always-visible cards on the loan-
           detail page — moved here, into an "Advanced" section of the
           EDIT form specifically (not the add-loan form), per the item's
           own proposed design: "Big EMI" needs a real schedule (elapsed
           months known) to generate against, so it doesn't fit a brand-new
           loan with no history yet. Only shown while editing an EXISTING
           loan — a plain sub-section, not another nested Card, since
           stacking a second card border/shadow inside this one would be
           exactly the "cards inside cards" complaint tracked separately as
           Pending item 90. */}
        {editing && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="footer-note" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Advanced</div>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 4px' }}>Big EMI every N months</h4>
              <p className="footer-note" style={{ marginTop: 0 }}>
                For loans with an occasional bigger payment — e.g. a property installment plan with a larger payment
                every 6 months. The loan keeps its original tenure; if the remainder checkbox is on, whatever's
                still owed at the final month gets swept into that last installment.
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Every N months">
                  <TextInput type="number" min={1} value={bigEmiInterval || ''} onChange={(e) => setBigEmiInterval(Number(e.target.value))} style={{ width: 90 }} />
                </Field>
                <Field label="Amount" title="Either the whole payment for that month, or an extra amount stacked on top of the regular installment — pick which below.">
                  <TextInput type="number" step="0.01" value={bigEmiAmount || ''} onChange={(e) => setBigEmiAmount(Number(e.target.value))} style={{ width: 120 }} />
                </Field>
                <Field label="How the amount applies">
                  <Select value={bigEmiMode} onChange={(e) => setBigEmiMode(e.target.value as 'majorOnly' | 'regularPlusMajor')}>
                    <option value="majorOnly">Major month pays this amount only</option>
                    <option value="regularPlusMajor">Major month pays regular + this amount</option>
                  </Select>
                </Field>
                <button className="btn secondary" onClick={() => applyBigEmi({ intervalMonths: bigEmiInterval, amount: bigEmiAmount, mode: bigEmiMode, reconcileLastMonth: bigEmiReconcile })}>
                  Generate
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                <input type="checkbox" checked={bigEmiReconcile} onChange={(e) => setBigEmiReconcile(e.target.checked)} />
                Add unreconciled amount to last month
              </label>
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px' }}>Link to bank</h4>
              {linkedAccount ? (
                <p className="footer-note" style={{ marginBottom: 8 }}>
                  Linked to <strong>{linkedAccount.name}</strong> — remaining installments are planned in its Planning tab.
                </p>
              ) : (
                <p className="footer-note" style={{ marginBottom: 8 }}>
                  Not linked yet. Linking generates a planned (not-yet-done) entry for every remaining installment in
                  the chosen account's Planning tab, dated on this loan's own schedule.
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
            </div>
          </div>
        )}
        <LoanStatZones loan={loan} sum={sum} loanRepayments={loanRepayments} />
      </CollapsibleCard>

      {/* README item 68 of a 2026-08-26 feedback batch: page order should be
         Stats → Schedule → Charts → What-if — the Amortization chart,
         What-if planner, and Link-to-bank card (which don't have a named
         target position in that request) all moved together as a group to
         right after the Schedule, keeping their own relative order. */}
      <CollapsibleCard
        title={<h3 style={{ margin: 0 }}>Schedule {showFullSchedule ? '(full, start to end)' : '(next 12 installments from today)'}</h3>}
        headerExtra={<button className="btn secondary" onClick={exportSchedule}>Export full schedule CSV</button>}
      >
      <p className="footer-note" style={{ marginTop: 0 }}>
        Click the pencil on any upcoming installment to set a different amount (and, optionally, a different due
        date) for just that month. Every later month recalculates from what's actually paid.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        <input type="checkbox" checked={showFullSchedule} onChange={(e) => setShowFullSchedule(e.target.checked)} />
        Show the full schedule, start to end (instead of just the next 12 installments)
      </label>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Due date</th><th>Installment</th>
              <th>Net paid</th><th>Net balance</th>
              <th>Breakdown</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(showFullSchedule ? sum.rows : sum.rows.slice(sum.elapsed, sum.elapsed + 12)).map((r) => {
              const status = r.month <= sum.elapsed
                ? 'paid'
                : plannedBankEntries.some((p) => p.sourceEmiLoanId === loan.id && p.sourceEmiMonth === r.month && !p.executed)
                  ? 'planned'
                  : 'upcoming';
              const canEdit = r.month > sum.elapsed;
              const paidSoFar = netToReturn - r.balance;
              const paidPct = netToReturn > 0 ? (paidSoFar / netToReturn) * 100 : 0;
              const balancePct = netToReturn > 0 ? (r.balance / netToReturn) * 100 : 0;
              const principalPct = netToReturn > 0 ? (r.principalComp / netToReturn) * 100 : 0;
              const markupPct = netToReturn > 0 ? (r.interest / netToReturn) * 100 : 0;
              return (
              <tr key={r.month}>
                <td>#{r.month}</td>
                {overrideMonth === r.month ? (
                  <td colSpan={6}>
                    <div className="row" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <Field label="Amount">
                        <TextInput type="number" step="0.01" value={overrideValue || ''} onChange={(e) => setOverrideValue(Number(e.target.value))} style={{ width: 110 }} />
                      </Field>
                      <Field label="Due date">
                        <TextInput type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} style={{ width: 140 }} />
                      </Field>
                      {overrideLinkMode ? (
                        <LinkedEMIRepaymentFields
                          loan={loan}
                          month={r.month}
                          amount={overrideValue}
                          date={overrideDate || resolvedDueDate(loan, r.month, loanRepayments)}
                          onLinked={() => { setOverrideMonth(null); setOverrideLinkMode(false); }}
                        />
                      ) : (
                        <IconButton label="Save" icon={<SaveIcon size={13} />} onClick={() => saveOverride(r.month, overrideValue, overrideDate)} />
                      )}
                      <IconButton label="Cancel" icon={<XIcon size={13} />} onClick={() => { setOverrideMonth(null); setOverrideLinkMode(false); }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                      <input type="checkbox" checked={overrideLinkMode} onChange={(e) => setOverrideLinkMode(e.target.checked)} />
                      Link this to a Bank account or Cash (creates a matching entry there too, instead of just here)
                    </label>
                  </td>
                ) : (
                  <>
                    <td>{resolvedDueDate(loan, r.month, loanRepayments)}</td>
                    <td>
                      {fmtMoney(r.emi, loan.currencyCode)}
                      {r.overridden && <span className="footer-note"> (custom)</span>}
                      {r.isBalloon && (
                        <Tooltip text="This final payment was automatically true'd up to whatever was actually still owed, since your custom monthly payment doesn't exactly clear the loan by the last month.">
                          <span className="footer-note" style={{ cursor: 'pointer' }}> (final payment)</span>
                        </Tooltip>
                      )}
                    </td>
                    <td>{fmtMoney(paidSoFar, loan.currencyCode)} ({paidPct.toFixed(1)}%)</td>
                    <td>{fmtMoney(r.balance, loan.currencyCode)} ({balancePct.toFixed(1)}%)</td>
                    <td>
                      <div className="footer-note">Principal: {fmtMoney(r.principalComp, loan.currencyCode)} ({principalPct.toFixed(1)}%)</div>
                      <div className="footer-note">{loan.repaymentMode === 'fixedTotal' ? 'Markup' : 'Interest'}: {fmtMoney(r.interest, loan.currencyCode)} ({markupPct.toFixed(1)}%)</div>
                    </td>
                    <td>
                      <span className={status === 'paid' ? 'pill-buy' : status === 'planned' ? 'pill-info' : 'pill-warn'}>
                        {status === 'paid' ? 'Paid' : status === 'planned' ? 'Planned' : 'Upcoming'}
                      </span>
                    </td>
                  </>
                )}
                <td>
                  {overrideMonth === r.month ? null : canEdit ? (
                    <div className="row" style={{ gap: 4 }}>
                      <IconButton
                        label="Set a custom amount/date for this month"
                        icon={<EditIcon size={13} />}
                        align="right"
                        onClick={() => { setOverrideMonth(r.month); setOverrideValue(r.emi); setOverrideDate(resolvedDueDate(loan, r.month, loanRepayments)); setOverrideLinkMode(false); }}
                      />
                      {r.overridden && <IconButton label="Reset to the regular installment" icon={<XIcon size={13} />} align="right" onClick={() => clearOverride(r.month)} />}
                    </div>
                  ) : null}
                </td>
              </tr>
              );
            })}
            {sum.elapsed >= sum.rows.length && <tr><td colSpan={8} className="footer-note">Loan fully repaid.</td></tr>}
          </tbody>
        </table>
      </div>
      </CollapsibleCard>

      <CollapsibleCard
        title={
          <Tooltip text="A month-by-month breakdown of each installment, showing how much of it pays down the principal vs. how much is interest/markup.">
            <h3 style={{ margin: 0, cursor: 'pointer' }}>Amortization schedule</h3>
          </Tooltip>
        }
        style={{ marginBottom: 16 }}
      >
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

      {/* README Pending item 72: EMI "read as no charts" beyond the
         Amortization stacked bar above — this adds the specific alternate
         view the item itself named as most likely wanted (a balance-over-
         time line, matching Personal Loans' own equivalent chart, Done
         item 172). Reuses `schedule.rows`/`resolvedDueDate` the Schedule
         table already computes — no new calc function, since the whole
         projected balance curve is already known from day 1 for an
         amortizing loan (unlike Personal Loans, where balance-over-time
         depends on actual sparse repayment events that haven't all
         happened yet). */}
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Balance over time</h3>} style={{ marginBottom: 16 }}>
        <div style={{ height: 220 }}>
          <Line
            data={{
              labels: schedule.rows.map((r) => resolvedDueDate(loan, r.month, loanRepayments)),
              datasets: [{
                label: 'Balance',
                data: schedule.rows.map((r) => r.balance),
                borderColor: '#5aa9c9',
                backgroundColor: '#5aa9c933',
                fill: true,
                tension: 0.2,
              }],
            }}
            options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtMoney(v, loan.currencyCode)) } }}
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
              <MoneyValue n={whatIf.interestSaved} currency={loan.currencyCode} />
            </div>
          </div>
        )}
      </CollapsibleCard>

      <RepaymentLog loan={loan} repayments={loanRepayments} />
    </div>
  );
}

/** README Pending items 21/62's remainder: a real, addressable log of every
 * actual payment recorded against this loan — the same underlying data the
 * Schedule table's pencil icon edits (both read/write through
 * `emiWorkbookStore.ts`'s `addRepayment`/`updateRepayment`/
 * `deleteRepayment`), shown here as one reviewable list covering every
 * month (past or upcoming), not just the Schedule table's next-12 window.
 * This is also the addressable record Bank/Cash's Transfers-page linking
 * now points at. */
function RepaymentLog({ loan, repayments }: { loan: EMILoan; repayments: EMIRepayment[] }) {
  const ensureSignedIn = useEnsureSignedIn();
  const updateRepayment = useEMIWorkbookStore((s) => s.updateRepayment);
  const deleteRepayment = useEMIWorkbookStore((s) => s.deleteRepayment);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const sorted = [...repayments].sort((a, b) => a.month - b.month);

  if (!sorted.length) return null;

  const saveEdit = async (r: EMIRepayment) => {
    if (!(editAmount > 0)) return toast('Enter an amount greater than zero.');
    if (!(await ensureSignedIn('Sign in to edit this loan\'s repayments.'))) return;
    if (!(await warnIfLinked('emi', r.id))) return;
    updateRepayment(r.id, { amount: editAmount });
    setEditId(null);
    toast('Repayment updated.');
  };

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Repayment log</h3>} style={{ marginBottom: 16 }}>
      <p className="footer-note" style={{ marginTop: 0 }}>
        Every actual payment recorded against this loan. A Bank/Cash entry on the Transfers page can link to one
        of these — deleting a linked repayment here also removes the linked side there.
      </p>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Month</th><th>Due date</th><th>Amount</th><th>Source</th><th></th></tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td>#{r.month}</td>
                <td>{installmentDueDate(loan, r.month)}</td>
                <td>
                  {editId === r.id ? (
                    <TextInput type="number" step="0.01" value={editAmount || ''} onChange={(e) => setEditAmount(Number(e.target.value))} style={{ width: 100 }} />
                  ) : fmtMoney(r.amount, loan.currencyCode)}
                </td>
                <td>{r.source === 'statement-import' ? 'Imported' : 'Manual'}</td>
                <td>
                  {editId === r.id ? (
                    <div className="row" style={{ gap: 4 }}>
                      <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={() => saveEdit(r)} />
                      <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                    </div>
                  ) : (
                    <div className="row" style={{ gap: 4 }}>
                      <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => { setEditId(r.id); setEditAmount(r.amount); }} />
                      <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => confirmAndDeleteLinkable('emi', r.id, () => deleteRepayment(r.id))} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
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
            <div className="stat-card card" style={hueStyle('var(--loss)')}>
              <Tooltip text="How much you still owe across your loans in this currency — remaining principal only for interest-rate loans, the full remaining amount (including markup) for fixed-total loans.">
                <div className="label" style={{ cursor: 'pointer' }}>Outstanding</div>
              </Tooltip>
              <MoneyValue n={totals[code].outstanding} currency={code} />
            </div>
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
          {/* User-reported 2026-08-26: "no one adds a EMI/Loan every day" —
             the add-loan form used to sit permanently at the top, pushing
             the stats/list a full scroll down for the much more common
             "check my loans" visit. Moved behind a floating add button
             (same round-FAB pattern as the Calculator button) with the
             form itself in a popup, and the stats+list now render first. */}
          <OverallSummary />
          <LoanList onSelect={openLoan} onEdit={editLoan} />
          <AccountSection syncStatus={syncStatus} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
          <AddLoanFab />
        </div>
      )}
    </div>
  );
}
