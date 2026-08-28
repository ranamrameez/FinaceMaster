import { useState } from 'react';
import { Modal } from './Modal';
import { Notice } from './Notice';
import { toast } from './Toast';
import { PlusIcon, SaveIcon, TrashIcon } from './icons';
import { Field, Select, TextInput } from './ui/Field';
import { TimeZoneFields } from './ui/TimeZoneFields';
import { SideFields, useSideCurrency, nextUnpaidEmiMonth } from '../features/transfers/pages/TransferLinksPage';
import { getLastTransferSource, rememberTransferSource } from '../hooks/useLastTransferSource';
import { defaultTimezoneForCurrency } from '../lib/datetime';
import { useEnsureSignedIn } from '../lib/firebase/useEnsureSignedIn';
import { isSupportedLinkPair } from '../lib/interEntityLink';
import { createLinkedTransfer } from '../lib/linkCascade';
import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../store/cashWorkbookStore';
import { useEMIWorkbookStore } from '../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../store/fundsWorkbookStore';
import { usePersonalLoansWorkbookStore } from '../store/personalLoansWorkbookStore';
import { usePSXWorkbookStore } from '../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../store/rentalsWorkbookStore';
import { useWorkbookStore } from '../store/workbookStore';
import type { LinkModule, LinkSideConfig } from '../types/interEntityTransfer';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

/** Which modules show a "direction" selector (their native record has an
 * explicit in/out-shaped field) vs. which use a plain signed amount (Bank)
 * or have no direction concept at all (a repayment is always positive,
 * regardless of which way the debt runs — Personal Loans/EMI). Labels
 * match each module's own existing add-form wording exactly, so this
 * reads as the same feature relocated, not a new one. */
const DIRECTION_LABELS: Partial<Record<LinkModule, { in: string; out: string }>> = {
  cash: { in: 'Cash in', out: 'Cash out' },
  rentals: { in: 'Rent income', out: 'Expense' },
  qse: { in: 'Deposit', out: 'Withdrawal' },
  psx: { in: 'Deposit', out: 'Withdrawal' },
  funds: { in: 'Deposit', out: 'Withdrawal' },
};
const HAS_CATEGORY: LinkModule[] = ['bank', 'cash', 'rentals'];
const HAS_NOTE: LinkModule[] = ['cash', 'rentals'];

interface TxRow {
  key: number;
  finance: LinkSideConfig;
  linked: boolean;
  other: LinkSideConfig;
  amount: number;
  direction: 'in' | 'out';
  date: string;
  time?: string;
  timezone?: string;
  category: string;
  note: string;
}

function emptyRow(key: number, finance: LinkSideConfig, currencyCode?: string): TxRow {
  return {
    key,
    finance,
    linked: false,
    other: { module: 'cash', currencyCode },
    amount: 0,
    direction: 'in',
    date: today(),
    time: new Date().toTimeString().slice(0, 5),
    timezone: defaultTimezoneForCurrency(currencyCode),
    category: '',
    note: '',
  };
}

/** One row of the shared "Transfers" popup — its own component instance so
 * `useSideCurrency` (a hook) can be called per row safely; calling a hook
 * inside the parent's `.map()` would violate rules of hooks since the
 * number of rows changes as they're added/removed. */
function TxRowFields({
  row,
  isFirst,
  onChange,
  onRemove,
  canRemove,
}: {
  row: TxRow;
  isFirst: boolean;
  onChange: (row: TxRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const otherCurrency = useSideCurrency(row.other);
  const financeCurrency = useSideCurrency(row.finance);
  const currencyMismatch = row.linked && !!otherCurrency && !!financeCurrency && otherCurrency !== financeCurrency;
  const direction = DIRECTION_LABELS[row.finance.module];
  const sameEntity = row.linked && row.finance.module === row.other.module && !!row.finance.ref && row.finance.ref === row.other.ref;
  const pairSupported = !row.linked || (isSupportedLinkPair(row.finance.module, row.other.module) && isSupportedLinkPair(row.other.module, row.finance.module));

  return (
    <div style={{ borderTop: isFirst ? undefined : '1px solid var(--border)', paddingTop: isFirst ? 0 : 12, marginTop: isFirst ? 0 : 12 }}>
      <SideFields
        label="Finance"
        cfg={row.finance}
        onChange={(finance) => onChange({ ...row, finance, timezone: defaultTimezoneForCurrency(useSideCurrencyStatic(finance)) })}
      />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Field label="Date">
          <TextInput type="date" value={row.date} onChange={(e) => onChange({ ...row, date: e.target.value })} />
        </Field>
        {direction && (
          <Field label="Direction">
            <Select value={row.direction} onChange={(e) => onChange({ ...row, direction: e.target.value as 'in' | 'out' })}>
              <option value="in">{direction.in}</option>
              <option value="out">{direction.out}</option>
            </Select>
          </Field>
        )}
        <Field label="Amount" required title={!direction ? 'Bank: negative = spend/debit, positive = deposit/credit.' : undefined}>
          <TextInput type="number" step="0.01" value={row.amount || ''} onChange={(e) => onChange({ ...row, amount: Number(e.target.value) })} />
        </Field>
        {HAS_CATEGORY.includes(row.finance.module) && (
          <Field label="Category (optional)">
            <TextInput value={row.category} onChange={(e) => onChange({ ...row, category: e.target.value })} />
          </Field>
        )}
        {HAS_NOTE.includes(row.finance.module) && (
          <Field label="Note (optional)">
            <TextInput value={row.note} onChange={(e) => onChange({ ...row, note: e.target.value })} />
          </Field>
        )}
        <TimeZoneFields
          time={row.time}
          timezone={row.timezone}
          onTimeChange={(time) => onChange({ ...row, time })}
          onTimezoneChange={(timezone) => onChange({ ...row, timezone })}
        />
      </div>
      <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={row.linked}
          onChange={(e) => {
            const linked = e.target.checked;
            // Same "remember the last used source" convenience every other
            // linking entry point already has — prefills, never forces.
            const remembered = linked ? getLastTransferSource(row.finance) : undefined;
            onChange({ ...row, linked, other: remembered ?? row.other });
          }}
        />
        Link to another finance (a transfer between two accounts)
      </label>
      {row.linked && (
        <div style={{ marginTop: 8 }}>
          <SideFields label="Other finance" cfg={row.other} onChange={(other) => onChange({ ...row, other })} />
          {sameEntity && <p className="footer-note" style={{ color: 'var(--warn, orange)' }}>Pick a different account — this is the same one.</p>}
          {!pairSupported && !sameEntity && (
            <p className="footer-note" style={{ color: 'var(--warn, orange)' }}>Linking these two isn't supported yet.</p>
          )}
          {currencyMismatch && (
            <Notice tone="warning" style={{ marginTop: 8 }}>
              <p style={{ margin: 0 }}>{financeCurrency} vs. {otherCurrency} — no live conversion, both sides record the same numeric amount.</p>
            </Notice>
          )}
        </div>
      )}
      {canRemove && (
        <button className="btn secondary small" style={{ marginTop: 8 }} onClick={onRemove}>
          <TrashIcon size={12} />Remove row
        </button>
      )}
    </div>
  );
}

// `SideFields`'s own `onChange` only reports the new `LinkSideConfig` value,
// not a currency string — this small helper avoids adding a second callback
// prop to `SideFields` just to retarget the timezone default when the
// module/currency changes. Deliberately NOT a hook (no store reads): a
// module change's own `LinkSideConfig.currencyCode` is already resolved by
// `SideFields` itself before calling back, so this only needs that field.
function useSideCurrencyStatic(cfg: LinkSideConfig): string | undefined {
  return cfg.currencyCode;
}

/** User-requested (2026-08-28): one app-wide "Transfers" popup, reachable
 * from every module via `FabPanel`, replacing every module's own separate
 * "Add a transaction" UI (Bank's batch rows, Cash's/Rentals' single-row
 * add-forms, Personal Loans' inline repayment form, Funds'/QSE's/PSX'
 * Transfers-tab add-forms) AND the standalone Transfers page's
 * `CreateLinkForm` — "This entirely removes the transfers page and the
 * problem of duplicated transaction cards." Each row picks a Finance
 * (defaulting to whichever entity the calling page is already showing,
 * via `defaultFinance`) and optionally a second Finance to make it a
 * linked transfer — exactly what `SideFields`/`createLinkedTransfer`
 * already do for a link, generalized here to also cover the plain
 * single-account case by calling that module's own native "add" action
 * directly. */
export function TransactionEntryModal({ defaultFinance, onClose }: { defaultFinance?: LinkSideConfig; onClose: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const addBankTransactions = useBankWorkbookStore((s) => s.addTransactions);
  const addCashEntry = useCashWorkbookStore((s) => s.addEntry);
  const addRentalEntry = useRentalsWorkbookStore((s) => s.addEntry);
  const addPersonalLoanRepayment = usePersonalLoansWorkbookStore((s) => s.addRepayment);
  const addEMIRepayment = useEMIWorkbookStore((s) => s.addRepayment);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const addQSETransfer = useWorkbookStore((s) => s.addTransfer);
  const addPSXTransfer = usePSXWorkbookStore((s) => s.addTransfer);
  const addFundsTransfer = useFundsWorkbookStore((s) => s.addTransfer);

  const [rows, setRows] = useState<TxRow[]>(() => [emptyRow(0, defaultFinance ?? { module: 'cash' }, defaultFinance?.currencyCode)]);
  const [nextKey, setNextKey] = useState(1);

  const updateRow = (key: number, patch: TxRow) => setRows((rs) => rs.map((r) => (r.key === key ? patch : r)));
  const removeRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = () => {
    setRows((rs) => [...rs, emptyRow(nextKey, defaultFinance ?? { module: 'cash' }, defaultFinance?.currencyCode)]);
    setNextKey((k) => k + 1);
  };

  const submit = async () => {
    const valid = rows.filter((r) => r.amount !== 0);
    if (!valid.length) return toast('Enter an amount on at least one row.');
    for (const r of valid) {
      if (r.linked) {
        const sameEntity = r.finance.module === r.other.module && !!r.finance.ref && r.finance.ref === r.other.ref;
        if (sameEntity) return toast('One row links a finance to itself — pick a different account.');
        if (!isSupportedLinkPair(r.finance.module, r.other.module) || !isSupportedLinkPair(r.other.module, r.finance.module)) {
          return toast('One row links two finances that aren’t a supported pair yet.');
        }
      }
    }
    if (!(await ensureSignedIn('Sign in to save transactions.'))) return;

    let plainCount = 0;
    let linkedCount = 0;
    for (const r of valid) {
      if (r.linked) {
        const abs = Math.abs(r.amount);
        const emiLoan = r.other.module === 'emi' ? emiLoans.find((l) => l.id === r.other.ref) : undefined;
        const resolvedOther = emiLoan ? { ...r.other, emiMonth: nextUnpaidEmiMonth(emiLoan) } : r.other;
        const result = createLinkedTransfer({
          date: r.date,
          fromAmount: abs,
          toAmount: abs,
          from: r.direction === 'out' ? r.finance : resolvedOther,
          to: r.direction === 'out' ? resolvedOther : r.finance,
          note: r.note.trim() || r.category.trim() || undefined,
        });
        if ('error' in result) {
          toast(`Couldn't save one linked row: ${result.error}`);
          continue;
        }
        rememberTransferSource(r.finance, r.other);
        linkedCount++;
        continue;
      }
      switch (r.finance.module) {
        case 'bank':
          if (!r.finance.ref) { toast('Pick a bank account first.'); continue; }
          addBankTransactions([{
            id: uid(), accountId: r.finance.ref, date: r.date, time: r.time, timezone: r.timezone,
            amount: r.amount, description: r.category.trim() || r.note.trim() || 'Transaction',
            category: r.category.trim() || undefined, source: 'manual',
          }]);
          break;
        case 'cash':
          addCashEntry({
            id: uid(), date: r.date, time: r.time, timezone: r.timezone,
            type: r.direction === 'in' ? 'IN' : 'OUT', amount: Math.abs(r.amount),
            currencyCode: r.finance.currencyCode || 'USD',
            category: r.category.trim() || undefined, note: r.note.trim() || undefined, source: 'manual',
          });
          break;
        case 'rentals':
          if (!r.finance.ref) { toast('Pick a property first.'); continue; }
          addRentalEntry({
            id: uid(), propertyId: r.finance.ref, date: r.date, time: r.time, timezone: r.timezone,
            type: r.direction === 'in' ? 'RENT_INCOME' : 'EXPENSE', amount: Math.abs(r.amount),
            category: r.category.trim() || undefined, note: r.note.trim() || undefined,
          });
          break;
        case 'personalLoans':
          if (!r.finance.ref) { toast('Pick a loan first.'); continue; }
          addPersonalLoanRepayment({ id: uid(), loanId: r.finance.ref, date: r.date, time: r.time, timezone: r.timezone, amount: Math.abs(r.amount) });
          break;
        case 'emi': {
          if (!r.finance.ref) { toast('Pick a loan first.'); continue; }
          const loan = emiLoans.find((l) => l.id === r.finance.ref);
          if (!loan) { toast('Pick a loan first.'); continue; }
          addEMIRepayment({ id: uid(), loanId: r.finance.ref, month: nextUnpaidEmiMonth(loan), amount: Math.abs(r.amount), date: r.date, source: 'manual' });
          break;
        }
        case 'qse':
          addQSETransfer({ id: uid(), date: r.date, time: r.time, timezone: r.timezone, type: r.direction === 'in' ? 'DEPOSIT' : 'WITHDRAWAL', gross: Math.abs(r.amount), fee: 0 });
          break;
        case 'psx':
          addPSXTransfer({ id: uid(), date: r.date, time: r.time, timezone: r.timezone, type: r.direction === 'in' ? 'DEPOSIT' : 'WITHDRAWAL', gross: Math.abs(r.amount), fee: 0 });
          break;
        case 'funds':
          addFundsTransfer({ id: uid(), date: r.date, time: r.time, timezone: r.timezone, type: r.direction === 'in' ? 'DEPOSIT' : 'WITHDRAWAL', gross: Math.abs(r.amount), fee: 0 });
          break;
      }
      plainCount++;
    }
    const parts = [plainCount && `${plainCount} transaction${plainCount > 1 ? 's' : ''}`, linkedCount && `${linkedCount} linked transfer${linkedCount > 1 ? 's' : ''}`].filter(Boolean);
    if (parts.length) toast(`Saved ${parts.join(' + ')}.`);
    onClose();
  };

  return (
    <Modal title="Transfers" onClose={onClose}>
      {rows.map((r, i) => (
        <TxRowFields
          key={r.key}
          row={r}
          isFirst={i === 0}
          onChange={(row) => updateRow(r.key, row)}
          onRemove={() => removeRow(r.key)}
          canRemove={rows.length > 1}
        />
      ))}
      <div className="row" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="btn secondary" onClick={addRow}><PlusIcon size={12} />Add row</button>
        <button className="btn" onClick={submit}><SaveIcon />Save</button>
      </div>
    </Modal>
  );
}
