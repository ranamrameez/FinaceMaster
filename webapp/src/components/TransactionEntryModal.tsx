import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { toast } from './Toast';
import { Tooltip } from './Tooltip';
import { PlusIcon, SaveIcon, TrashIcon } from './icons';
import { Field, TextInput } from './ui/Field';
import { AmountInput } from './ui/AmountInput';
import { DirectionChips } from './ui/DirectionChips';
import { TimeZoneFields } from './ui/TimeZoneFields';
import { PendingToggle } from './ui/PendingToggle';
import { SideFields, useSideCurrency, nextUnpaidEmiMonth } from '../features/transfers/pages/TransferLinksPage';
import { getLastTransferSource, rememberTransferSource } from '../hooks/useLastTransferSource';
import { CategorySelect } from './CategorySelect';
import { UNCATEGORIZED_ID } from '../lib/categories';
import { defaultTimeForDate, defaultTimezoneForCurrency, nowTime } from '../lib/datetime';
import { convertAmount, loadCachedFxRates } from '../lib/fx';
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

/** Which modules show a "direction" chip toggle (their native record has
 * an explicit in/out-shaped field, or — as of the fix below — a signed
 * amount whose sign this control now sets explicitly) vs. which have no
 * direction concept at all (a repayment is always positive, regardless of
 * which way the debt runs — Personal Loans/EMI). Labels match each
 * module's own existing add-form wording exactly, so this reads as the
 * same feature relocated, not a new one.
 *
 * `bank` added here 2026-09-06, fixing a real user-reported bug: Bank used
 * to have NO entry here at all (it relied on the typed amount's own sign
 * instead), which meant `submit()`'s linked-transfer branch — which always
 * decides `from`/`to` from `row.direction`, never from the amount's sign —
 * had no way to ever set `row.direction` to `'out'` for a Bank row, since
 * the `{direction && (...)}` control below never rendered. Every Bank
 * linked transfer therefore silently treated the Bank side as the
 * receiving ("in") side, no matter what sign the user typed — see
 * `DirectionChips.tsx`'s own doc comment for the full trace. Giving Bank a
 * real, user-controlled direction fixes this at its root for both the
 * plain and the linked case, and — per the same user's follow-up ask,
 * "use radio/chips ... instead of positive & negative entries" — replaces
 * the sign-based entry convention with the same explicit control every
 * other module here already had. */
const DIRECTION_LABELS: Partial<Record<LinkModule, { in: string; out: string }>> = {
  bank: { in: 'Deposit', out: 'Withdrawal' },
  cash: { in: 'Cash in', out: 'Cash out' },
  rentals: { in: 'Rent income', out: 'Expense' },
  qse: { in: 'Deposit', out: 'Withdrawal' },
  psx: { in: 'Deposit', out: 'Withdrawal' },
  funds: { in: 'Deposit', out: 'Withdrawal' },
};
const HAS_CATEGORY: LinkModule[] = ['bank', 'cash', 'rentals'];
const HAS_NOTE: LinkModule[] = ['cash', 'rentals'];
/** Bank has no `Finance.title` — its own pre-existing `description` field
 * already fills that role (see `types/finance.ts`'s file-level comment) —
 * so this is the one module that needs its own "what is this" text input
 * here. Real bug fix (user-reported): before this, a Bank row had NO title/
 * description input at all in this popup, so `description` silently fell
 * back to the category text or the literal string "Transaction" — the app
 * substituting a value instead of taking real user input. */
const HAS_DESCRIPTION: LinkModule[] = ['bank'];
/** User-requested (2026-09-08): a "Pending" state — a real transaction the
 * user already knows is happening but hasn't cleared yet (a sent transfer
 * not yet reflected, a stock order not yet filled). Shipped first for
 * Cash + Banking, the user's own two worked examples — see
 * `Finance.isPending`'s own doc comment for the full design and why this is
 * genuinely different from the Planning feature's hypothetical entries.
 * Deliberately not offered on a LINKED row: a cross-entity transfer is two
 * real records written together via `createLinkedTransfer`, and "pending"
 * for a link needs its own design (does one side clear independently of
 * the other?) not attempted here. */
const HAS_PENDING: LinkModule[] = ['cash', 'bank', 'rentals', 'personalLoans'];

interface TxRow {
  key: number;
  finance: LinkSideConfig;
  linked: boolean;
  other: LinkSideConfig;
  amount: number;
  /** The "other" side's own amount for a cross-currency linked transfer —
   * see the currency-mismatch block in `TxRowFields` below for why this
   * exists. Kept in sync with the live FX-cache suggestion (via a
   * `useEffect` in `TxRowFields`) as long as `toAmountTouched` is false, so
   * `submit()` below can just read this field directly rather than
   * needing to recompute the suggestion itself (which it can't — currency
   * resolution is a hook, only callable from a component's render). */
  toAmount?: number;
  /** True once the user has actually edited the suggested `toAmount` — from
   * then on it's their own real number, and the `useEffect` stops
   * overwriting it as `amount`/currencies keep changing. */
  toAmountTouched: boolean;
  /** User-requested: where a cross-currency link's conversion rate came
   * from (e.g. "UBL bank rate", "Sarafa exchange") — see
   * `InterEntityTransfer.rateSource`'s own doc comment. Only shown/used
   * while the two sides' currencies actually differ. */
  rateSource: string;
  direction: 'in' | 'out';
  date: string;
  time?: string;
  /** True once the user has actually edited the Time field themselves —
   * from then on it's their own real choice, and the Date field's own
   * onChange stops re-stamping it. See `defaultTimeForDate()`'s own doc
   * comment for why this exists (README item: "some transactions are not
   * showing up down arrows"). */
  timeTouched: boolean;
  timezone?: string;
  categoryID: string;
  description: string;
  note: string;
  pending: boolean;
}

/** User-reported (2026-09-08): "try to choose the same/logical module by
 * default for max UX. like Bank to Bank, Cash to Bank." `bank` is the most
 * likely real "other side" for every module — including Bank itself
 * (Bank-to-Bank, the user's own first example) — so this is a plain
 * constant default rather than a per-module lookup table; still named and
 * documented so a future session doesn't have to re-derive why. Only a
 * prefill: `getLastTransferSource()` (checked first, wherever this is
 * used) and the user's own pick both still win over it. */
const LIKELY_OTHER_MODULE: LinkModule = 'bank';

function emptyRow(key: number, finance: LinkSideConfig, currencyCode?: string): TxRow {
  return {
    key,
    finance,
    linked: false,
    other: { module: LIKELY_OTHER_MODULE, currencyCode },
    amount: 0,
    direction: 'in',
    date: today(),
    time: nowTime(defaultTimezoneForCurrency(currencyCode)),
    timeTouched: false,
    timezone: defaultTimezoneForCurrency(currencyCode),
    categoryID: UNCATEGORIZED_ID,
    description: '',
    note: '',
    pending: false,
    toAmountTouched: false,
    rateSource: '',
  };
}

/** One row of the shared "Transfers" popup — its own component instance so
 * `useSideCurrency` (a hook) can be called per row safely; calling a hook
 * inside the parent's `.map()` would violate rules of hooks since the
 * number of rows changes as they're added/removed. */
function TxRowFields({
  row,
  onChange,
  onRemove,
  canRemove,
}: {
  row: TxRow;
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

  // User-requested (2026-09-08, design confirmed via AskUserQuestion):
  // "allow the automated editable converted values" — suggests the other
  // side's amount from the same cached FX rate table Net Worth already
  // uses (`lib/fx.ts`), kept live-updating in `row.toAmount` as `amount`/
  // currencies change until the user actually edits the field (then
  // `toAmountTouched` stops this effect from overwriting their own value).
  const cachedRates = loadCachedFxRates();
  const suggestedToAmount = currencyMismatch ? convertAmount(row.amount, financeCurrency!, otherCurrency!, cachedRates) : null;
  useEffect(() => {
    if (currencyMismatch && !row.toAmountTouched && row.toAmount !== (suggestedToAmount ?? undefined)) {
      onChange({ ...row, toAmount: suggestedToAmount ?? undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyMismatch, suggestedToAmount, row.toAmountTouched]);

  return (
    <div className="entry-row">
      <SideFields
        label="Finance"
        cfg={row.finance}
        onChange={(finance) =>
          onChange({
            ...row,
            finance,
            timezone: defaultTimezoneForCurrency(useSideCurrencyStatic(finance)),
            toAmount: undefined,
            toAmountTouched: false,
          })
        }
      />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Field label="Date">
          <TextInput
            type="date"
            value={row.date}
            onChange={(e) => {
              const date = e.target.value;
              onChange(row.timeTouched ? { ...row, date } : { ...row, date, time: defaultTimeForDate(date, row.timezone) });
            }}
          />
        </Field>
        {direction && (
          <Field label="Direction">
            <DirectionChips value={row.direction} onChange={(d) => onChange({ ...row, direction: d })} labels={direction} />
          </Field>
        )}
        <Field label="Amount" required title={!direction ? 'A repayment is always entered as a positive amount, regardless of which way the debt runs.' : 'You can type a math expression here too, e.g. 10.5+5 — it evaluates once you leave the field.'}>
          <AmountInput value={row.amount} onChange={(amount) => onChange({ ...row, amount })} />
        </Field>
        {HAS_DESCRIPTION.includes(row.finance.module) && (
          <Field label="Description" required>
            <TextInput value={row.description} onChange={(e) => onChange({ ...row, description: e.target.value })} placeholder="e.g. Rent, Grocery run" />
          </Field>
        )}
        {HAS_CATEGORY.includes(row.finance.module) && !row.linked && (
          <Field label="Category">
            <CategorySelect value={row.categoryID} onChange={(categoryID) => onChange({ ...row, categoryID })} />
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
          onTimeChange={(time) => onChange({ ...row, time, timeTouched: true })}
          onTimezoneChange={(timezone) => onChange({ ...row, timezone })}
        />
      </div>
      <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={row.linked}
          onChange={(e) => {
            const linked = e.target.checked;
            // Same "remember the last used source" convenience every other
            // linking entry point already has — prefills, never forces.
            const remembered = linked ? getLastTransferSource(row.finance) : undefined;
            onChange({ ...row, linked, other: remembered ?? row.other, toAmount: undefined, toAmountTouched: false });
          }}
        />
        {HAS_CATEGORY.includes(row.finance.module) ? (
          <Tooltip text="A linked transfer is always categorized as Transfer on this side — the Category picker above is hidden while this is checked, not silently ignored.">
            <span>Link to another finance (a transfer between two accounts)</span>
          </Tooltip>
        ) : (
          'Link to another finance (a transfer between two accounts)'
        )}
      </label>
      {!row.linked && HAS_PENDING.includes(row.finance.module) && (
        <div style={{ marginTop: 8 }}>
          <PendingToggle
            checked={row.pending}
            onChange={(v) => onChange({ ...row, pending: v })}
            label="Pending (not yet cleared)"
            title="Money already sent/placed but not yet reflected or filled — excluded from the current balance until you mark it cleared."
          />
        </div>
      )}
      {row.linked && (
        <div style={{ marginTop: 8 }}>
          <SideFields
            label="Other finance"
            cfg={row.other}
            onChange={(other) => onChange({ ...row, other, toAmount: undefined, toAmountTouched: false })}
            preferredCurrency={financeCurrency ?? undefined}
          />
          {sameEntity && <p className="text-muted" style={{ color: 'var(--warn, orange)' }}>Pick a different account — this is the same one.</p>}
          {!pairSupported && !sameEntity && (
            <p className="text-muted" style={{ color: 'var(--warn, orange)' }}>Linking these two isn't supported yet.</p>
          )}
          {currencyMismatch && (
            <div style={{ marginTop: 8 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Field label={`Amount (${otherCurrency})`}>
                  <TextInput
                    type="number"
                    step="0.01"
                    value={row.toAmount ?? ''}
                    onChange={(e) => onChange({ ...row, toAmount: e.target.value === '' ? undefined : Number(e.target.value), toAmountTouched: true })}
                  />
                </Field>
                <Field label="Rate source (optional)" title="Where this conversion rate came from — e.g. your bank's rate, a specific exchange name — for your own future reference.">
                  <TextInput
                    value={row.rateSource}
                    onChange={(e) => onChange({ ...row, rateSource: e.target.value })}
                    placeholder="e.g. UBL bank rate"
                  />
                </Field>
              </div>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>
                {financeCurrency} → {otherCurrency}
                {' — '}
                {row.toAmountTouched
                  ? 'entered manually.'
                  : cachedRates && suggestedToAmount !== null
                    ? `via cached FX rate (updated ${new Date(cachedRates.fetchedAt).toLocaleDateString()}) — editable.`
                    : 'no cached FX rate available — enter the converted amount yourself.'}
              </p>
            </div>
          )}
        </div>
      )}
      {canRemove && (
        <div className="d-flex justify-end" style={{ marginTop: 8 }}>
          <button className="btn secondary small" onClick={onRemove}>
            <TrashIcon size={12} />Remove row
          </button>
        </div>
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
        // `r.amount` is always the FINANCE side's own amount; `r.toAmount`
        // (when set — a cross-currency link) is always the OTHER side's —
        // `from`/`to` below swap which is which based on direction, so
        // fromAmount/toAmount need the same conditional swap, not a flat
        // `abs` on both sides (that was only correct back when every
        // linked transfer shared one numeric amount for both currencies).
        const financeAmount = abs;
        const otherAmount = r.toAmount ?? abs;
        const result = createLinkedTransfer({
          date: r.date,
          fromAmount: r.direction === 'out' ? financeAmount : otherAmount,
          toAmount: r.direction === 'out' ? otherAmount : financeAmount,
          from: r.direction === 'out' ? r.finance : resolvedOther,
          to: r.direction === 'out' ? resolvedOther : r.finance,
          note: r.note.trim() || r.description.trim() || undefined,
          rateSource: r.rateSource.trim() || undefined,
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
        case 'bank': {
          if (!r.finance.ref) { toast('Pick a bank account first.'); continue; }
          if (!r.description.trim()) { toast('Enter a description for this transaction.'); continue; }
          // The Amount field is now always a magnitude (see DIRECTION_LABELS'
          // own doc comment) — the direction chip decides the sign of the
          // stored (still-signed) BankTransaction.amount, not the user
          // having to type a leading `-`. `isDeposit` is re-derived from
          // this sign by the store itself on every write regardless.
          const signedAmount = r.direction === 'out' ? -Math.abs(r.amount) : Math.abs(r.amount);
          addBankTransactions([{
            id: uid(), accountId: r.finance.ref, date: r.date, time: r.time, timezone: r.timezone,
            amount: signedAmount, isDeposit: signedAmount >= 0, description: r.description.trim(),
            categoryID: r.categoryID, source: 'manual',
            isPending: r.pending || undefined,
          }]);
          break;
        }
        case 'cash':
          addCashEntry({
            id: uid(), date: r.date, time: r.time, timezone: r.timezone,
            isDeposit: r.direction === 'in', amount: Math.abs(r.amount),
            currencyCode: r.finance.currencyCode || 'USD',
            categoryID: r.categoryID, note: r.note.trim() || undefined, source: 'manual',
            isPending: r.pending || undefined,
          });
          break;
        case 'rentals':
          if (!r.finance.ref) { toast('Pick a property first.'); continue; }
          addRentalEntry({
            id: uid(), propertyId: r.finance.ref, date: r.date, time: r.time, timezone: r.timezone,
            isDeposit: r.direction === 'in', amount: Math.abs(r.amount),
            categoryID: r.categoryID, note: r.note.trim() || undefined,
            isPending: r.pending || undefined,
          });
          break;
        case 'personalLoans':
          if (!r.finance.ref) { toast('Pick a loan first.'); continue; }
          addPersonalLoanRepayment({
            id: uid(), loanId: r.finance.ref, date: r.date, time: r.time, timezone: r.timezone,
            amount: Math.abs(r.amount), isPending: r.pending || undefined,
          });
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
      {rows.map((r) => (
        <TxRowFields
          key={r.key}
          row={r}
          onChange={(row) => updateRow(r.key, row)}
          onRemove={() => removeRow(r.key)}
          canRemove={rows.length > 1}
        />
      ))}
      <div className="row" style={{ gap: 8, marginTop: 16 }}>
        <button className="btn secondary" onClick={addRow}><PlusIcon size={12} />Add row</button>
      </div>
      <div className="d-flex justify-center" style={{ marginTop: 16 }}>
        <button className="btn" style={{ minWidth: 220 }} onClick={submit}><SaveIcon />Save</button>
      </div>
    </Modal>
  );
}
