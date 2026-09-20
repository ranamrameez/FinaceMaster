import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CollapsibleCard, EntityCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { ArchiveIcon, EditIcon, PlusIcon, RestoreIcon, SaveIcon, StarIcon, TransferIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { FabPanel } from '../../../components/ui/Fab';
import { RecordDetailModal } from '../../../components/RecordDetailModal';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { AmountInput } from '../../../components/ui/AmountInput';
import { IconButton } from '../../../components/ui/IconButton';
import { AttributeList } from '../../../components/ui/AttributeList';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { CategorySelect } from '../../../components/CategorySelect';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { RecurrenceFields } from '../../../components/ui/RecurrenceFields';
import { useEnabledCurrencies } from '../../../hooks/useEnabledCurrencies';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { usePrimaryCurrency } from '../../../hooks/usePrimaryCurrency';
import { usePageFabActions } from '../../../hooks/usePageFabActions';
import { getLastTransferSource, rememberTransferSource } from '../../../hooks/useLastTransferSource';
import { hueStyle } from '../../../lib/statCardHues';
import { categoryName, UNCATEGORIZED_ID } from '../../../lib/categories';
import { gridAutoStyle } from '../../../lib/gridStyle';
import { nextRecurrenceOccurrence } from '../../../lib/calc/recurrence';
import { recurrenceLabel } from '../../../lib/recurrenceLabel';
import { plannedCreditCardProjection } from '../../../lib/calc/plannedBalance';
import { useCategoryStore } from '../../../store/categoryStore';
import {
  availableCredit,
  creditCardMonthlyHistory,
  currentStatement,
  markupThisCycle,
  nextPendingMinDue,
  outstandingBalanceByCard,
  proposeMinPayment,
} from '../../../lib/calc/creditCardModule';
import { fmtMoney } from '../../../lib/format';
import { createLinkedTransfer } from '../../../lib/linkCascade';
import { defaultTimezoneForCurrency, nowTime } from '../../../lib/datetime';
import { firebaseReady } from '../../../lib/firebase/client';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { addCreditCardTransactions, useCreditCardWorkbookStore } from '../../../store/creditCardWorkbookStore';
import { usePlannedCreditCardWorkbookStore } from '../../../store/plannedCreditCardWorkbookStore';
import type { LinkSideConfig } from '../../../types/interEntityTransfer';
import type { CreditCard, CreditCardTransaction, CreditCardTransactionKind } from '../../../types/creditCard';
import type { PlannedCreditCardTransaction } from '../../../types/plannedCreditCard';
import type { BankAccount } from '../../../types/bankWorkbook';

const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

function emptyCard(defaultCurrency: string): Omit<CreditCard, 'id'> {
  return { name: '', currencyCode: defaultCurrency, minPaymentMethod: 'fixed' };
}

const KIND_LABELS: Record<CreditCardTransactionKind, string> = {
  charge: 'Charge (purchase)',
  payment: 'Payment (toward the balance)',
  fee: 'Fee',
  markup: 'Markup',
  cashAdvance: 'Cash advance',
};

/** `initialCurrency`/`onSaved(id)` — see `AddAccountForm`'s own doc
 * comment (`BankPage.tsx`) for why: `SideFields`' "+" quick-add reuses
 * this exact form. */
export function AddCreditCardForm({ onSaved, initialCurrency }: { onSaved?: (id: string) => void; initialCurrency?: string } = {}) {
  const addCard = useCreditCardWorkbookStore((s) => s.addCard);
  const primaryCurrency = usePrimaryCurrency();
  const [lastCurrency, setLastCurrency] = useLastCurrency('creditCard', primaryCurrency ?? 'USD');
  const ensureSignedIn = useEnsureSignedIn();
  const [c, setC] = useState<Omit<CreditCard, 'id'>>(() => emptyCard(initialCurrency ?? lastCurrency));
  const currencyOptions = useEnabledCurrencies(c.currencyCode);

  const submit = async () => {
    if (!c.name.trim()) return toast('Enter a card name.');
    if (!(await ensureSignedIn('Sign in to save credit cards.'))) return;
    const id = uid();
    addCard({ ...c, id, name: c.name.trim() });
    toast(`Card "${c.name.trim()}" added.`);
    setC(emptyCard(c.currencyCode));
    onSaved?.(id);
  };

  return (
    <div>
      <div className="row gap-sm">
        <Field label="Card name" width={180} required>
          <TextInput value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="e.g. Sharia Card" />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={c.currencyCode} onChange={(e) => { setC({ ...c, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {currencyOptions.map((cur) => <option key={cur.code} value={cur.code}>{cur.code}</option>)}
          </Select>
        </Field>
        <Field label="Credit limit (optional)" width={140}>
          <TextInput type="number" step="0.01" value={c.creditLimit ?? ''} onChange={(e) => setC({ ...c, creditLimit: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
        <Field label="Already owed (optional)" width={140} title="Debt that already exists on this card before you start tracking it here — e.g. from a real statement you already have. Leave blank for a brand-new card with nothing owed yet.">
          <TextInput type="number" step="0.01" value={c.openingBalance ?? ''} onChange={(e) => setC({ ...c, openingBalance: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
      </div>
      <button className="btn mt-12" onClick={submit}>
        <PlusIcon />Add card
      </button>
    </div>
  );
}

/** The user's own explicit requirement: "progress bar for limit
 * tracking." A red (consumed) / green (available) two-segment bar, same
 * convention Banking's own (now-superseded) `isLiability` version already
 * used. */
function CreditUsageBar({ used, limit, currency }: { used: number; limit: number; currency: string }) {
  const usedPct = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
  return (
    <div className="mb-md">
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'color-mix(in srgb, var(--profit) 30%, var(--panel-2))' }}>
        <div style={{ width: `${usedPct}%`, background: 'var(--loss)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
        <span className="text-loss">Used: {fmtMoney(used, currency)}</span>
        <span className="text-profit">Available: {fmtMoney(availableCredit({ id: '', name: '', currencyCode: currency, creditLimit: limit }, used), currency)} of {fmtMoney(limit, currency)}</span>
      </div>
    </div>
  );
}

/** Cross-entity linking — the user's own explicit "account linking option
 * as well to ensure seamless experience" requirement. Mirrors Rentals'
 * `LinkedRentCollectionFields` exactly: a linked payment into a credit
 * card always means "pay it down" (see `interEntityLink.ts`'s own
 * `creditCard` case), so the card is always the `to` side and the real
 * Bank/Cash account is always `from`. */
function LinkedCardPaymentFields({
  card,
  amount,
  date,
  onLinked,
}: {
  card: CreditCard;
  amount: number;
  date: string;
  onLinked: () => void;
}) {
  const ensureSignedIn = useEnsureSignedIn();
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const cardSide: LinkSideConfig = { module: 'creditCard', ref: card.id };
  const remembered = getLastTransferSource(cardSide);
  const [otherModule, setOtherModule] = useState<'bank' | 'cash'>(remembered?.module === 'cash' ? 'cash' : 'bank');
  const [otherAccountId, setOtherAccountId] = useState(remembered?.ref ?? bankAccounts[0]?.id ?? '');

  const create = async () => {
    if (!(amount > 0)) return toast('Enter an amount greater than zero.');
    if (otherModule === 'bank' && !otherAccountId) return toast('Add a bank account on the Banking page first.');
    if (!(await ensureSignedIn('Sign in to link this payment.'))) return;
    const other: LinkSideConfig = otherModule === 'bank' ? { module: 'bank', ref: otherAccountId } : { module: 'cash', currencyCode: cashCurrency };
    const result = createLinkedTransfer({ date, fromAmount: amount, toAmount: amount, from: other, to: cardSide });
    if ('error' in result) return toast(result.error);
    rememberTransferSource(cardSide, other);
    toast('Linked payment logged — also recorded on the other side.');
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
          <span className="text-muted">No bank accounts yet.</span>
        )
      )}
      <button className="btn small" onClick={create}>Link &amp; log</button>
    </div>
  );
}

function emptyTx(cardId: string, currencyCode: string): Omit<CreditCardTransaction, 'id'> {
  return {
    cardId,
    date: today(),
    time: nowTime(defaultTimezoneForCurrency(currencyCode)),
    timezone: defaultTimezoneForCurrency(currencyCode),
    kind: 'charge',
    amount: 0,
    description: '',
    categoryID: UNCATEGORIZED_ID,
    source: 'manual',
  };
}

/** User-reported (2026-09-14): "No FAB capable of multiple enteries at a
 * time" — this used to add exactly one transaction per submit (add, form
 * resets, sign-in-gate re-runs) with no way to queue several from one
 * real statement in a single sitting, unlike the app-wide `Main` tier's
 * own "FAB(+) + popups for adding a single OR A BATCH of new
 * transactions" rule (CLAUDE.md) — every other kind-picker-needing add
 * flow either already batches (Bank's own CSV import,
 * `TransactionEntryModal`'s multi-row `rows` state) or doesn't need to
 * (a plain deposit/withdrawal covered by `TransactionEntryModal` itself,
 * which a credit card can't fully use since it hardcodes `kind:'payment'`
 * — see that file's own comment). Rewritten onto the same
 * queue-a-row/remove-a-row/submit-all-at-once shape, backed by the
 * already-existing bulk `addCreditCardTransactions`. */
function AddCardTransactionForm({ card, onDone }: { card: CreditCard; onDone?: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const [nextKey, setNextKey] = useState(1);
  const [rows, setRows] = useState<(Omit<CreditCardTransaction, 'id'> & { key: number })[]>(() => [{ ...emptyTx(card.id, card.currencyCode), key: 0 }]);

  const updateRow = (key: number, patch: Partial<CreditCardTransaction>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => {
    setRows((rs) => [...rs, { ...emptyTx(card.id, card.currencyCode), key: nextKey }]);
    setNextKey((k) => k + 1);
  };
  const removeRow = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));

  const submit = async () => {
    const valid = rows.filter((r) => r.amount > 0 && r.description.trim());
    if (!valid.length) return toast('Enter an amount and description on at least one row.');
    if (!(await ensureSignedIn('Sign in to save transactions.'))) return;
    addCreditCardTransactions(valid.map((r) => ({ ...r, id: uid(), description: r.description.trim() })));
    toast(valid.length > 1 ? `${valid.length} transactions saved.` : 'Transaction saved.');
    onDone?.();
  };

  return (
    <div>
      {rows.map((row, i) => (
        <div key={row.key} className="row gap-sm mb-sm" style={{ alignItems: 'flex-end' }}>
          <Field label="Type" width={190} required={i === 0}>
            <Select value={row.kind} onChange={(e) => updateRow(row.key, { kind: e.target.value as CreditCardTransactionKind })}>
              {(Object.keys(KIND_LABELS) as CreditCardTransactionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </Select>
          </Field>
          <Field label="Date" width={140}>
            <TextInput type="date" value={row.date} onChange={(e) => updateRow(row.key, { date: e.target.value })} />
          </Field>
          <Field label="Amount" required={i === 0}>
            <AmountInput value={row.amount} onChange={(amount) => updateRow(row.key, { amount })} />
          </Field>
          <Field label="Description" required={i === 0} width={200}>
            <TextInput value={row.description} onChange={(e) => updateRow(row.key, { description: e.target.value })} placeholder="e.g. Groceries, Fuel" />
          </Field>
          <Field label="Category">
            <CategorySelect value={row.categoryID ?? UNCATEGORIZED_ID} onChange={(categoryID) => updateRow(row.key, { categoryID })} />
          </Field>
          <TimeZoneFields
            time={row.time}
            timezone={row.timezone}
            onTimeChange={(time) => updateRow(row.key, { time })}
            onTimezoneChange={(timezone) => updateRow(row.key, { timezone })}
          />
          <IconButton label="Remove row" icon={<TrashIcon size={12} />} align="right" onClick={() => removeRow(row.key)} />
        </div>
      ))}
      <div className="row gap-sm">
        <button className="btn secondary small" onClick={addRow}><PlusIcon size={12} />Add another row</button>
        <button className="btn" onClick={submit}><SaveIcon size={12} />Save {rows.length > 1 ? `${rows.length} transactions` : 'transaction'}</button>
      </div>
    </div>
  );
}

/** User-reported (2026-09-11): "CC is stuck in a popup with no edition
 * options for transactions" — this table only ever offered Delete + a
 * read-only detail popup; there was no way to correct a typo'd amount or
 * description without deleting and re-adding the row. Mirrors Bank's own
 * `TransactionsList` inline-edit-row pattern (`BankPage.tsx`). */
function TransactionsTable({ card }: { card: CreditCard }) {
  const transactions = useCreditCardWorkbookStore((s) => s.workbook.transactions);
  const updateTransaction = useCreditCardWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = useCreditCardWorkbookStore((s) => s.deleteTransaction);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const [detail, setDetail] = useState<CreditCardTransaction | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CreditCardTransaction | null>(null);
  const cardTxs = useMemo(
    () => [...transactions].filter((t) => t.cardId === card.id).sort((a, b) => b.date.localeCompare(a.date) || (b.seq ?? 0) - (a.seq ?? 0)),
    [transactions, card.id],
  );

  const startEdit = (t: CreditCardTransaction) => { setEditId(t.id); setEditRow({ ...t }); };
  const saveEdit = () => {
    if (!editRow) return;
    if (!(editRow.amount > 0)) return toast('Enter an amount greater than zero.');
    if (!editRow.description.trim()) return toast('Enter a description.');
    updateTransaction(editRow.id, { ...editRow, description: editRow.description.trim() });
    toast('Transaction updated.');
    setEditId(null);
    setEditRow(null);
  };

  if (!cardTxs.length) return <p className="text-muted m-0">No transactions yet.</p>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th>Amount</th><th></th></tr>
        </thead>
        <tbody>
          {cardTxs.map((t) => (
            editId === t.id && editRow ? (
              <tr key={t.id}>
                <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} className="w-130" /></td>
                <td>
                  <select value={editRow.kind} onChange={(e) => setEditRow({ ...editRow, kind: e.target.value as CreditCardTransactionKind })}>
                    {(Object.keys(KIND_LABELS) as CreditCardTransactionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                  </select>
                </td>
                <td><input value={editRow.description} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} className="w-140" /></td>
                <td><CategorySelect value={editRow.categoryID ?? UNCATEGORIZED_ID} onChange={(categoryID) => setEditRow({ ...editRow, categoryID })} /></td>
                <td><input type="number" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} className="w-90" /></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <IconButton label="Save" icon={<SaveIcon size={12} />} align="right" onClick={saveEdit} />
                  <IconButton label="Cancel" icon={<XIcon size={12} />} align="right" onClick={() => { setEditId(null); setEditRow(null); }} />
                </td>
              </tr>
            ) : (
              <tr key={t.id} className="clickable" onClick={() => setDetail(t)}>
                <td>{t.date}</td>
                {/* A payment reduces debt / a charge (or fee/markup/cash
                   advance) increases it — a real profit/loss-like outcome,
                   not a Buy/Sell trade action, so this stays on the
                   green/red `.pill-positive`/`.pill-negative` convention;
                   see `.pill-buy`/`.pill-sell`'s own doc comment in
                   theme.css for why those two are reserved for an actual
                   trade action now. */}
                <td className={t.kind === 'payment' ? 'pill pill-positive' : 'pill pill-negative'} style={{ display: 'inline-block' }}>{KIND_LABELS[t.kind]}</td>
                <td className="cell-clip" title={t.description}>{t.description}</td>
                <td>{categoryName(t.categoryID, categories)}</td>
                <td>{fmtMoney(t.amount, card.currencyCode)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <IconButton label="Edit" icon={<EditIcon size={12} />} align="right" onClick={() => startEdit(t)} />
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon size={12} />}
                    align="right"
                    onClick={async () => {
                      if (await confirmDialog('This cannot be undone.', 'Delete this transaction?')) deleteTransaction(t.id);
                    }}
                  />
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
      {detail && (
        <RecordDetailModal
          title="Transaction"
          onClose={() => setDetail(null)}
          fields={[
            { label: 'Date', value: detail.date },
            { label: 'Time', value: detail.time },
            { label: 'Timezone', value: detail.timezone },
            { label: 'Type', value: KIND_LABELS[detail.kind] },
            { label: 'Description', value: detail.description },
            { label: 'Category', value: categoryName(detail.categoryID, categories) },
            { label: 'Amount', value: fmtMoney(detail.amount, card.currencyCode) },
            { label: 'Source', value: detail.source },
          ]}
        />
      )}
    </div>
  );
}

/** User-reported (2026-09-11): "CC is stuck in a popup" — Banking's own
 * accounts already moved to a real routed page (`AccountDetailPage`,
 * mirrored exactly here), while a card was still stuck behind a `<Modal>`
 * with no URL of its own, no back-button-friendly history entry, and no
 * dedicated screen real estate. Converted to a routed page at
 * `/bank/card/:id` — every section below (Card details, Current statement,
 * Add transaction, Transactions) is otherwise unchanged from the old
 * Modal-based `CreditCardDetail`.
 *
 * The user's own explicit requirements this whole page satisfies: "user
 * gets his bill calculated and visualized all info of the card and
 * progress bar for limit tracking" + "account linking option... for a
 * seamless experience." Often-tier detail view: read-only attributes +
 * Edit icon, the progress bar, a real statement/bill card (previous
 * balance, this cycle's charges/payments, the statement balance itself,
 * minimum due + due date, with a semi-automated "Approve & log" flow
 * mirroring Rentals' rent collection), the computed markup for this cycle
 * with a "Log markup" action, and the full transaction ledger with a
 * kind-based add-transaction form. */
export function CreditCardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  const card = cards.find((c) => c.id === id);
  const updateCard = useCreditCardWorkbookStore((s) => s.updateCard);
  const deleteCard = useCreditCardWorkbookStore((s) => s.deleteCard);
  const addTransaction = useCreditCardWorkbookStore((s) => s.addTransaction);
  const transactions = useCreditCardWorkbookStore((s) => s.workbook.transactions);
  const ensureSignedIn = useEnsureSignedIn();
  const [editing, setEditing] = useState(false);
  // Every hook below must run unconditionally on every render (rules of
  // hooks) — the "card not found" guard has to come AFTER all of them, so
  // this fallback just keeps the initial render safe for an id that
  // doesn't resolve, same discipline `AccountDetailPage` already follows.
  const [draft, setDraft] = useState<CreditCard>(() => card ?? { id: '', name: '', currencyCode: 'USD' });
  const currencyOptions = useEnabledCurrencies(draft.currencyCode);

  const balance = card ? outstandingBalanceByCard(card, transactions) : 0;
  const statement = card ? currentStatement(card, transactions) : null;
  const markup = statement && card ? markupThisCycle(card, statement) : 0;
  const proposal = statement ? proposeMinPayment(card!, statement) : null;
  // User-reported (2026-09-14): "Previous balance is irrelevant or
  // unexplained... show 6 months past to forecast overviews just like
  // currencies on the main dashboard." A plain CALENDAR-month view
  // (deliberately separate from the card's own billing cycle above —
  // see `creditCardMonthlyHistory`'s own doc comment), matching Net
  // Worth's per-currency monthly window.
  const monthlyHistory = useMemo(() => (card ? creditCardMonthlyHistory(card, transactions, 6) : []), [card, transactions]);
  const thisMonth = monthlyHistory[monthlyHistory.length - 1] ?? { month: '', spent: 0, paid: 0, balanceEnd: 0 };
  const [collectAmount, setCollectAmount] = useState(proposal?.amount ?? 0);
  const [collectDate, setCollectDate] = useState(proposal?.dueDate ?? today());
  const [linkMode, setLinkMode] = useState(false);

  if (!card) {
    return (
      <div>
        <Link to="/bank" className="text-muted">← Back to Banking</Link>
        <p className="text-muted mt-12">Card not found.</p>
      </div>
    );
  }

  const saveDetails = async () => {
    if (!draft.name.trim()) return toast('Enter a card name.');
    if (!(await ensureSignedIn('Sign in to save card details.'))) return;
    updateCard(card.id, { ...draft, name: draft.name.trim() });
    toast('Card details saved.');
    setEditing(false);
  };

  const logMinPayment = async () => {
    if (!proposal) return;
    const ok = await confirmDialog(`Log ${fmtMoney(collectAmount, card.currencyCode)} payment on ${collectDate}?`, 'Approve this payment?');
    if (!ok) return;
    if (!(await ensureSignedIn('Sign in to record this transaction.'))) return;
    addTransaction({ id: uid(), cardId: card.id, date: collectDate, kind: 'payment', amount: collectAmount, description: 'Minimum payment', source: 'manual' });
    const pendingMinDue = nextPendingMinDue(proposal.amount, collectAmount);
    updateCard(card.id, { pendingMinDue });
    toast(pendingMinDue ? `Logged — ${fmtMoney(pendingMinDue, card.currencyCode)} still pending, carried to next cycle.` : 'Logged to the ledger.');
  };

  const logMarkup = async () => {
    if (!(markup > 0) || !statement) return;
    const ok = await confirmDialog(`Log ${fmtMoney(markup, card.currencyCode)} markup for the cycle ending ${statement.cycleEnd}?`, 'Log markup?');
    if (!ok) return;
    if (!(await ensureSignedIn('Sign in to record this transaction.'))) return;
    addTransaction({ id: uid(), cardId: card.id, date: statement.cycleEnd, kind: 'markup', amount: markup, description: 'Markup', source: 'manual' });
    toast('Markup logged.');
  };

  const toggleArchived = async () => {
    if (!(await ensureSignedIn(card.isActive === false ? 'Sign in to reopen this card.' : 'Sign in to close this card.'))) return;
    updateCard(card.id, { isActive: card.isActive === false ? true : false });
    toast(card.isActive === false ? 'Card reopened.' : 'Card closed.');
  };

  const toggleFavorite = async () => {
    if (!(await ensureSignedIn(card.isFavorite ? 'Sign in to unfavorite this card.' : 'Sign in to favorite this card.'))) return;
    updateCard(card.id, { isFavorite: !card.isFavorite });
  };

  const deleteThisCard = async () => {
    if (!(await confirmDialog('This deletes the card and all its transactions — this cannot be undone.', `Delete "${card.name}"?`))) return;
    deleteCard(card.id);
    toast('Card deleted.');
    navigate('/bank');
  };

  return (
    <div>
      <Link to="/bank" className="text-muted">← Back to Banking</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="pagetitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {card.name}
          {card.isActive === false && <span className="pill-warn fs-11">Closed</span>}
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton label={card.isFavorite ? 'Unfavorite' : 'Favorite'} icon={<StarIcon size={13} filled={card.isFavorite} />} align="right" onClick={toggleFavorite} />
          <IconButton label={editing ? 'Cancel' : 'Edit'} icon={<EditIcon size={13} />} align="right" onClick={() => { setDraft(card); setEditing((v) => !v); }} />
          <button className="btn secondary small" onClick={toggleArchived}>
            {card.isActive === false ? <><RestoreIcon size={13} />Reopen card</> : <><ArchiveIcon size={13} />Close card</>}
          </button>
          <button className="btn danger small" onClick={deleteThisCard}>
            <TrashIcon size={13} />Delete card
          </button>
        </div>
      </div>

      {card.creditLimit ? <CreditUsageBar used={Math.max(0, balance)} limit={card.creditLimit} currency={card.currencyCode} /> : null}

      <CollapsibleCard title={<h3 className="m-0">Card details</h3>} className="mb-md">
        {editing ? (
          <div>
            <div className="row gap-sm">
              <Field label="Card name" required><TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="Currency" width={100}>
                <Select value={draft.currencyCode} onChange={(e) => setDraft({ ...draft, currencyCode: e.target.value })}>
                  {currencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
              </Field>
              <Field label="Credit limit"><TextInput type="number" step="0.01" value={draft.creditLimit ?? ''} onChange={(e) => setDraft({ ...draft, creditLimit: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
              <Field label="Network"><TextInput value={draft.cardNetwork ?? ''} onChange={(e) => setDraft({ ...draft, cardNetwork: e.target.value })} placeholder="e.g. Visa" /></Field>
              <Field label="Already owed" title="Debt that existed on this card before its own transaction log started here — see this card's own opening balance.">
                <TextInput type="number" step="0.01" value={draft.openingBalance ?? ''} onChange={(e) => setDraft({ ...draft, openingBalance: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </Field>
            </div>
            <div className="row gap-sm mt-sm">
              <Field label="Cycle start date (day of month)" title="The day of the month your billing cycle closes and a new one starts.">
                <TextInput type="number" min={1} max={31} value={draft.statementDate ?? ''} onChange={(e) => setDraft({ ...draft, statementDate: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </Field>
              <Field label="Min due date (day of month)" title="When the minimum payment is due — a different date from the full amount's due date on a real card.">
                <TextInput type="number" min={1} max={31} value={draft.minDueDate ?? ''} onChange={(e) => setDraft({ ...draft, minDueDate: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </Field>
              <Field label="Full amount due date (day of month)">
                <TextInput type="number" min={1} max={31} value={draft.paymentDueDate ?? ''} onChange={(e) => setDraft({ ...draft, paymentDueDate: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </Field>
              <Field label="Late fee after due"><TextInput type="number" step="0.01" value={draft.lateFeeAfterDue ?? ''} onChange={(e) => setDraft({ ...draft, lateFeeAfterDue: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
              <Field label="Annual fee"><TextInput type="number" step="0.01" value={draft.annualFee ?? ''} onChange={(e) => setDraft({ ...draft, annualFee: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
            </div>
            <div className="row gap-sm mt-sm">
              <Field label="Minimum payment method">
                <Select value={draft.minPaymentMethod ?? 'fixed'} onChange={(e) => setDraft({ ...draft, minPaymentMethod: e.target.value as CreditCard['minPaymentMethod'] })}>
                  <option value="fixed">Fixed amount</option>
                  <option value="percentOfBalance">% of statement balance</option>
                  <option value="greaterOfFixedOrPercent">Whichever is greater</option>
                </Select>
              </Field>
              <Field label="Fixed minimum"><TextInput type="number" step="0.01" value={draft.minPaymentAmount ?? ''} onChange={(e) => setDraft({ ...draft, minPaymentAmount: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
              <Field label="Minimum %"><TextInput type="number" step="0.01" value={draft.minPaymentPct ?? ''} onChange={(e) => setDraft({ ...draft, minPaymentPct: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
            </div>
            <div className="row gap-sm mt-sm">
              <Field label="Markup method" title="How this card computes markup/interest on a carried balance. 'Flat on carried balance' is the only method built so far — a disclosed flat rate applied to whatever survives a real grace period.">
                <Select value={draft.markupMethod ?? ''} onChange={(e) => setDraft({ ...draft, markupMethod: (e.target.value || undefined) as CreditCard['markupMethod'] })}>
                  <option value="">None</option>
                  <option value="flatOnCarried">Flat rate on carried balance</option>
                </Select>
              </Field>
              <Field label="Markup rate %"><TextInput type="number" step="0.01" value={draft.markupRatePct ?? ''} onChange={(e) => setDraft({ ...draft, markupRatePct: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
              <Field label="Markup threshold" title="Below this carried amount, no markup is charged at all.">
                <TextInput type="number" step="0.01" value={draft.markupThresholdAmount ?? ''} onChange={(e) => setDraft({ ...draft, markupThresholdAmount: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </Field>
            </div>
            <button className="btn mt-12" onClick={saveDetails}><SaveIcon size={13} />Save</button>
          </div>
        ) : (
          <AttributeList
            items={[
              { label: 'Currency', value: card.currencyCode },
              { label: 'Outstanding balance', value: fmtMoney(balance, card.currencyCode) },
              { label: 'Already owed (opening balance)', value: card.openingBalance ? fmtMoney(card.openingBalance, card.currencyCode) : undefined },
              { label: 'Credit limit', value: card.creditLimit ? fmtMoney(card.creditLimit, card.currencyCode) : undefined },
              { label: 'Network', value: card.cardNetwork },
              { label: 'BIN', value: card.cardBin },
              { label: 'Cycle start date', value: card.statementDate ? `Day ${card.statementDate}` : undefined },
              { label: 'Min due date', value: card.minDueDate ? `Day ${card.minDueDate}` : undefined },
              { label: 'Full amount due date', value: card.paymentDueDate ? `Day ${card.paymentDueDate}` : undefined },
              { label: 'Late fee after due', value: card.lateFeeAfterDue ? fmtMoney(card.lateFeeAfterDue, card.currencyCode) : undefined },
              { label: 'Annual fee', value: card.annualFee ? fmtMoney(card.annualFee, card.currencyCode) : undefined },
              { label: 'Minimum payment', value: card.minPaymentMethod === 'percentOfBalance' ? `${card.minPaymentPct ?? 0}% of balance` : card.minPaymentMethod === 'greaterOfFixedOrPercent' ? `Greater of ${fmtMoney(card.minPaymentAmount ?? 0, card.currencyCode)} or ${card.minPaymentPct ?? 0}%` : card.minPaymentAmount ? fmtMoney(card.minPaymentAmount, card.currencyCode) : undefined },
              { label: 'Markup', value: card.markupMethod === 'flatOnCarried' ? `${card.markupRatePct ?? 0}% on carried balance ≥ ${fmtMoney(card.markupThresholdAmount ?? 0, card.currencyCode)}` : undefined },
              { label: 'Status', value: card.isActive === false ? 'Closed' : 'Active' },
            ]}
          />
        )}
      </CollapsibleCard>

      {statement && (
        <CollapsibleCard title={<h3 className="m-0">Current statement</h3>} className="mb-md">
          <p className="text-muted" style={{ marginTop: 0, marginBottom: 10 }}>
            Cycle {statement.cycleStart} → {statement.cycleEnd}
          </p>
          <div className="grid-auto" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <div className="stat-card card" style={hueStyle('var(--loss)')}>
              <Tooltip text="Everything added to this card's balance so far this CALENDAR month — same time window every other module in the app reports by.">
                <div className="label clickable">Owed this month</div>
              </Tooltip>
              <MoneyValue n={thisMonth.spent} currency={card.currencyCode} />
              <div className="sub">Paid: {fmtMoney(thisMonth.paid, card.currencyCode)}</div>
            </div>
            <div className="stat-card card" style={hueStyle('var(--loss)')}>
              <Tooltip text="Everything added to this card's balance so far in the current BILLING cycle (not the calendar month) — a purchase, fee, markup, or cash advance.">
                <div className="label clickable">Spent this cycle</div>
              </Tooltip>
              <MoneyValue n={statement.chargesThisCycle} currency={card.currencyCode} />
              <div className="sub">Paid: {fmtMoney(statement.paymentsThisCycle, card.currencyCode)}</div>
            </div>
            <div className="stat-card card" style={hueStyle('var(--accent)')}>
              <div className="label">Min due</div>
              <MoneyValue n={statement.minimumDue} currency={card.currencyCode} />
              <div className="sub">{statement.minDueDate ? `Due: ${statement.minDueDate}` : 'No min-due date set'}</div>
            </div>
            <div className="stat-card card" style={hueStyle(statement.statementBalance > 0 ? 'var(--loss)' : 'var(--profit)')}>
              <Tooltip text="Your bill for this cycle — the full amount due, not just the minimum.">
                <div className="label clickable">Total due</div>
              </Tooltip>
              <MoneyValue n={statement.statementBalance} currency={card.currencyCode} />
              <div className="sub">{statement.dueDate ? `Due: ${statement.dueDate}` : 'No due date set'}</div>
            </div>
            {markup > 0 && (
              <div className="stat-card card" style={hueStyle('var(--loss)')}>
                <Tooltip text="Computed from this card's own markup rate, applied to whatever balance survived the grace period this cycle.">
                  <div className="label clickable">Markup this cycle</div>
                </Tooltip>
                <MoneyValue n={markup} currency={card.currencyCode} />
              </div>
            )}
          </div>
          {markup > 0 && (
            <button className="btn secondary small mt-sm" onClick={logMarkup}>Log markup for this cycle</button>
          )}
          {proposal && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <h4 style={{ margin: '0 0 6px' }}>Minimum payment due{proposal.isDue ? ' (due now)' : ''}</h4>
              <div className="row gap-sm">
                <Field label="Amount"><AmountInput value={collectAmount} onChange={setCollectAmount} /></Field>
                <Field label="Date"><TextInput type="date" value={collectDate} onChange={(e) => setCollectDate(e.target.value)} /></Field>
              </div>
              <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <input type="checkbox" checked={linkMode} onChange={(e) => setLinkMode(e.target.checked)} />
                Link this to a Bank account or Cash (pays it down for real)
              </label>
              {linkMode ? (
                <div className="mt-sm">
                  <LinkedCardPaymentFields card={card} amount={collectAmount} date={collectDate} onLinked={() => { const pendingMinDue = nextPendingMinDue(proposal.amount, collectAmount); updateCard(card.id, { pendingMinDue }); }} />
                </div>
              ) : (
                <button className="btn small mt-sm" onClick={logMinPayment}>Approve &amp; log</button>
              )}
            </div>
          )}
        </CollapsibleCard>
      )}

      <CardBalanceProjection card={card} />
      <CardPlanList card={card} />

      <CollapsibleCard title={<h3 className="m-0">Last 6 months</h3>} defaultOpen={false} className="mb-md">
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Month</th><th>Spent</th><th>Paid</th><th>Balance</th></tr>
            </thead>
            <tbody>
              {monthlyHistory.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{fmtMoney(m.spent, card.currencyCode)}</td>
                  <td>{fmtMoney(m.paid, card.currencyCode)}</td>
                  <td>{fmtMoney(m.balanceEnd, card.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title={<h3 className="m-0">Transactions</h3>}>
        <TransactionsTable card={card} />
      </CollapsibleCard>

      <CreditCardDetailFab card={card} />
    </div>
  );
}

/** User-reported (2026-09-14): "CC UI is definitely violating the UI
 * Rules... No FAB capable of multiple enteries at a time" — this detail
 * page used to have NO FAB at all; "Add a transaction" sat as a
 * permanently-visible card, unlike every other per-entity detail page
 * (`AccountDetailPage`'s `AccountTransfersFab`), which is exactly the
 * "Often tier" pattern this app's Main/Often/Rare model calls for. Gives
 * this page a real 2-action panel: the kind-aware batch add form (charges/
 * fees/markup/cashAdvance — `TransactionEntryModal` can't do these, see
 * its own comment) and "Transfers" (a real linked payment from a Bank/Cash
 * account, distinct from the "Approve & log" minimum-payment flow above,
 * which is about the proposed minimum specifically). */
function CreditCardDetailFab({ card }: { card: CreditCard }) {
  const [open, setOpen] = useState<'add' | 'transfer' | 'plan' | null>(null);
  return (
    <>
      <FabPanel
        actions={[
          { label: 'Add a transaction', icon: <PlusIcon />, onClick: () => setOpen('add') },
          { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
          { label: 'Add a plan', icon: <PlusIcon />, onClick: () => setOpen('plan') },
        ]}
      />
      {open === 'add' && (
        <Modal title="Add a transaction" onClose={() => setOpen(null)}>
          <AddCardTransactionForm card={card} onDone={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'transfer' && (
        <TransactionEntryModal defaultFinance={{ module: 'creditCard', ref: card.id, currencyCode: card.currencyCode }} onClose={() => setOpen(null)} />
      )}
      {open === 'plan' && (
        <Modal title="Add a planned charge or payment" onClose={() => setOpen(null)}>
          <AddCardPlanForm cardId={card.id} onSaved={() => setOpen(null)} />
        </Modal>
      )}
    </>
  );
}

function emptyCardPlan(cardId: string): PlannedCreditCardTransaction {
  return { id: '', cardId, date: today(), description: '', amount: 0, kind: 'charge' };
}

/** Real vs. planned "what's owed" for this ONE card — same idea as Bank's
 * own `BalanceProjectionSummary`, scoped to a single card instead of the
 * whole module, since `PlannedCreditCardTransaction`s are always logged
 * against one specific card, the same way this page itself is already
 * scoped. A HIGHER number is worse here (money owed), the opposite
 * intuition from Bank's own real/planned figures — see
 * `plannedCreditCardProjection`'s own doc comment. */
function CardBalanceProjection({ card }: { card: CreditCard }) {
  const cards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  const transactions = useCreditCardWorkbookStore((s) => s.workbook.transactions);
  const plannedEntries = usePlannedCreditCardWorkbookStore((s) => s.workbook.entries);
  const settings = usePlannedCreditCardWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePlannedCreditCardWorkbookStore((s) => s.updateSettings);
  const projection = useMemo(
    () => plannedCreditCardProjection(cards, transactions, plannedEntries),
    [cards, transactions, plannedEntries],
  );
  const p = projection[card.currencyCode] ?? { real: 0, planned: 0 };

  return (
    <CollapsibleCard
      title={
        <Tooltip text="See what you'd owe on this card if every plan below actually happened — a reality check before you spend.">
          <h3 style={{ margin: 0, cursor: 'pointer' }}>Balance projection</h3>
        </Tooltip>
      }
      defaultOpen={false}
      className="mb-md"
    >
      <div className="row" style={{ gap: 16, marginBottom: 12 }}>
        <label className="text-muted flex-center-gap4">
          <input type="checkbox" checked={settings.showRealBalance} onChange={(e) => updateSettings({ showRealBalance: e.target.checked })} />
          Real owed
        </label>
        <label className="text-muted flex-center-gap4">
          <input type="checkbox" checked={settings.showPlannedBalance} onChange={(e) => updateSettings({ showPlannedBalance: e.target.checked })} />
          Planned owed
        </label>
      </div>
      <div className="grid-auto" style={gridAutoStyle(180, 8)}>
        <div className="stat-card card">
          <div className="label">{card.currencyCode}</div>
          {settings.showRealBalance && (
            <div className={p.real <= 0 ? 'pill-positive' : 'pill-negative'}>Real: {fmtMoney(p.real, card.currencyCode)}</div>
          )}
          {settings.showPlannedBalance && (
            <div className={p.planned <= 0 ? 'pill-positive' : 'pill-negative'}>Planned: {fmtMoney(p.planned, card.currencyCode)}</div>
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
}

function AddCardPlanForm({ cardId, onSaved }: { cardId: string; onSaved?: () => void }) {
  const addPlan = usePlannedCreditCardWorkbookStore((s) => s.addEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [p, setP] = useState<PlannedCreditCardTransaction>(() => emptyCardPlan(cardId));

  const submit = async () => {
    if (!p.amount || !p.description.trim()) return toast('Enter a description and a non-zero amount.');
    if (!(await ensureSignedIn('Sign in to save plans.'))) return;
    addPlan({ ...p, id: crypto.randomUUID(), cardId, description: p.description.trim() });
    toast('Plan added.');
    setP(emptyCardPlan(cardId));
    onSaved?.();
  };

  return (
    <div>
      <div className="row gap-sm">
        <Field label="Type" width={190}>
          <Select value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as CreditCardTransactionKind })}>
            {(Object.keys(KIND_LABELS) as CreditCardTransactionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </Select>
        </Field>
        <Field label="Expected date">
          <TextInput
            type="date"
            value={p.date}
            onChange={(e) => setP({ ...p, date: e.target.value, recurrence: p.recurrence ? { ...p.recurrence, startDate: e.target.value } : undefined })}
          />
        </Field>
        <Field label="Description" width={180}>
          <TextInput value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} placeholder="e.g. Subscription renewal" />
        </Field>
        <Field label="Amount" width={110}>
          <AmountInput value={p.amount} onChange={(amount) => setP({ ...p, amount })} />
        </Field>
        <RecurrenceFields startDate={p.date} value={p.recurrence} onChange={(recurrence) => setP({ ...p, recurrence })} />
      </div>
      <button className="btn mt-12" onClick={submit}>
        <PlusIcon />Add plan
      </button>
    </div>
  );
}

function CardPlanList({ card }: { card: CreditCard }) {
  const allPlans = usePlannedCreditCardWorkbookStore((s) => s.workbook.entries);
  const updatePlan = usePlannedCreditCardWorkbookStore((s) => s.updateEntry);
  const deletePlan = usePlannedCreditCardWorkbookStore((s) => s.deleteEntry);
  const addTransaction = useCreditCardWorkbookStore((s) => s.addTransaction);
  const ensureSignedIn = useEnsureSignedIn();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PlannedCreditCardTransaction | null>(null);

  const plans = useMemo(() => allPlans.filter((p) => p.cardId === card.id), [allPlans, card.id]);
  const sorted = useMemo(() => [...plans].sort((a, b) => a.date.localeCompare(b.date)), [plans]);

  const startEdit = (p: PlannedCreditCardTransaction) => { setEditId(p.id); setEditRow({ ...p }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updatePlan(editId, editRow);
    toast('Plan updated.');
    setEditId(null);
    setEditRow(null);
  };

  const markDone = async (p: PlannedCreditCardTransaction) => {
    const occurrenceDate = p.recurrence ? nextRecurrenceOccurrence(p.recurrence)?.toISOString().slice(0, 10) : p.date;
    if (!occurrenceDate) return toast('This plan has no more occurrences left (past its end date).');
    if (!(await ensureSignedIn('Sign in to save credit card transactions.'))) return;
    addTransaction({
      id: crypto.randomUUID(), cardId: p.cardId, date: occurrenceDate, kind: p.kind,
      description: p.description, amount: p.amount, source: 'manual',
    });
    if (p.recurrence) {
      updatePlan(p.id, { executedThrough: occurrenceDate });
      toast(`Marked ${occurrenceDate} as done — added to this card's transactions. This plan keeps recurring.`);
    } else {
      updatePlan(p.id, { executed: true });
      toast('Marked as done — added to this card\'s transactions.');
    }
  };

  return (
    <CollapsibleCard title={<h3 className="m-0">Planned charges &amp; payments</h3>} defaultOpen={false} className="mb-md">
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Repeats / status</th><th></th></tr>
          </thead>
          <tbody>
            {sorted.map((p) =>
              editId === p.id && editRow ? (
                <tr key={p.id}>
                  <td>
                    <input
                      type="date"
                      value={editRow.date}
                      onChange={(e) => setEditRow({ ...editRow, date: e.target.value, recurrence: editRow.recurrence ? { ...editRow.recurrence, startDate: e.target.value } : undefined })}
                      className="w-130"
                    />
                  </td>
                  <td>
                    <select value={editRow.kind} onChange={(e) => setEditRow({ ...editRow, kind: e.target.value as CreditCardTransactionKind })}>
                      {(Object.keys(KIND_LABELS) as CreditCardTransactionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                    </select>
                  </td>
                  <td><input value={editRow.description} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} className="w-140" /></td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} className="w-100" /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <RecurrenceFields
                        startDate={editRow.date}
                        value={editRow.recurrence}
                        onChange={(recurrence) => setEditRow({ ...editRow, recurrence })}
                      />
                    </div>
                  </td>
                  <td>
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td className={p.kind === 'payment' ? 'pill pill-positive' : 'pill pill-negative'} style={{ display: 'inline-block' }}>{KIND_LABELS[p.kind]}</td>
                  <td className="cell-clip" title={p.description}>{p.description}</td>
                  <td>{fmtMoney(p.amount, card.currencyCode)}</td>
                  <td className="text-muted">{p.recurrence ? recurrenceLabel(p.recurrence) : p.executed ? 'Done' : 'Planned'}</td>
                  <td>
                    {(p.recurrence || !p.executed) && (
                      <button className="btn secondary small" onClick={() => markDone(p)}>Mark as done</button>
                    )}{' '}
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(p)} />{' '}
                    <IconButton
                      label="Delete"
                      icon={<TrashIcon size={13} />}
                      align="right"
                      onClick={async () => {
                        if (await confirmDialog('This cannot be undone.', 'Delete this plan?')) deletePlan(p.id);
                      }}
                    />
                  </td>
                </tr>
              ),
            )}
            {!sorted.length && <tr><td colSpan={6} className="text-muted">No planned charges or payments for this card yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

/** Landing FAB — "Add a card" + the app-wide "Transfers" action, same
 * 2-action shape every other module's landing page already uses. */
/** 2026-09-11: registers via the keyed `usePageFabActions` instead of
 * rendering its own `FabPanel` — see `BankPage.tsx`'s `AccountsFab` for the
 * real FAB-stacking bug this fixes (`Tabs.tsx`'s own design lets Banking's
 * Accounts/Credit Cards/Planning tabs all be open, hence all mounted, at
 * once). `BankPage` itself renders the one merged panel for the page. */
function CreditCardsFab() {
  const [open, setOpen] = useState<'card' | 'transfer' | null>(null);
  const actions = useMemo(
    () => [
      { label: 'Add a card', icon: <PlusIcon />, onClick: () => setOpen('card') },
      { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
    ],
    [],
  );
  usePageFabActions('bank-creditcards', actions);
  return (
    <>
      {open === 'card' && (
        <Modal title="Add a credit card" onClose={() => setOpen(null)}>
          <AddCreditCardForm onSaved={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'transfer' && <TransactionEntryModal defaultFinance={{ module: 'creditCard' }} onClose={() => setOpen(null)} />}
    </>
  );
}

function CreditCardsList() {
  const navigate = useNavigate();
  const allCards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  const transactions = useCreditCardWorkbookStore((s) => s.workbook.transactions);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(() => allCards.filter((c) => c.isActive === false).length, [allCards]);
  const cards = useMemo(() => (showArchived ? allCards : allCards.filter((c) => c.isActive !== false)), [allCards, showArchived]);
  const srNumOf = useMemo(() => new Map(allCards.map((c, i) => [c.id, i + 1])), [allCards]);
  const sorted = useMemo(() => [...cards].sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite)), [cards]);

  return (
    <div>
      {archivedCount > 0 && (
        <button className="btn secondary small mb-sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hide' : 'Show'} closed ({archivedCount})
        </button>
      )}
      {!sorted.length ? (
        <p className="text-muted">
          {allCards.length ? 'Every card is closed — click "Show closed" above to see them.' : 'No credit cards yet — add one with the + button.'}
        </p>
      ) : (
        <div className="entity-card-grid">
          {sorted.map((c) => {
            const balance = Math.max(0, outstandingBalanceByCard(c, transactions));
            return (
              <EntityCard
                key={c.id}
                title={<><span className="text-muted entity-card-sr">#{srNumOf.get(c.id)}</span>{c.name}</>}
                subtitle={<>{c.currencyCode}{c.cardNetwork ? ` · ${c.cardNetwork}` : ''}{c.creditLimit ? ` · Limit ${fmtMoney(c.creditLimit, c.currencyCode)}` : ''}</>}
                badge={c.isActive === false ? <span className="pill-warn fs-10">Closed</span> : undefined}
                statLabel="Owed"
                stat={<MoneyValue n={balance} currency={c.currencyCode} />}
                hue={balance > 0 ? 'var(--loss)' : 'var(--profit)'}
                onClick={() => navigate(`/bank/card/${c.id}`)}
                actions={<IconButton label="Open" icon={<EditIcon size={13} />} align="right" onClick={() => navigate(`/bank/card/${c.id}`)} />}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Mounted as a "Credit Cards" tab on Banking's own page (CLAUDE.md's
 * placement recommendation: still squarely the "banking" domain even
 * though a card is a structurally distinct entity from a checking/
 * savings `BankAccount`). */
export function CreditCardsTab({
  plannedCreditCardCloudEmpty,
  uploadPlannedCreditCardLocalToCloud,
}: {
  plannedCreditCardCloudEmpty: boolean;
  uploadPlannedCreditCardLocalToCloud: () => Promise<void>;
}) {
  return (
    <div>
      <RepairStaleMigrations />
      <MigrateLegacyCreditCards />
      <CreditCardsList />
      <CardPlanningCloudNotice cloudEmpty={plannedCreditCardCloudEmpty} uploadLocalToCloud={uploadPlannedCreditCardLocalToCloud} />
      <CreditCardsFab />
    </div>
  );
}

/** Same "renders nothing unless the cloud genuinely looks empty" pattern as
 * Bank's own `PlanningAccountSection` — see that component's doc comment.
 * Lives here (not per-card on `CreditCardDetailPage`) since it's about the
 * WHOLE `plannedCreditCard` store, not any one card — same reasoning as why
 * `AccountDetailPage`/`CreditCardDetailPage` themselves have no such
 * section of their own either. */
function CardPlanningCloudNotice({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const plans = usePlannedCreditCardWorkbookStore((s) => s.workbook.entries);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <Notice tone="warning" className="mt-md">
      <p className="mt-0">No data found in the cloud for planned credit card charges. This won't upload automatically.</p>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={async () => {
          const ok = await confirmDialog(
            'This will overwrite anything currently in the cloud for planned credit card charges (there is nothing there now, but confirming since this can\'t be undone).',
            `Upload ${plans.length} local plan${plans.length === 1 ? '' : 's'} to the cloud?`,
          );
          if (!ok) return;
          setBusy(true);
          try {
            await uploadLocalToCloud();
            toast('Uploaded to the cloud.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Upload {plans.length} local plan{plans.length === 1 ? '' : 's'} to the cloud
      </button>
    </Notice>
  );
}

/** Real bug, user-reported (2026-09-13, with a real attached backup):
 * "converted GCC and PCC from Bank to CC upon clicking app alert but it
 * created wrong figures." Root cause traced against that backup: this
 * user's GCC card was migrated by an OLDER version of `migrate()` below —
 * from BEFORE `openingBalance` carryover existed on `CreditCard` at all
 * (README Done item 312) and, going further back, from before this
 * function even set `isActive: false` on the source account — so the
 * resulting `CreditCard` record is permanently missing its
 * `openingBalance` (making its balance read as if ~7,553 QAR of real,
 * pre-tracked debt simply doesn't exist — the exact wrong-figure report),
 * and the old `BankAccount` it came from is STILL `isActive: true`,
 * so it keeps showing up as its own separate, fully-editable, clickable
 * account (Banking's own homepage list, its Bank's linked-accounts list,
 * and a direct `/bank/account/:id` link) — a confusing duplicate of the
 * same real card, exactly what the user's second screenshot showed.
 *
 * This is a real, permanent gap that could recur for ANY future migration
 * fix, not a one-off patch for this one user — so it's a general repair
 * pass, not a hand-typed correction. It only ever fills in what a FRESH
 * migration (see `migrate()` below) would already have set, and only
 * when that value is still genuinely missing — it can never clobber a
 * value the user has since entered by hand, and running it twice is a
 * safe no-op. */
function RepairStaleMigrations() {
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const updateBankAccount = useBankWorkbookStore((s) => s.updateAccount);
  const cards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  const updateCard = useCreditCardWorkbookStore((s) => s.updateCard);
  const ensureSignedIn = useEnsureSignedIn();

  const stale = bankAccounts
    .filter((a) => a.migratedToCreditCardId)
    .map((a) => ({ account: a, card: cards.find((c) => c.id === a.migratedToCreditCardId) }))
    .filter(
      ({ account, card }) =>
        card &&
        ((account.isActive !== false) || (card.openingBalance === undefined && account.openingBalance)),
    );
  if (!stale.length) return null;

  const repair = async () => {
    if (!(await ensureSignedIn('Sign in to repair these migrated cards.'))) return;
    stale.forEach(({ account, card }) => {
      if (!card) return;
      if (card.openingBalance === undefined && account.openingBalance) {
        updateCard(card.id, { openingBalance: -account.openingBalance });
      }
      if (account.isActive !== false) {
        updateBankAccount(account.id, { isActive: false });
      }
    });
    toast(`Repaired ${stale.length} migrated card${stale.length > 1 ? 's' : ''}.`);
  };

  return (
    <Notice tone="warning" className="mb-md">
      <p style={{ margin: '0 0 8px' }}>
        {stale.length} credit card{stale.length > 1 ? 's were' : ' was'} migrated from a Bank account before a data
        fix landed — {stale.length > 1 ? 'their' : 'its'} real opening balance may be missing and the original
        account is still showing up as its own separate entry. One click backfills the opening balance from the
        original account (never overwriting anything you've already entered) and closes the old duplicate:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {stale.map(({ account }) => (
          <span key={account.id} className="pill">{account.name}</span>
        ))}
      </div>
      <button className="btn secondary small mt-sm" onClick={repair}>Repair now</button>
    </Notice>
  );
}

/** One-time, EXPLICIT, user-confirmed migration off the rejected
 * `isLiability`-on-`BankAccount` model. Never runs automatically — lists
 * exactly what it found and what it will do before the user confirms,
 * per this project's own locked "ask before touching real financial data
 * structure" rule. */
function MigrateLegacyCreditCards() {
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const bankTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateBankAccount = useBankWorkbookStore((s) => s.updateAccount);
  const addCard = useCreditCardWorkbookStore((s) => s.addCard);
  const ensureSignedIn = useEnsureSignedIn();
  const legacy = bankAccounts.filter((a) => a.isLiability && !a.migratedToCreditCardId);
  if (!legacy.length) return null;

  const migrate = async (account: BankAccount) => {
    const ok = await confirmDialog(
      `Converts "${account.name}" into a real Credit Card record, moving all its transactions with it. The original account is closed (never deleted) and stops counting toward Banking's own totals once converted.`,
      `Migrate "${account.name}" to a Credit Card?`,
    );
    if (!ok) return;
    if (!(await ensureSignedIn('Sign in to migrate this account.'))) return;
    const cardId = uid();
    addCard({
      id: cardId,
      name: account.name,
      bankId: account.bankId,
      currencyCode: account.currencyCode,
      // Real bug, user-reported (2026-09-11): debt that predated this
      // account's own logged transactions (`BankAccount.openingBalance`,
      // negative = owed) was silently dropped here — `CreditCard` had no
      // equivalent field at all. Its convention is the OPPOSITE sign
      // (positive = owed, see `CreditCard.openingBalance`'s own doc
      // comment), so this negates it.
      openingBalance: account.openingBalance ? -account.openingBalance : undefined,
      creditLimit: account.creditLimit,
      statementDate: account.statementDate,
      paymentDueDate: account.paymentDueDate,
      minPaymentMethod: 'fixed',
      minPaymentAmount: account.minPaymentAmount,
      lateFeeAfterDue: account.lateFeeAfterDue,
      annualFee: account.annualFee,
      cardNetwork: account.cardNetwork,
      cardBin: account.cardBin,
      isActive: account.isActive,
      isFavorite: account.isFavorite,
      includeInNetWorth: account.includeInNetWorth,
    });
    const accountTxs = bankTransactions.filter((t) => t.accountId === account.id);
    addCreditCardTransactions(
      accountTxs.map((t) => ({
        id: uid(),
        cardId,
        date: t.date,
        time: t.time,
        timezone: t.timezone,
        kind: t.amount >= 0 ? 'payment' : 'charge',
        amount: Math.abs(t.amount),
        description: t.description,
        categoryID: t.categoryID,
        source: t.source,
        statementRef: t.statementRef,
      })),
    );
    updateBankAccount(account.id, { isActive: false, migratedToCreditCardId: cardId });
    toast(`"${account.name}" migrated to a real Credit Card record.`);
  };

  return (
    <Notice tone="warning" className="mb-md">
      <p style={{ margin: '0 0 8px' }}>
        {legacy.length} bank account{legacy.length > 1 ? 's' : ''} still on the old "liability account" model — a credit card really
        works differently from a bank account (a billing cycle, a minimum due, real markup). Migrate {legacy.length > 1 ? 'each' : 'it'} into a real Credit Card record below.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {legacy.map((a) => (
          <button key={a.id} className="btn secondary small" onClick={() => migrate(a)}>Migrate "{a.name}"</button>
        ))}
      </div>
    </Notice>
  );
}
