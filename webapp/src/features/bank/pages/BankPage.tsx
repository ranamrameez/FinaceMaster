import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, EntityCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { ChartCard } from '../../qse/components/ChartCard';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { ArchiveIcon, CheckIcon, EditIcon, ExportIcon, ListIcon, PlusIcon, RestoreIcon, SaveIcon, StarIcon, TransferIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { PendingToggle } from '../../../components/ui/PendingToggle';
import { DirectionChips } from '../../../components/ui/DirectionChips';
import { IconButton } from '../../../components/ui/IconButton';
import { AttributeList } from '../../../components/ui/AttributeList';
import { FabButton, FabPanel } from '../../../components/ui/Fab';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { CategorySelect } from '../../../components/CategorySelect';
import { FinanceEditModal } from '../../../components/FinanceEditModal';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { useAmountFormat } from '../../../hooks/useAmountFormat';
import { useEnabledCurrencies } from '../../../hooks/useEnabledCurrencies';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { ReorderButtons } from '../../../components/ui/ReorderButtons';
import { RecurrenceFields } from '../../../components/ui/RecurrenceFields';
import { nextRecurrenceOccurrence } from '../../../lib/calc/recurrence';
import { recurrenceLabel } from '../../../lib/recurrenceLabel';
import { hueStyle } from '../../../lib/statCardHues';
import { categoryName, UNCATEGORIZED_ID } from '../../../lib/categories';
import { useCategoryStore } from '../../../store/categoryStore';
import { accountBalance, accountBalanceAsOfMonth, accountByCategory, accountPendingBalance, accountRunningLedger, bankMonthlyFlow, bankTotalsByCurrency, budgetVsActual, totalBalanceByCurrency } from '../../../lib/calc/bankModule';
import { monthRange } from '../../../lib/calc/budgetPlanner';
import { plannedBankProjection } from '../../../lib/calc/plannedBalance';
import { dlBarV, dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { parseCSV, toCSV } from '../../../lib/csv';
import { fmtMoney } from '../../../lib/format';
import { dateOnlyMs } from '../../../lib/datetime';
import { confirmAndDeleteLinkable, warnIfLinked } from '../../../lib/linkCascade';
import { isValidIbanFormat, lookupIban } from '../../../lib/ibanLookup';
import { isValidBin, lookupBin } from '../../../lib/binLookup';
import { banksForCurrency } from '../../../lib/bankDirectory';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { createEmptyBankWorkbook } from '../../../store/defaultBankWorkbook';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath, useLinkSideLabel } from '../../transfers/pages/TransferLinksPage';
import type { BankAccount, BankTransaction, BankWorkbook } from '../../../types/bankWorkbook';
import type { PlannedBankTransaction } from '../../../types/plannedBank';
import { gridAutoStyle } from '../../../lib/gridStyle';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

function emptyAccount(defaultCurrency: string, bankId?: string): Omit<BankAccount, 'id'> {
  return { name: '', currencyCode: defaultCurrency, openingBalance: 0, bankId };
}

const ACCOUNT_TYPES = ['Savings', 'Current', 'Checking', 'Salary', 'Business', 'Fixed deposit'];

const CARD_NETWORKS = ['Visa', 'Mastercard', 'American Express', 'UnionPay', 'Discover', 'JCB'];

interface CreditCardValue {
  isLiability?: boolean;
  creditLimit?: number;
  annualFee?: number;
  statementDate?: number;
  paymentDueDate?: number;
  lateFeeAfterDue?: number;
  minPaymentAmount?: number;
  cardNetwork?: string;
  cardBin?: string;
}

/** User-requested (2026-08-26): credit card tracking as a liability
 * account — "Is this a credit card?" reveals card-specific fields (all
 * optional beyond the toggle itself). `cardBin` (first 6-8 digits only,
 * never a full card number — see `lib/binLookup.ts`) optionally
 * auto-fills the network via a free public lookup; the network field
 * stays a normal free-editable input either way. */
function CreditCardFields({ value, onChange, datalistId }: { value: CreditCardValue; onChange: (patch: Partial<CreditCardValue>) => void; datalistId: string }) {
  const [detecting, setDetecting] = useState(false);

  const detectNetwork = async () => {
    const bin = (value.cardBin ?? '').trim();
    if (!bin) return toast('Enter the first 6-8 digits of the card first.');
    if (!isValidBin(bin)) return toast('That should be 6-8 digits — never the full card number.');
    setDetecting(true);
    try {
      const result = await lookupBin(bin);
      if (!result) {
        toast('Card network not detected — pick it manually below.');
        return;
      }
      onChange({ cardNetwork: result.network ? result.network[0].toUpperCase() + result.network.slice(1) : value.cardNetwork });
      toast(`Detected: ${result.network ?? 'unknown network'}${result.bankName ? ` (${result.bankName})` : ''}.`);
    } catch {
      toast('Card network not detected — pick it manually below.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={!!value.isLiability} onChange={(e) => onChange({ isLiability: e.target.checked })} />
        This is a credit card (counts as a debt in Net Worth, not a balance)
      </label>
      {value.isLiability && (
        <div style={{ marginTop: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Field label="Credit limit (optional)" width={140}>
              <TextInput type="number" step="0.01" value={value.creditLimit ?? ''} onChange={(e) => onChange({ creditLimit: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Annual fee (optional)" width={130}>
              <TextInput type="number" step="0.01" value={value.annualFee ?? ''} onChange={(e) => onChange({ annualFee: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Statement day of month (optional)" width={110}>
              <TextInput type="number" min={1} max={31} value={value.statementDate ?? ''} onChange={(e) => onChange({ statementDate: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Payment due day of month (optional)" width={110}>
              <TextInput type="number" min={1} max={31} value={value.paymentDueDate ?? ''} onChange={(e) => onChange({ paymentDueDate: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <Field label="Late fee after due date (optional)" width={150}>
              <TextInput type="number" step="0.01" value={value.lateFeeAfterDue ?? ''} onChange={(e) => onChange({ lateFeeAfterDue: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Minimum amount due (optional)" width={150}>
              <TextInput type="number" step="0.01" value={value.minPaymentAmount ?? ''} onChange={(e) => onChange({ minPaymentAmount: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Card network (optional)" width={140}>
              <TextInput list={datalistId} value={value.cardNetwork ?? ''} onChange={(e) => onChange({ cardNetwork: e.target.value || undefined })} placeholder="e.g. Visa" />
            </Field>
            <Field label="First 6-8 digits (optional)" width={140} title="Never the full card number — just enough to detect the network/issuer.">
              <TextInput value={value.cardBin ?? ''} onChange={(e) => onChange({ cardBin: e.target.value || undefined })} placeholder="e.g. 411111" />
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
              <button type="button" className="btn secondary small" disabled={detecting} onClick={detectNetwork}>
                {detecting ? 'Detecting…' : 'Detect network'}
              </button>
            </div>
          </div>
          <datalist id={datalistId}>
            {CARD_NETWORKS.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
      )}
    </div>
  );
}

/* ============================== Accounts ============================== */

function TotalBalances() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const plannedEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const { num } = useAmountFormat();
  const totals = totalBalanceByCurrency(accounts, transactions);
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  // Not-yet-executed plans, per currency — surfaced here (not just inside
  // the Planning tab) so "how much is still hanging over my balance" is
  // visible at a glance without a click, per a user report that stats
  // didn't show upcoming/in-process planned payments at all.
  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currencyCode]));
  const upcoming = plannedEntries.filter((p) => !p.executed);

  return (
    <div className="grid-auto" style={{ ...gridAutoStyle(150, 8), marginBottom: 16 }}>
      {codes.map((code) => {
        const pending = upcoming.filter((p) => currencyByAccount.get(p.accountId) === code);
        const net = pending.reduce((s, p) => s + p.amount, 0);
        return (
          <div key={code} className="stat-card card" style={hueStyle(totals[code] >= 0 ? 'var(--profit)' : 'var(--loss)')}>
            <Tooltip text={`Sum of your bank accounts that use ${code} — no live currency conversion, just accounts that happen to share this currency.`}>
              <div className="label" style={{ cursor: 'pointer' }}>Accounts in {code}</div>
            </Tooltip>
            <MoneyValue n={totals[code]} currency={code} />
            {pending.length > 0 && (
              <div className="sub">
                {pending.length} upcoming plan{pending.length > 1 ? 's' : ''} (net {net >= 0 ? '+' : ''}
                {num(net)} {code})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface IbanLookupValue {
  iban?: string;
  bic?: string;
}

/** User-requested (2026-08-26): look up a bank's BIC from its IBAN instead
 * of typing it by hand. See `lib/ibanLookup.ts` for the provider-chain
 * design and why only one live provider is wired in today. Both fields
 * stay freely hand-editable regardless of whether lookup succeeds — an
 * account may have no IBAN at all (common for PKR/QAR accounts), or the
 * lookup may simply fail, and that shouldn't block anything else.
 *
 * User-reported (2026-09-09): "Bank (optional) is a duplicate of the Bank
 * name (optional) field" — this used to also fill/own a free-text "Bank
 * name" input, which duplicated the real `Bank`-entity picker
 * (`BankIdentityField`, below) on the very same form: an account could end
 * up with a `bankId` pointing at one Bank record AND a `bankName` string
 * naming the same institution a second, disconnected way. Fixed by having
 * a successful lookup hand its found name to `onBankNameFound` instead of
 * writing a field of its own — `BankIdentityField` resolves that into (or
 * reuses) a real `Bank` entity, so there's exactly one place an account's
 * bank identity lives. */
function IbanLookupFields({ value, onChange, onBankNameFound }: { value: IbanLookupValue; onChange: (patch: Partial<IbanLookupValue>) => void; onBankNameFound: (name: string) => void }) {
  const [looking, setLooking] = useState(false);

  const doLookup = async () => {
    const iban = (value.iban ?? '').trim();
    if (!iban) return toast('Enter an IBAN first.');
    if (!isValidIbanFormat(iban)) {
      toast("That doesn't look like a valid IBAN (checksum failed) — check for typos, or enter the bank name manually below.");
      return;
    }
    setLooking(true);
    try {
      const result = await lookupIban(iban);
      if (!result) {
        toast("IBAN not supported by the app (or the lookup service is unavailable right now) — enter the bank name manually below.");
        return;
      }
      if (result.bankName) onBankNameFound(result.bankName);
      onChange({ bic: result.bic ?? value.bic });
      toast(`Found: ${result.bankName ?? result.bic ?? 'bank details'}.`);
    } catch {
      toast("IBAN not supported by the app (or the lookup service is unavailable right now) — enter the bank name manually below.");
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      <Field label="IBAN (optional)" width={220} title="International Bank Account Number, if your bank issues one — used only to look up the bank name/BIC below; not every country or account has one.">
        <TextInput value={value.iban ?? ''} onChange={(e) => onChange({ iban: e.target.value || undefined })} placeholder="e.g. PK36SCBL0000001123456702" />
      </Field>
      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
        <button type="button" className="btn secondary small" disabled={looking} onClick={doLookup}>
          {looking ? 'Looking up…' : 'Look up bank'}
        </button>
      </div>
      <Field label="BIC / SWIFT (optional)" width={140}>
        <TextInput value={value.bic ?? ''} onChange={(e) => onChange({ bic: e.target.value || undefined })} placeholder="e.g. SCBLPKKX" />
      </Field>
    </div>
  );
}

/** The ONE place an account's bank identity lives — replaces what used to
 * be two disconnected controls (a `Bank`-entity `<Select>`, only shown once
 * at least one Bank existed, and a free-text "Bank name" field IBAN lookup
 * also wrote to). A single type-to-search field: typing an EXISTING bank's
 * name (case-insensitively) links to that real `Bank` entity; typing a new
 * name creates one on blur — "still able to add new Bank in this easy
 * way," per the user's own wording — rather than a fixed enum. Suggestions
 * are the user's own existing banks plus `bankDirectory.ts`'s prefilled
 * Pakistani/Qatari banks FILTERED BY THE ACCOUNT'S OWN CURRENCY ("list
 * banks by currency"). Deliberately not a live bank-lookup API call (the
 * user's own suggested implementation) — this app's locked design
 * decision is no live third-party API calls from a page load/user action;
 * the bundled directory plus the user's own already-created Bank entities
 * serves the same "don't make the user type it from scratch" goal without
 * one. `bankName` (the old free-text field) is kept ONLY as a read fallback
 * for accounts that predate this — for anything typed here going forward,
 * `bankId` is authoritative and `bankName` is cleared. */
function BankIdentityField({ value, onChange, idSuffix }: { value: Pick<BankAccount, 'bankId' | 'bankName' | 'currencyCode'>; onChange: (patch: Partial<BankAccount>) => void; idSuffix: string }) {
  const banks = useBankWorkbookStore((s) => s.workbook.settings.banks ?? []);
  const addBank = useBankWorkbookStore((s) => s.addBank);
  const ensureSignedIn = useEnsureSignedIn();
  const visibleBanks = useMemo(() => banks.filter((b) => b.isActive !== false), [banks]);
  const currentName = useMemo(() => {
    if (value.bankId) return visibleBanks.find((b) => b.id === value.bankId)?.name ?? '';
    return value.bankName ?? '';
  }, [value.bankId, value.bankName, visibleBanks]);
  const [draft, setDraft] = useState(currentName);
  const [dirty, setDirty] = useState(false);
  if (!dirty && draft !== currentName) setDraft(currentName);

  const resolve = async () => {
    const name = draft.trim();
    setDirty(false);
    if (!name) { onChange({ bankId: undefined, bankName: undefined }); return; }
    const existing = visibleBanks.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (existing) { onChange({ bankId: existing.id, bankName: undefined }); return; }
    if (!(await ensureSignedIn('Sign in to add a new bank.'))) { setDraft(currentName); return; }
    const id = uid();
    addBank({ id, name });
    onChange({ bankId: id, bankName: undefined });
  };

  const suggestions = useMemo(() => {
    const existingNames = visibleBanks.map((b) => b.name);
    return [...new Set([...existingNames, ...banksForCurrency(value.currencyCode)])];
  }, [value.currencyCode, visibleBanks]);
  const datalistId = `bank-identity-datalist-${idSuffix}`;

  return (
    <Field label="Bank (optional)" width={220} title="Type to search your own banks or common Pakistani/Qatari banks/wallets. Typing a new name adds it as a real Bank entity so you can later see a combined total for everything at that bank.">
      <TextInput
        list={datalistId}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
        onBlur={resolve}
        placeholder="e.g. UBL"
      />
      <datalist id={datalistId}>
        {suggestions.map((n) => <option key={n} value={n} />)}
      </datalist>
    </Field>
  );
}

/** README item 81 (2026-08-26 feedback): adding an account is a rare
 * operation, so it shouldn't permanently occupy the top of the page — same
 * round-FAB + popup pattern already used for EMI's "Add a loan" (Done item
 * 166). */
/** User-requested (2026-08-28): a single app-wide "Transfers" FAB, fanning
 * out alongside each module's own entity-add FAB from one expandable panel
 * (`FabPanel`) instead of each page showing its own single always-visible
 * button. Bank's "Add an account" action stays exactly as it was — only
 * the wrapper changed. */
function AccountsFab() {
  const [open, setOpen] = useState<'account' | 'transfer' | 'bank' | null>(null);
  const addBank = useBankWorkbookStore((s) => s.addBank);
  const ensureSignedIn = useEnsureSignedIn();
  const [bankName, setBankName] = useState('');
  const submitBank = async () => {
    if (!bankName.trim()) return toast('Enter a bank name.');
    if (!(await ensureSignedIn('Sign in to save a bank.'))) return;
    addBank({ id: uid(), name: bankName.trim() });
    toast('Bank added.');
    setBankName('');
    setOpen(null);
  };
  return (
    <>
      <FabPanel
        actions={[
          { label: 'Add an account', icon: <PlusIcon />, onClick: () => setOpen('account') },
          { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
          // Pending item 115(a): grouped here rather than a second floating
          // button, so it can't stack/overlap with this panel (same class
          // of bug already fixed once for the app-wide Transfers FAB —
          // see Done item 239).
          { label: 'Add a bank', icon: <PlusIcon />, onClick: () => setOpen('bank') },
        ]}
      />
      {open === 'account' && (
        <Modal title="Add an account" onClose={() => setOpen(null)}>
          <AddAccountForm onSaved={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'transfer' && <TransactionEntryModal onClose={() => setOpen(null)} />}
      {open === 'bank' && (
        <Modal title="Add a bank" onClose={() => setOpen(null)}>
          <Field label="Bank name" width={220} required>
            <TextInput value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. UBL" />
          </Field>
          <div className="d-flex justify-center" style={{ marginTop: 16 }}>
            <button className="btn" onClick={submitBank}><SaveIcon />Save</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** User-reported (2026-08-28): "Make Create/Edit form same so that data
 * lists can be populated all the time. its a loop hole now." Confirmed a
 * real, concrete instance of the "loophole": when Edit/Delete moved off
 * the homepage cards onto this page's own "Account details" edit form
 * (2026-08-27), that edit form's own draft state never gained Name/
 * Currency/Opening balance — so after that change there was NO way to
 * edit those three fields on an existing account at all, a real
 * regression, not just visual duplication. Fixed at the root: ONE shared
 * field-rendering component used by both the Add form and the Edit form,
 * so they structurally cannot diverge again — a field added to one is a
 * field added to both, and every datalist (account type, bank name, card
 * network) is always populated regardless of which form is open.
 * `idSuffix` keeps each form's `<datalist>` ids unique since both can be
 * mounted in the DOM at once (Add via the homepage FAB, Edit via the
 * detail page). */
function AccountFormFields({
  value,
  onChange,
  idSuffix,
}: {
  value: Omit<BankAccount, 'id'>;
  onChange: (patch: Partial<BankAccount>) => void;
  idSuffix: string;
}) {
  const currencyOptions = useEnabledCurrencies(value.currencyCode);
  return (
    <div>
      {/* Pending item 115(a): grouping under a real Bank entity is
         optional — "no bank yet" is a completely valid, common state.
         `BankIdentityField` (below) is the ONE place this account's bank
         identity lives — it replaces what used to be a separate `Bank`
         Select shown only once a Bank existed, and it's typing-to-create
         so "no bank yet" costs nothing extra. */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <BankIdentityField value={value} onChange={onChange} idSuffix={idSuffix} />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Account name" width={180} required>
          <TextInput value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Meezan Checking" />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={value.currencyCode} onChange={(e) => onChange({ currencyCode: e.target.value })}>
            {currencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Opening balance (optional)" width={140}>
          <TextInput type="number" step="0.01" value={value.openingBalance || ''} onChange={(e) => onChange({ openingBalance: Number(e.target.value) })} />
        </Field>
      </div>
      {/* README item 82: branch/account-type, free-form (not a fixed enum) —
         ACCOUNT_TYPES is just a datalist of common suggestions, any value is
         accepted. */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Field label="Branch (optional)" width={160}>
          <TextInput value={value.branch ?? ''} onChange={(e) => onChange({ branch: e.target.value || undefined })} placeholder="e.g. Gulberg Branch" />
        </Field>
        <Field label="Account type (optional)" width={160}>
          <TextInput list={`bank-account-type-datalist-${idSuffix}`} value={value.accountType ?? ''} onChange={(e) => onChange({ accountType: e.target.value || undefined })} placeholder="e.g. Savings" />
        </Field>
      </div>
      {/* User-requested: an IBAN lookup fills the bank name/BIC
         automatically when supported; all still hand-editable. A found
         name feeds `BankIdentityField` above via `onChange({ bankName })`
         (its own `currentName` falls back to `bankName` while `bankId`
         isn't set yet) rather than a separate field of its own. */}
      <IbanLookupFields value={value} onChange={onChange} onBankNameFound={(name) => onChange({ bankName: name })} />
      <CreditCardFields value={value} onChange={onChange} datalistId={`card-network-datalist-${idSuffix}`} />
      {/* User-requested: save an account number + the SMS sender details a
         bank alert actually arrives from, for a future SMS-based
         transaction-import feature (nothing reads these yet — this just
         gives that feature somewhere to read from). All optional, so
         skipping them changes nothing about today's add-account flow. */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Field label="Account number (optional)" width={160} title="However your bank shows it on statements/SMS — often partially masked, e.g. xxxx1234.">
          <TextInput value={value.accountNumber ?? ''} onChange={(e) => onChange({ accountNumber: e.target.value || undefined })} placeholder="e.g. xxxx1234" />
        </Field>
        <Field label="SMS sender ID (optional)" width={160} title="The sender ID/short code your bank's alert SMS arrives from, e.g. a bank name or a numeric short code.">
          <TextInput value={value.smsSenderId ?? ''} onChange={(e) => onChange({ smsSenderId: e.target.value || undefined })} placeholder="e.g. 8123 or MEEZAN" />
        </Field>
        <Field label="SMS sender number (optional)" width={160} title="If your bank's alerts come from a full phone number instead of a short code.">
          <TextInput value={value.smsSenderNumber ?? ''} onChange={(e) => onChange({ smsSenderNumber: e.target.value || undefined })} placeholder="e.g. +923001234567" />
        </Field>
      </div>
      <datalist id={`bank-account-type-datalist-${idSuffix}`}>
        {ACCOUNT_TYPES.map((t) => <option key={t} value={t} />)}
      </datalist>
    </div>
  );
}

/** `initialCurrency` (2026-08-28) lets a caller outside this module's own
 * FAB pre-seed the new account's currency — used by the shared "+" quick-
 * add in `SideFields` (via `TransactionEntryModal`), which already knows
 * which currency the picker was filtered to when "no account matches"
 * prompted the add. `onSaved` now reports the created account's id back to
 * the caller (still optional, still fires with no meaningful argument for
 * the existing `AddAccountFab` caller, which only used it to close its own
 * modal) so that same picker can auto-select the new account immediately. */
export function AddAccountForm({ onSaved, initialCurrency, initialBankId }: { onSaved?: (id: string) => void; initialCurrency?: string; initialBankId?: string }) {
  const addAccount = useBankWorkbookStore((s) => s.addAccount);
  const [lastCurrency, setLastCurrency] = useLastCurrency('bank-account', 'USD');
  const ensureSignedIn = useEnsureSignedIn();
  const [a, setA] = useState(() => emptyAccount(initialCurrency ?? lastCurrency, initialBankId));

  const submit = async () => {
    if (!a.name.trim()) return toast('Enter an account name.');
    if (!(await ensureSignedIn('Sign in to save bank accounts.'))) return;
    const id = uid();
    addAccount({ ...a, id, name: a.name.trim() });
    toast(`Account "${a.name.trim()}" added.`);
    setA(emptyAccount(a.currencyCode, initialBankId));
    onSaved?.(id);
  };

  return (
    <div>
      <AccountFormFields
        value={a}
        onChange={(patch) => {
          setA((prev) => ({ ...prev, ...patch }));
          if (patch.currencyCode) setLastCurrency(patch.currencyCode);
        }}
        idSuffix="add"
      />
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add account
      </button>
      <p className="text-muted" style={{ marginTop: 8 }}><span style={{ color: 'var(--loss)' }}>*</span> Required. Everything else on this form is optional.</p>
    </div>
  );
}

/** Redesign 2026-08-27 (Main/Often/Rare, rule 1: "entity items as cards
 * rather than long tables with custom reordering options") — replaces the
 * old sortable table with an `EntityCard` grid, one card per account,
 * still grouped by currency (a real user-requested feature, kept). A
 * sortable-column header doesn't carry over on purpose: the model
 * explicitly asks for cards instead of a table with its own reorder
 * controls, and currency grouping is a more useful default ordering here
 * than a sort a user would have to re-apply every visit. Editing an
 * account switches its card to a stacked vertical form (rule 6) in place. */
/** User-reported (2026-08-27): "Banking homepage: Delete and Edit are rare
 * operations they should [be] on details page only... with delete as a red
 * danger button. You may add a button for transactions." Edit/Delete were
 * both moved to `AccountDetailPage` (its own Account Details card's Edit
 * icon, and a dedicated red "Delete account" button) — this card no longer
 * mutates anything itself, it's a pure Main-tier summary + navigation. */
/** Pending item 115(a): "add bank first and then on its details page, give
 * ability to add extra accounts. and see the total balance with that
 * bank. and on Banking homepage see their breakdown and summary." A
 * collapsed-by-default `CollapsibleCard` above the plain `AccountsList`
 * below (rule 1: additive, doesn't restructure that already-tested view)
 * — a Bank is purely optional grouping, so most workbooks (no banks
 * created yet) show nothing extra here at all. */
function BanksList() {
  const banks = useBankWorkbookStore((s) => s.workbook.settings.banks ?? []);
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(() => banks.filter((b) => b.isActive === false).length, [banks]);
  const visibleBanks = useMemo(
    () => (showArchived ? banks : banks.filter((b) => b.isActive !== false)).sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite)),
    [banks, showArchived],
  );
  if (!banks.length) return null;
  return (
    <CollapsibleCard title="Banks" defaultOpen={false}>
      {archivedCount > 0 && (
        <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hide' : 'Show'} closed ({archivedCount})
        </button>
      )}
      <div className="entity-card-grid">
        {visibleBanks.map((b) => {
          const totals = bankTotalsByCurrency(b.id, accounts, transactions);
          const currencies = Object.keys(totals);
          const accountCount = accounts.filter((a) => a.bankId === b.id).length;
          return (
            <EntityCard
              key={b.id}
              title={b.name}
              subtitle={`${accountCount} account${accountCount === 1 ? '' : 's'}`}
              badge={b.isActive === false ? <span className="pill-warn" style={{ fontSize: 10 }}>Closed</span> : undefined}
              statLabel={currencies.length > 1 ? 'Total (by currency)' : 'Total'}
              stat={
                currencies.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {currencies.map((c) => <MoneyValue key={c} n={totals[c]} currency={c} />)}
                  </div>
                ) : (
                  <span className="text-muted">No accounts yet</span>
                )
              }
              hue={b.color}
              onClick={() => navigate(`/bank/bank/${b.id}`)}
            />
          );
        })}
      </div>
    </CollapsibleCard>
  );
}

/** Pending item 115(a)'s own detail page — mirrors `AccountDetailPage`'s
 * read-only+Edit-icon convention. Lists every account linked to this
 * Bank (reusing `EntityCard`, same styling as `AccountsList` itself) with
 * an "Add account" FAB that pre-fills `bankId` so a new account created
 * from here is grouped under this Bank from the start. */
export function BankDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const banks = useBankWorkbookStore((s) => s.workbook.settings.banks ?? []);
  const bank = banks.find((b) => b.id === id);
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateBank = useBankWorkbookStore((s) => s.updateBank);
  const deleteBank = useBankWorkbookStore((s) => s.deleteBank);
  const ensureSignedIn = useEnsureSignedIn();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: bank?.name ?? '', notes: bank?.notes ?? '', color: bank?.color ?? '' });
  const linkedAccounts = useMemo(() => accounts.filter((a) => a.bankId === id), [accounts, id]);
  const totals = useMemo(() => (bank ? bankTotalsByCurrency(bank.id, accounts, transactions) : {}), [bank, accounts, transactions]);
  const [addOpen, setAddOpen] = useState(false);

  const startEdit = () => {
    if (!bank) return;
    setDraft({ name: bank.name, notes: bank.notes ?? '', color: bank.color ?? '' });
    setEditing(true);
  };
  const save = async () => {
    if (!bank) return;
    if (!draft.name.trim()) return toast('Enter a bank name.');
    if (!(await ensureSignedIn('Sign in to save bank details.'))) return;
    updateBank(bank.id, { name: draft.name.trim(), notes: draft.notes.trim() || undefined, color: draft.color || undefined });
    toast('Bank updated.');
    setEditing(false);
  };
  const remove = async () => {
    if (!bank) return;
    if (!(await confirmDialog(`Delete "${bank.name}"? Its accounts stay, just no longer grouped under this bank.`))) return;
    if (!(await ensureSignedIn('Sign in to delete this bank.'))) return;
    deleteBank(bank.id);
    toast('Bank deleted.');
    navigate('/bank');
  };

  if (!bank) {
    return (
      <div>
        <Link to="/bank">← Back to Banking</Link>
        <p className="text-muted">Bank not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/bank">← Back to Banking</Link>
      <CollapsibleCard
        title={editing ? 'Edit bank' : bank.name}
        defaultOpen
        headerExtra={
          !editing && (
            <>
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={startEdit} />
              <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={remove} />
            </>
          )
        }
      >
        {editing ? (
          <div>
            <Field label="Bank name" width={220} required>
              <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Notes (optional)" width={220}>
              <TextInput value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            {/* User-requested (2026-09-09): "Let the user choose color for
               an entity for better distinction (user may choose blue as
               UBL brand color is blue)." */}
            <Field label="Card color (optional)" width={140} title="Colors this Bank's card so it's easy to spot at a glance — pick your bank's own brand color, or anything you like.">
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="color" value={draft.color || '#5aa9c9'} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ width: 44, height: 32, padding: 2, minWidth: 0 }} />
                {draft.color && (
                  <button type="button" className="btn secondary small" onClick={() => setDraft({ ...draft, color: '' })}>Reset</button>
                )}
              </div>
            </Field>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={save}><SaveIcon />Save</button>
              <button className="btn secondary" onClick={() => setEditing(false)}><XIcon />Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            {bank.notes && <p className="text-muted" style={{ marginTop: 0 }}>{bank.notes}</p>}
            <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
              {Object.keys(totals).length ? (
                Object.entries(totals).map(([c, n]) => (
                  <div key={c} className="stat-card card" style={hueStyle('var(--accent)')}>
                    <div className="label">Total ({c})</div>
                    <MoneyValue n={n} currency={c} />
                  </div>
                ))
              ) : (
                <p className="text-muted">No accounts linked yet.</p>
              )}
            </div>
          </div>
        )}
      </CollapsibleCard>
      <div style={{ marginTop: 16 }}>
        <div className="entity-card-grid">
          {linkedAccounts.map((a) => (
            <EntityCard
              key={a.id}
              title={a.name}
              subtitle={[a.accountType, a.branch].filter(Boolean).join(' · ') || undefined}
              statLabel={a.isLiability ? 'Owed' : 'Balance'}
              stat={<MoneyValue n={a.isLiability ? Math.max(0, -accountBalance(a, transactions)) : accountBalance(a, transactions)} currency={a.currencyCode} />}
              hue={a.isLiability ? (accountBalance(a, transactions) < 0 ? 'var(--loss)' : 'var(--profit)') : (accountBalance(a, transactions) >= 0 ? 'var(--profit)' : 'var(--loss)')}
              onClick={() => navigate(`/bank/account/${a.id}`)}
            />
          ))}
        </div>
        {!linkedAccounts.length && <p className="text-muted">No accounts linked to this bank yet.</p>}
      </div>
      <FabButton label="Add account" onClick={() => setAddOpen(true)}>
        <PlusIcon />
      </FabButton>
      {addOpen && (
        <Modal title="Add an account" onClose={() => setAddOpen(false)}>
          <AddAccountForm initialBankId={bank.id} onSaved={() => setAddOpen(false)} />
        </Modal>
      )}
    </div>
  );
}

/** User-requested (2026-09-03): "isActive flag to archive accounts." An
 * archived account is hidden from this default grid (and from every
 * "pick where a NEW transaction/plan goes" picker elsewhere — see
 * `SideFields`/`useAccountPicker`/EMI's/Subscriptions' own "Link to bank"
 * pickers) but its balance always keeps counting toward every total — see
 * `BankAccount.isActive`'s own doc comment for why. Archiving is purely a
 * visibility choice, not a "this account/money doesn't exist" claim. */
function AccountsList() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateAccount = useBankWorkbookStore((s) => s.updateAccount);
  const navigate = useNavigate();
  const ensureSignedIn = useEnsureSignedIn();
  const [showArchived, setShowArchived] = useState(false);
  const { num } = useAmountFormat();

  // Pending item 115(c): "add numeric sequence Id with each entity... for
  // correct data ordering" — the account's own stable position in the
  // underlying array (creation order), NOT the currency-grouped/favorite-
  // sorted display order below. Same convention Funds' own Sr# column
  // already established (Done item 226).
  const srNumOf = useMemo(() => new Map(accounts.map((a, i) => [a.id, i + 1])), [accounts]);

  const archivedCount = useMemo(() => accounts.filter((a) => a.isActive === false).length, [accounts]);
  const visibleAccounts = useMemo(
    () => (showArchived ? accounts : accounts.filter((a) => a.isActive !== false)),
    [accounts, showArchived],
  );

  const toggleFavorite = async (a: BankAccount) => {
    if (!(await ensureSignedIn(a.isFavorite ? 'Sign in to unfavorite this account.' : 'Sign in to favorite this account.'))) return;
    updateAccount(a.id, { isFavorite: !a.isFavorite });
  };

  const currencyGroups = useMemo(() => {
    const byCurrency = new Map<string, BankAccount[]>();
    for (const a of visibleAccounts) {
      const list = byCurrency.get(a.currencyCode) ?? [];
      list.push(a);
      byCurrency.set(a.currencyCode, list);
    }
    // Favorites float to the top of each currency group; a stable sort
    // otherwise leaves creation order (matching Sr#) as the tiebreak.
    for (const list of byCurrency.values()) list.sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite));
    return [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleAccounts]);

  if (!accounts.length) {
    return <p className="text-muted">No accounts yet — use the + button below to add one.</p>;
  }

  return (
    <div>
      {archivedCount > 0 && (
        <button
          className="btn secondary small"
          style={{ marginBottom: 12 }}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? 'Hide' : 'Show'} closed ({archivedCount})
        </button>
      )}
      {!visibleAccounts.length && (
        <p className="text-muted">Every account is closed — click "Show closed" above to see them.</p>
      )}
      {currencyGroups.map(([currency, group]) => {
        // User-requested (2026-09-06): "give sums in a tag for each
        // currency in header/label" — a quick total for whichever accounts
        // are actually visible in THIS group right now (respects the
        // "Show archived" toggle above), distinct from `TotalBalances`'
        // own top-of-page stat cards (which always include archived
        // accounts in their true grand total) — this is "what am I looking
        // at in this group," not "the real overall total."
        const groupSum = group.reduce((s, a) => s + accountBalance(a, transactions), 0);
        return (
        <div key={currency} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em' }}>
              {currency}
            </span>
            <span className={`pill-info`} style={{ fontSize: 11 }}>{num(groupSum)} {currency}</span>
          </div>
          <div className="entity-card-grid">
            {group.map((a) => (
              <EntityCard
                key={a.id}
                title={<><span className="text-muted entity-card-sr">#{srNumOf.get(a.id)}</span>{a.name}</>}
                subtitle={[a.accountType, a.branch].filter(Boolean).join(' · ') || undefined}
                badge={
                  a.isLiability || a.isActive === false ? (
                    <span style={{ display: 'flex', gap: 4 }}>
                      {a.isLiability && <span className="pill-negative" style={{ fontSize: 10 }}>Credit card</span>}
                      {a.isActive === false && <span className="pill-warn" style={{ fontSize: 10 }}>Closed</span>}
                    </span>
                  ) : undefined
                }
                statLabel={a.isLiability ? 'Owed' : 'Balance'}
                stat={
                  <MoneyValue
                    n={a.isLiability ? Math.max(0, -accountBalance(a, transactions)) : accountBalance(a, transactions)}
                    currency={a.currencyCode}
                  />
                }
                hue={
                  a.isLiability
                    ? (accountBalance(a, transactions) < 0 ? 'var(--loss)' : 'var(--profit)')
                    : (accountBalance(a, transactions) >= 0 ? 'var(--profit)' : 'var(--loss)')
                }
                onClick={() => navigate(`/bank/account/${a.id}`)}
                actions={
                  <>
                    <IconButton
                      label={a.isFavorite ? 'Unfavorite' : 'Favorite'}
                      icon={<StarIcon size={13} filled={a.isFavorite} />}
                      align="right"
                      onClick={() => toggleFavorite(a)}
                    />
                    <IconButton
                      label="Transactions"
                      icon={<ListIcon size={13} />}
                      align="right"
                      onClick={() => navigate(`/bank/account/${a.id}`)}
                    />
                  </>
                }
              />
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}

/** User-requested (2026-09-09): "CCs should show a bar (red for consumed
 * and green part for available with max limit and used clearly mentioned
 * at the ends." A plain two-segment bar — red width proportional to
 * `used`, green fills the rest — with Used/Available labeled at each end,
 * same red=liability/green=positive convention this module already uses
 * for hues elsewhere (see `AccountsList`'s own `isLiability`-driven hue). */
function CreditUsageBar({ used, limit, currency }: { used: number; limit: number; currency: string }) {
  const usedPct = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'color-mix(in srgb, var(--profit) 30%, var(--panel-2))' }}>
        <div style={{ width: `${usedPct}%`, background: 'var(--loss)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--loss)' }}>Used: {fmtMoney(used, currency)}</span>
        <span style={{ color: 'var(--profit)' }}>Available: {fmtMoney(Math.max(0, limit - used), currency)} of {fmtMoney(limit, currency)}</span>
      </div>
    </div>
  );
}

/** README item 19: clicking an account opens a detail view with its
 * in-process (planned) and recent real transactions together, plus a
 * "download a statement for a period" CSV export — the account-detail
 * drill-down shipped first for Banking since "account" maps onto it most
 * directly; the same pattern (a modal fed by that module's own ledger +
 * planned-entries hooks) is the template to extend to other modules'
 * primary record type (a loan, a fund, a property) later. */
/** README Pending item 83: clicking an account row used to open a modal
 * in place — the user's own wording ("should take the user to its
 * details page") read as wanting a real navigable page, matching the
 * precedent QSE/PSX's `/stock/:ticker` already set, not just the modal's
 * contents reordered (that narrower reading was already done separately,
 * see Done item 183/Pending item 84's own history). Scoped to Banking
 * first, as a working instance to verify before any wider Cash/Personal
 * Loans rollout — same "ship one page first" pattern this project always
 * follows (see e.g. Done item 58's own "v1 for Banking only" precedent). */
export function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const account = accounts.find((a) => a.id === id);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateAccount = useBankWorkbookStore((s) => s.updateAccount);
  const deleteAccount = useBankWorkbookStore((s) => s.deleteAccount);
  const ensureSignedIn = useEnsureSignedIn();
  const plannedEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const { num } = useAmountFormat();
  // Local draft state (same pattern as Rentals' PropertyDetailModal) rather
  // than editing `account` directly — see the fallback values below: all
  // hooks must run unconditionally on every render (rules of hooks), so
  // the "account not found" guard has to come AFTER every hook call, not
  // before — these `?.` fallbacks just keep the initial render safe for
  // an id that doesn't resolve, before that guard renders instead.
  //
  // Shaped as the FULL `Omit<BankAccount, 'id'>` (matches `AccountFormFields`'
  // `value` prop exactly) — see that component's own doc comment for why:
  // a narrower draft shape here is exactly what silently dropped Name/
  // Currency/Opening-balance editing entirely in an earlier round.
  const accountToFormValue = (a: BankAccount | undefined): Omit<BankAccount, 'id'> => ({
    name: a?.name ?? '',
    currencyCode: a?.currencyCode ?? 'USD',
    openingBalance: a?.openingBalance ?? 0,
    accountNumber: a?.accountNumber,
    smsSenderId: a?.smsSenderId,
    smsSenderNumber: a?.smsSenderNumber,
    branch: a?.branch,
    accountType: a?.accountType,
    iban: a?.iban,
    bankName: a?.bankName,
    bic: a?.bic,
    isLiability: a?.isLiability,
    creditLimit: a?.creditLimit,
    annualFee: a?.annualFee,
    statementDate: a?.statementDate,
    paymentDueDate: a?.paymentDueDate,
    lateFeeAfterDue: a?.lateFeeAfterDue,
    minPaymentAmount: a?.minPaymentAmount,
    cardNetwork: a?.cardNetwork,
    cardBin: a?.cardBin,
    bankId: a?.bankId,
  });
  const [meta, setMeta] = useState<Omit<BankAccount, 'id'>>(() => accountToFormValue(account));
  const saveMeta = async () => {
    if (!account) return;
    if (!meta.name.trim()) return toast('Enter an account name.');
    if (!(await ensureSignedIn('Sign in to save account details.'))) return;
    updateAccount(account.id, {
      ...meta,
      name: meta.name.trim(),
      accountNumber: meta.accountNumber?.trim() || undefined,
      smsSenderId: meta.smsSenderId?.trim() || undefined,
      smsSenderNumber: meta.smsSenderNumber?.trim() || undefined,
      branch: meta.branch?.trim() || undefined,
      accountType: meta.accountType?.trim() || undefined,
      iban: meta.iban?.trim() || undefined,
      bankName: meta.bankName?.trim() || undefined,
      bic: meta.bic?.trim() || undefined,
    });
    toast('Account details saved.');
  };
  const ledger = useMemo(() => (account ? [...accountRunningLedger(account, transactions)].reverse() : []), [account, transactions]);
  const upcoming = useMemo(
    () => (account ? plannedEntries.filter((p) => p.accountId === account.id && !p.executed).sort((a, b) => a.date.localeCompare(b.date)) : []),
    [plannedEntries, account],
  );
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // Redesign 2026-08-27 (Often tier: "read-only by default, an Edit icon
  // switches into the same form"). Cancelling resets the draft back to the
  // account's own last-saved values, so a discarded edit doesn't leave
  // stale text sitting in the form the next time it's opened.
  const [editingMeta, setEditingMeta] = useState(false);
  const cancelMetaEdit = () => {
    if (!account) return;
    setMeta(accountToFormValue(account));
    setEditingMeta(false);
  };

  const exportStatement = () => {
    if (!account) return;
    const rows = ledger
      .filter((r) => (!fromDate || r.tx.date >= fromDate) && (!toDate || r.tx.date <= toDate))
      .slice()
      .reverse();
    const header = ['Date', 'Description', 'Category', 'Amount', 'Balance'];
    const body = rows.map((r) => [r.tx.date, r.tx.description, r.tx.category || '', r.tx.amount, r.balance]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'now'}` : '';
    a.download = `${account.name.replace(/\s+/g, '_')}_statement${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Statement downloaded.');
  };

  if (!account) {
    return (
      <div>
        <Link to="/bank" className="text-muted">← Back to Banking</Link>
        <p className="text-muted" style={{ marginTop: 12 }}>Account not found.</p>
      </div>
    );
  }

  const deleteThisAccount = async () => {
    if (!(await confirmDialog('This deletes the account and all its transactions — this cannot be undone.', `Delete "${account.name}"?`))) return;
    deleteAccount(account.id);
    toast('Account deleted.');
    navigate('/bank');
  };

  // User-requested (2026-09-03): "isActive flag to archive accounts" — a
  // safer, reversible alternative to Delete. Archiving only hides the
  // account from the default list and from pickers for NEW activity; its
  // balance keeps counting toward every total (see `BankAccount.isActive`'s
  // own doc comment) — so unlike Delete, this needs no destructive warning.
  const toggleArchived = async () => {
    if (!(await ensureSignedIn(account.isActive === false ? 'Sign in to reopen this account.' : 'Sign in to close this account.'))) return;
    updateAccount(account.id, { isActive: account.isActive === false ? true : false });
    toast(account.isActive === false ? 'Account reopened.' : 'Account closed.');
  };

  return (
    <div>
      <Link to="/bank" className="text-muted">← Back to Banking</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="pagetitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {account.name}
          {account.isActive === false && <span className="pill-warn" style={{ fontSize: 11 }}>Closed</span>}
        </h1>
        {/* User-requested (2026-08-27): "Delete and Edit are rare operations
           they should [be] on details page only... with delete as a red
           danger button." Edit already lives on the Account Details card
           below (its own Edit icon); Delete/Close are the account's own
           destructive/reversible actions, both moved off the homepage
           entity card entirely and grouped together here (rule 7). */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary small" onClick={toggleArchived}>
            {account.isActive === false ? <><RestoreIcon size={13} />Reopen account</> : <><ArchiveIcon size={13} />Close account</>}
          </button>
          <button className="btn danger small" onClick={deleteThisAccount}>
            <TrashIcon size={13} />Delete account
          </button>
        </div>
      </div>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        {account.isLiability ? 'Amount owed:' : 'Current balance:'}{' '}
        <strong title={fmtMoney(account.isLiability ? Math.max(0, -accountBalance(account, transactions)) : accountBalance(account, transactions), account.currencyCode)}>
          {num(account.isLiability ? Math.max(0, -accountBalance(account, transactions)) : accountBalance(account, transactions))} {account.currencyCode}
        </strong>
        {account.isLiability && account.creditLimit ? (
          <span className="text-muted"> · {num(Math.max(0, account.creditLimit - Math.max(0, -accountBalance(account, transactions))))} {account.currencyCode} available of {num(account.creditLimit)} limit</span>
        ) : null}
        {/* User-requested (2026-09-08): show pending money too, not just
           exclude it silently — the cleared figure above already excludes
           any `isPending` transaction. */}
        {(() => {
          const pendingAmt = accountPendingBalance(account, transactions);
          if (pendingAmt === 0) return null;
          const withPending = account.isLiability ? Math.max(0, -(accountBalance(account, transactions) + pendingAmt)) : accountBalance(account, transactions) + pendingAmt;
          return (
            <span> · {pendingAmt > 0 ? '+' : ''}{num(pendingAmt)} {account.currencyCode} pending → {num(withPending)} {account.currencyCode} incl. pending</span>
          );
        })()}
      </p>

      {/* User-requested (2026-09-09): "CCs should show a bar (red for
         consumed and green part for available with max limit and used
         clearly mentioned at the ends." */}
      {account.isLiability && account.creditLimit ? (
        <CreditUsageBar
          used={Math.max(0, -accountBalance(account, transactions))}
          limit={account.creditLimit}
          currency={account.currencyCode}
        />
      ) : null}

      {/* User-reported (2026-08-28): "UI ordering still pathetic. Account
         details buried in middle instead of showing on top" — full-width,
         alone, ahead of everything else: an entity's own identity/
         attributes read first. */}
      <CollapsibleCard
        defaultOpen={false}
        style={{ marginBottom: 16 }}
        title={<h3 style={{ margin: 0 }}>Account details</h3>}
        headerExtra={
          editingMeta ? (
            <>
              <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={() => { saveMeta(); setEditingMeta(false); }} />
              <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={cancelMetaEdit} />
            </>
          ) : (
            <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => setEditingMeta(true)} />
          )
        }
      >
        {!editingMeta ? (
          <AttributeList
            items={[
              { label: 'Name', value: account.name },
              { label: 'Currency', value: account.currencyCode },
              { label: 'Opening balance', value: fmtMoney(account.openingBalance, account.currencyCode) },
              { label: 'Branch', value: account.branch },
              { label: 'Account type', value: account.accountType },
              { label: 'IBAN', value: account.iban },
              { label: 'Bank name', value: account.bankName },
              { label: 'BIC', value: account.bic },
              { label: 'Credit limit', value: account.creditLimit !== undefined ? fmtMoney(account.creditLimit, account.currencyCode) : undefined },
              { label: 'Annual fee', value: account.annualFee !== undefined ? fmtMoney(account.annualFee, account.currencyCode) : undefined },
              { label: 'Statement day of month', value: account.statementDate },
              { label: 'Payment due day of month', value: account.paymentDueDate },
              { label: 'Late fee after due date', value: account.lateFeeAfterDue !== undefined ? fmtMoney(account.lateFeeAfterDue, account.currencyCode) : undefined },
              { label: 'Minimum amount due', value: account.minPaymentAmount !== undefined ? fmtMoney(account.minPaymentAmount, account.currencyCode) : undefined },
              { label: 'Card network', value: account.cardNetwork },
              { label: 'Card BIN', value: account.cardBin },
              { label: 'Account number', value: account.accountNumber },
              { label: 'SMS sender ID', value: account.smsSenderId },
              { label: 'SMS sender number', value: account.smsSenderNumber },
            ]}
          />
        ) : (
          <AccountFormFields value={meta} onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))} idSuffix="detail" />
        )}
      </CollapsibleCard>

      {/* User-reported (2026-08-28): "Add Trc & Ctegs should be side by
         side" — now that "Add a transaction" is gone (replaced by the
         Transfers FAB below), this grid holds By category + Upcoming plans
         side by side instead of either claiming the full page width. */}
      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <CollapsibleCard defaultOpen={false} title={<h3 style={{ margin: 0 }}>By category</h3>}>
          <CategoryBreakdownBody account={account} />
        </CollapsibleCard>

        {upcoming.length > 0 && (
          <CollapsibleCard defaultOpen={false} title={<h3 style={{ margin: 0 }}>Upcoming plans ({upcoming.length})</h3>}>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
                <tbody>
                  {upcoming.map((p) => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td>{p.description}</td>
                      <td className={p.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(p.amount, account.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleCard>
        )}
      </div>

      {/* User-requested (2026-09-06): "Analytics missing on individual bank
         page: Grid: Balance over time, Income vs. spend by month, Category
         breakdown (spend) monthly with month nav + smart tabular values."
         The whole-module Analytics tab (`AnalyticsTab` below) already has
         this exact chart set, but only reachable via its own account
         picker — this brings the same three charts directly onto the
         account's own page, pre-scoped to it, plus a month-nav'd exact-
         numbers table (see `AccountAnalyticsSection`'s own doc comment). */}
      <CollapsibleCard defaultOpen={false} style={{ marginBottom: 16 }} title={<h3 style={{ margin: 0 }}>Analytics</h3>}>
        <AccountAnalyticsSection account={account} />
      </CollapsibleCard>

      {/* User-requested (2026-08-28): "Adding Trc UI can be removed from
         all, that's why we are doing it one button action" — the
         per-account "Add a transaction" card (built 2026-08-26, see the
         history in git blame if needed) is gone; a Transfers FAB reachable
         from this page, defaulting to THIS account, replaces it. */}
      <AccountTransfersFab accountId={account.id} currencyCode={account.currencyCode} />

      {/* User-requested (2026-08-26): "Transactions belong to an account so
         should be on its detail page/popup and editable" — this used to be
         a read-only 20-row preview; now reuses the same `TransactionsList`
         the standalone Transactions tab already used (full CRUD: sort,
         inline edit, delete with the linked-record warning), so editing a
         transaction no longer requires leaving the account's own page.

         2026-08-27: "Double scroller in transactions view, not good" — a
         real bug, not a style nitpick: this used to sit inside its own
         `maxHeight:320, overflowY:'auto'` box ON TOP of `TransactionsList`'s
         own `.table-scroll` (a horizontal scroll region) — two independent
         scrollable regions nested inside each other. Dropped the outer
         box entirely; the table now just grows with the page (one scroll
         axis: the page itself), with `.table-scroll` still handling
         horizontal overflow on a narrow viewport as it always did. */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Transactions</h3>
        <TransactionsList account={account} />
      </Card>

      {/* User-requested (2026-08-27): "Import CSV should belong an account" —
         moved in from the old standalone tab (see ImportStatementSection's
         own comment). Collapsed by default — importing a statement is rare
         once an account's history is caught up. */}
      <CollapsibleCard defaultOpen={false} style={{ marginBottom: 16 }} title={<h3 style={{ margin: 0 }}>Import statement</h3>}>
        <ImportStatementSection account={account} />
      </CollapsibleCard>

      <CollapsibleCard
        defaultOpen={false}
        style={{ marginBottom: 16 }}
        title={<h3 style={{ margin: 0 }}>Download statement</h3>}
        headerExtra={<button className="btn" onClick={exportStatement}><ExportIcon size={13} />Export CSV</button>}
      >
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="From (optional)">
            <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="To (optional)">
            <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
        </div>
      </CollapsibleCard>
    </div>
  );
}

function AccountsTab() {
  return (
    <div>
      <TotalBalances />
      <BanksList />
      <AccountsList />
      <AccountsFab />
    </div>
  );
}

/* ============================== Transactions ============================== */

/** Used by the Planning tab — "which account should this new plan belong
 * to." Archived accounts are excluded here too (2026-09-03): planning a
 * new future payment against an archived account doesn't make sense, same
 * "hide from pickers for new activity" rule as `AccountsList`/`SideFields`. */
function useAccountPicker() {
  const allAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const accounts = useMemo(() => allAccounts.filter((a) => a.isActive !== false), [allAccounts]);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;
  return { accounts, account, accountId: account?.id ?? '', setAccountId };
}

/** User-requested (2026-08-28): the account's own "Transfers" FAB — a
 * single-action `FabPanel` (falls back to a plain `FabButton` visually)
 * replacing the "Add a transaction" card that used to sit here. Opens
 * `TransactionEntryModal` defaulted to THIS account, the same modal every
 * other module's own Transfers FAB opens. */
function AccountTransfersFab({ accountId, currencyCode }: { accountId: string; currencyCode: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabPanel actions={[{ label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen(true) }]} />
      {open && <TransactionEntryModal defaultFinance={{ module: 'bank', ref: accountId, currencyCode }} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Popup edit form for one Bank transaction — replaces the old inline
 * table-row editing, same "editing done in a popup for UI consistency"
 * reasoning as `CashPage.tsx`'s `EditEntryModal`. `amount` stays signed on
 * the STORED record (Bank's own convention, see `types/finance.ts`) —
 * `isDeposit` is re-derived from it by the store itself on save, never
 * edited directly here. The UI itself no longer asks for a signed number,
 * though (user-reported 2026-09-06, "use radio/chips for withdrawal or
 * deposit instead of positive & negative entries!"): a Deposit/Withdrawal
 * `DirectionChips` toggle plus a plain magnitude input, converted to the
 * signed `amount` only at save time — same pattern as
 * `TransactionEntryModal.tsx`'s add flow. */
function EditTransactionModal({ tx, onClose }: { tx: BankTransaction; onClose: () => void }) {
  const updateTransaction = useBankWorkbookStore((s) => s.updateTransaction);
  const [draft, setDraft] = useState<BankTransaction>({ ...tx });
  const direction: 'in' | 'out' = draft.amount >= 0 ? 'in' : 'out';
  const magnitude = Math.abs(draft.amount);
  const setDirection = (d: 'in' | 'out') => setDraft({ ...draft, amount: d === 'in' ? magnitude : -magnitude });
  const setMagnitude = (m: number) => setDraft({ ...draft, amount: direction === 'in' ? m : -m });

  const save = async () => {
    if (!(await warnIfLinked('bank', tx.id))) return;
    updateTransaction(tx.id, draft);
    toast('Transaction updated.');
    onClose();
  };

  return (
    <FinanceEditModal titleText="Edit transaction" onClose={onClose} onSave={save}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Date">
          <TextInput type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="Description" required>
          <TextInput value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <Field label="Direction">
          <DirectionChips value={direction} onChange={setDirection} labels={{ in: 'Deposit', out: 'Withdrawal' }} />
        </Field>
        <Field label="Amount" required>
          <TextInput type="number" step="0.01" min={0} value={magnitude || ''} onChange={(e) => setMagnitude(Number(e.target.value))} />
        </Field>
        <Field label="Category">
          <CategorySelect value={draft.categoryID ?? UNCATEGORIZED_ID} onChange={(categoryID) => setDraft({ ...draft, categoryID })} />
        </Field>
        <TimeZoneFields
          time={draft.time}
          timezone={draft.timezone}
          onTimeChange={(time) => setDraft({ ...draft, time })}
          onTimezoneChange={(timezone) => setDraft({ ...draft, timezone })}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <PendingToggle
          checked={!!draft.isPending}
          onChange={(v) => setDraft({ ...draft, isPending: v })}
          label="Pending (not yet cleared)"
          title="Not yet cleared — excluded from Current balance until unchecked."
        />
      </div>
      <p className="text-muted" style={{ marginTop: 8 }}>
        {draft.source === 'statement-import' ? `Imported${draft.statementRef ? ` from ${draft.statementRef}` : ''}` : 'Entered manually'}
      </p>
    </FinanceEditModal>
  );
}

/** User-requested (2026-09-03): "add filters to other tables as well" —
 * extends the Type/Category filter treatment Cash's statement tables got
 * (README Done item 224) here too. */
function TransactionsList({ account }: { account: BankAccount }) {
  const allTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateTransaction = useBankWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = useBankWorkbookStore((s) => s.deleteTransaction);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const ensureSignedIn = useEnsureSignedIn();
  const sideLabel = useLinkSideLabel();
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  // User-requested (2026-09-06): "although we are removing sorting, we
  // must add all fields as filters in all tables" — a Source filter
  // (Manual/Imported) was the one column here with no matching filter,
  // unlike Personal Loans' equivalent repayments table which already had
  // one; added for parity now that free column sorting is gone.
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'statement-import'>('all');

  const allLedger = useMemo(() => accountRunningLedger(account, allTransactions), [account, allTransactions]);

  const categoryOptions = useMemo(
    () => [...new Set(allLedger.map((r) => categoryName(r.tx.categoryID, categories)))].sort(),
    [allLedger, categories],
  );

  const ledger = useMemo(
    () => allLedger.filter((r) => {
      if (typeFilter === 'in' && r.tx.amount < 0) return false;
      if (typeFilter === 'out' && r.tx.amount >= 0) return false;
      if (categoryFilter !== 'all' && categoryName(r.tx.categoryID, categories) !== categoryFilter) return false;
      if (sourceFilter !== 'all' && (r.tx.source ?? 'manual') !== sourceFilter) return false;
      return true;
    }),
    [allLedger, typeFilter, categoryFilter, sourceFilter, categories],
  );

  // User-requested (2026-08-28): "Tag/Mark and also add nav link between the
  // linked trcs" — a recordId -> link map, built once per render (not
  // re-scanned per row via `findLinkForRecord`'s own O(n) lookup), so a
  // linked transaction can show a small tag pointing at the other side.
  const linkByRecordId = useMemo(() => {
    const map = new Map<string, (typeof links)[number]>();
    for (const l of links) {
      if (l.from.module === 'bank') map.set(l.fromRecordId, l);
      if (l.to.module === 'bank') map.set(l.toRecordId, l);
    }
    return map;
  }, [links]);

  // User-reported (2026-09-06): "we may stop sorting options for
  // chronologically important tables (only sequence-aware tables) to
  // avoid the disordered mess" — a statement table's own Balance column
  // is only meaningful in real chronological+sequence order; letting the
  // user click any column (Amount, Category, ...) to resort it produces
  // exactly the "disordered mess" the earlier same-date sort bug already
  // demonstrated (Done item 234). Sorting is gone from this table
  // entirely — `ledger` is always shown newest-first, matching
  // `accountRunningLedger`'s own real-instant+serialNumber order (just
  // reversed for display), and the ONLY way to change two rows' relative
  // order is the `ReorderButtons` below, which can only ever swap two
  // rows genuinely tied on the same real instant — never scramble the
  // table into a different, unrelated order.
  const sorted = useMemo(() => [...ledger].reverse(), [ledger]);
  const instantOf = (r: (typeof sorted)[number]) => dateOnlyMs(r.tx.date);
  const reorder = async (pair: [{ id: string; order: number }, { id: string; order: number }]) => {
    if (!(await ensureSignedIn('Sign in to reorder transactions.'))) return;
    for (const p of pair) updateTransaction(p.id, { serialNumber: p.order });
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Field label="Type" width={120}>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
            <option value="all">All</option>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </Select>
        </Field>
        <Field label="Category" width={170}>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Source" width={130}>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}>
            <option value="all">All</option>
            <option value="manual">Manual</option>
            <option value="statement-import">Imported</option>
          </Select>
        </Field>
      </div>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {/* User-reported (2026-08-27): "Transaction Id missing, terrible
               account statement sequence!" — `serialNumber` (Done item 212,
               renamed under the Finance base 2026-09-03) is already the
               app-wide stable per-record ordering primitive; surfacing it
               as a plain "#" column gives a real, stable reference number
               per transaction, not just a truncated uuid. */}
            <th title="Sequence number — a stable reference for this transaction, in the order it was actually entered.">#</th>
            <th>Date</th>
            {/* User-reported (2026-08-28): "Description and Source are
               making the table too large to read" + "Credit/Debit and
               balance should be next to each other. Categories can be
               marked as labels" — Description/Source clipped with a hover
               tooltip for the full text; Category rendered as a colored
               `.pill-info` label instead of plain text; Amount and Balance
               moved next to each other at the end, ahead of actions. */}
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Balance</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ tx, balance }, i) => {
            const link = linkByRecordId.get(tx.id);
            const otherSide = link ? (link.from.module === 'bank' && link.fromRecordId === tx.id ? link.to : link.from) : undefined;
            return (
              <tr key={tx.id}>
                <td className="text-muted">
                  {tx.serialNumber ?? '—'}{' '}
                  <ReorderButtons
                    rows={sorted}
                    index={i}
                    instantOf={instantOf}
                    idOf={(r) => r.tx.id}
                    orderOf={(r) => r.tx.serialNumber}
                    onMove={reorder}
                  />
                </td>
                <td>{tx.date}</td>
                <td className="cell-clip" title={tx.description}>
                  {tx.description}
                  {tx.isPending && (
                    <span className="pill-warn" style={{ marginLeft: 6 }} title="Not yet cleared — excluded from Current balance above until marked cleared.">Pending</span>
                  )}
                  {link && (
                    <Link to={linkTargetPath(otherSide!)} className="pill-info" style={{ marginLeft: 6, textDecoration: 'none' }} title="Linked — go to the other side">
                      🔗 {sideLabel(link.from)} → {sideLabel(link.to)}
                    </Link>
                  )}
                </td>
                <td><span className="pill-info">{categoryName(tx.categoryID, categories)}</span></td>
                <td className={tx.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(tx.amount, account.currencyCode)}</td>
                <td>{fmtMoney(balance, account.currencyCode)}</td>
                <td className="text-muted cell-clip" title={tx.source === 'statement-import' ? `Import${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual'}>
                  {tx.source === 'statement-import' ? `Import${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual'}
                </td>
                <td>
                  {tx.isPending && (
                    <IconButton
                      label="Mark cleared"
                      icon={<CheckIcon size={13} />}
                      align="right"
                      onClick={async () => {
                        if (!(await ensureSignedIn('Sign in to update this transaction.'))) return;
                        updateTransaction(tx.id, { isPending: false });
                        toast('Marked cleared.');
                      }}
                    />
                  )}{' '}
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => setEditingTx(tx)} />{' '}
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon size={13} />}
                    align="right"
                    onClick={() => confirmAndDeleteLinkable('bank', tx.id, () => deleteTransaction(tx.id))}
                  />
                </td>
              </tr>
            );
          })}
          {!sorted.length && (
            <tr>
              <td colSpan={7} className="text-muted">
                {allLedger.length ? 'No transactions match these filters.' : 'No transactions for this account yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {editingTx && <EditTransactionModal tx={editingTx} onClose={() => setEditingTx(null)} />}
    </div>
  );
}

/** Renders just the category table (no card wrapper of its own) — the
 * caller (`AccountDetailPage`) supplies the `CollapsibleCard` so this
 * never nests a card inside a card (rule 1). */
/** Per-account Analytics grid on `AccountDetailPage` — user-requested
 * 2026-09-06 (see that page's own call-site comment for the exact
 * wording). Reuses the SAME three chart shapes as the whole-module
 * `AnalyticsTab` below (Balance over time / Income vs. spend by month /
 * Category breakdown), pre-scoped to this one account instead of needing
 * an account picker — "Balance over time" and "Income vs. spend by month"
 * show the account's FULL history (a trend chart loses its point scoped
 * to one month), while "Category breakdown (spend)" is scoped to a single
 * selected month via the ◀ Prev/This month/Next ▶ nav, matching the
 * user's own "monthly with month nav" wording.
 *
 * "Smart tabular values": below the chart grid, a plain table gives the
 * SAME numbers behind the selected month's chart data in exact figures
 * (Income/Expense/Net flow/Balance at month end, then one row per spend
 * category) — a chart's own hover tooltip is the only other way to read
 * an exact number today, and doesn't work at all on a touch device. */
function AccountAnalyticsSection({ account }: { account: BankAccount }) {
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const categories = useCategoryStore((s) => s.workbook.categories);
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const ledger = useMemo(() => accountRunningLedger(account, transactions), [account, transactions]);
  const monthlyFlow = useMemo(() => bankMonthlyFlow(transactions, [account.id]), [transactions, account.id]);

  // Pending item 115(d): "charts should be interactive... right now they are
  // dumping lifetime data all at once" — a from/to month range narrows the
  // two full-history charts (Balance over time, Income vs. spend by month).
  // Deliberately a local `<input type="month">` pair rather than reusing
  // QSE/PSX's `ChartFilterBar`/`ChartFilter` (lib/calc/chartFilters.ts) —
  // that type's `tickers` field has no meaning for a bank account, and the
  // shapes here (a running ledger, a `{month,income,expense}[]` series)
  // don't match its `{months,values}` helpers either. The Category
  // breakdown card + its own ◀/▶ month nav below is a separate, more
  // specific tool (one exact month at a time) and is left untouched.
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const filteredLedger = useMemo(
    () => ledger.filter((r) => (!fromMonth || r.tx.date.slice(0, 7) >= fromMonth) && (!toMonth || r.tx.date.slice(0, 7) <= toMonth)),
    [ledger, fromMonth, toMonth],
  );
  const filteredMonthlyFlow = useMemo(
    () => monthlyFlow.filter((f) => (!fromMonth || f.month >= fromMonth) && (!toMonth || f.month <= toMonth)),
    [monthlyFlow, fromMonth, toMonth],
  );

  const [monthOffset, setMonthOffset] = useState(0);
  const selectedMonth = monthRange(monthOffset, monthOffset)[0];
  const selectedMonthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const monthTxs = useMemo(
    () => transactions.filter((t) => t.accountId === account.id && t.date.slice(0, 7) === selectedMonth),
    [transactions, account.id, selectedMonth],
  );
  const byCategoryThisMonth = useMemo(() => accountByCategory(account, monthTxs, categories), [account, monthTxs, categories]);
  const spendCategories = Object.keys(byCategoryThisMonth).filter((c) => byCategoryThisMonth[c] < 0);
  const monthFlowRow = monthlyFlow.find((f) => f.month === selectedMonth);
  const endOfMonthBalance = accountBalanceAsOfMonth(ledger, selectedMonth, account.openingBalance);

  if (!ledger.length) {
    return <p className="text-muted" style={{ margin: 0 }}>No transactions yet — analytics will appear once you log some.</p>;
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="text-muted">Chart range:</span>
        <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} aria-label="From month" />
        <span className="text-muted">to</span>
        <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} aria-label="To month" />
        {(fromMonth || toMonth) && (
          <button type="button" className="btn secondary small" onClick={() => { setFromMonth(''); setToMonth(''); }}>Clear</button>
        )}
        <Tooltip text="Narrows the Balance over time and Income vs. spend charts below to this window. Doesn't affect Category breakdown, which already has its own month navigation, or any lifetime total shown elsewhere." />
      </div>
      <div className="grid-auto" style={{ ...gridAutoStyle(300, 16), marginBottom: 16 }}>
        <ChartCard flat title="Balance over time" empty={!filteredLedger.length}>
          <Line
            data={{
              labels: filteredLedger.map((r) => r.tx.date),
              datasets: [{ label: 'Balance', data: filteredLedger.map((r) => r.balance), borderColor: '#5aa9c9', backgroundColor: '#5aa9c933', fill: true, tension: 0.2 }],
            }}
            options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtMoney(v, account.currencyCode)) } }}
          />
        </ChartCard>
        <ChartCard flat title="Income vs. spend by month" empty={!filteredMonthlyFlow.length}>
          <Bar
            data={{
              labels: filteredMonthlyFlow.map((f) => f.month),
              datasets: [
                { label: 'Income', data: filteredMonthlyFlow.map((f) => f.income), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                { label: 'Expense', data: filteredMonthlyFlow.map((f) => f.expense), backgroundColor: cssVar('--loss') || '#e5484d' },
              ],
            }}
            options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, account.currencyCode)) } }}
          />
        </ChartCard>
        <ChartCard flat title={`Category breakdown (spend) — ${selectedMonthLabel}`} empty={!spendCategories.length}>
          <Doughnut
            data={{
              labels: spendCategories,
              datasets: [{ data: spendCategories.map((c) => Math.abs(byCategoryThisMonth[c])), backgroundColor: spendCategories.map((c) => tickerColor(c)) }],
            }}
            options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, account.currencyCode)) } }}
          />
        </ChartCard>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button className="btn secondary small" onClick={() => setMonthOffset((o) => o - 1)}>◀ Prev month</button>
        <button className="btn secondary small" onClick={() => setMonthOffset(0)}>This month</button>
        <button className="btn secondary small" onClick={() => setMonthOffset((o) => o + 1)}>Next month ▶</button>
      </div>

      <div className="table-scroll">
        <table>
          <thead><tr><th colSpan={2}>{selectedMonthLabel}</th></tr></thead>
          <tbody>
            <tr><td>Income</td><td>{fmtMoney(monthFlowRow?.income ?? 0, account.currencyCode)}</td></tr>
            <tr><td>Expense</td><td>{fmtMoney(monthFlowRow?.expense ?? 0, account.currencyCode)}</td></tr>
            <tr>
              <td>Net flow</td>
              <td className={(monthFlowRow?.net ?? 0) >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(monthFlowRow?.net ?? 0, account.currencyCode)}</td>
            </tr>
            <tr><td>Balance at month end</td><td>{fmtMoney(endOfMonthBalance, account.currencyCode)}</td></tr>
            {spendCategories.map((c) => (
              <tr key={c}><td>{c}</td><td>{fmtMoney(Math.abs(byCategoryThisMonth[c]), account.currencyCode)}</td></tr>
            ))}
            {!spendCategories.length && <tr><td colSpan={2} className="text-muted">No spend this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryBreakdownBody({ account }: { account: BankAccount }) {
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const byCategory = accountByCategory(account, transactions, categories);
  const cats = Object.keys(byCategory);
  if (!cats.length) return <p className="text-muted" style={{ margin: 0 }}>No categorized transactions yet.</p>;

  return (
      <div className="table-scroll">
        <table>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat}>
                <td>{cat}</td>
                <td className={byCategory[cat] >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(byCategory[cat], account.currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  );
}

/* ============================== Statement import ============================== */

/** User-reported (2026-08-27): "Import CSV should belong an account, rather
 * than hey look here, i am a very big card with just one button! DO NOT DO
 * THAT!" — this used to be its own top-level tab with its own account
 * picker (exactly the "DO NOT ask user on the main screen to use
 * selectboxes to alter info" pattern the user separately called out).
 * Scoped to the account whose detail page it's embedded in — no picker,
 * since there's nothing to pick, the account is already known. */
function ImportStatementSection({ account }: { account: BankAccount }) {
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
        // Re-derived from `amount`'s own sign by the store anyway (Bank's
        // amount is the authoritative field — see `types/finance.ts`); set
        // here only to satisfy the type.
        isDeposit: Number(r[ai]) * (flipSign ? -1 : 1) >= 0,
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span className="text-muted">Import a CSV export from your bank into {account.name}.</span>
        <Tooltip text={'This is a simple "map these columns" tool, not a per-bank-format parser — pick which column is which below, since every bank\'s export looks a little different.'} />
      </div>
      <div>
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
        {fileName && <span className="text-muted" style={{ marginLeft: 8 }}>{fileName} ({rows.length} rows)</span>}
      </div>

      {headers.length > 0 && (
        <div style={{ marginTop: 12 }}>
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
            <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 20 }} title="Check this if your bank exports spending as positive numbers instead of negative.">
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
                    <td className={r.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(r.amount, account.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={doImport}>
              <PlusIcon />Import {rows.length} transaction{rows.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Settings ============================== */

function AccountSection({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const [busy, setBusy] = useState(false);

  // User-reported (2026-08-27, then again 2026-08-28: "Settings & 'Plans —
  // account Synced...' still present, although clearly mentioned multiple
  // times to move into single page... why are you making things
  // [not] centralized and well-organized"): the sync-status TEXT itself
  // (not just its card wrapper, already fixed once) duplicated what the
  // global /account hub's Sync status section already shows — dropped
  // entirely here. Only the actionable cloud-empty-upload warning stays,
  // since that genuinely can't live on the hub (it needs Banking's own
  // uploadLocalToCloud) — this whole section now renders nothing at all
  // once there's nothing to act on, rather than a redundant status line.
  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <div>
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
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
        </Notice>
      )}
    </div>
  );
}

/** Banking's "what if" scenario planner — see `types/plannedBank.ts` and
 * `features/cash/pages/CashPage.tsx`'s `PlanningTab` (same pattern, mirrored
 * here rather than shared as a component since the two modules' record
 * shapes — a Cash entry's `type`/`currencyCode` vs. a Bank transaction's
 * signed `amount`/`accountId` — differ enough that a shared component would
 * need its own translation layer for little real reuse). */
function emptyBankPlan(accountId: string): PlannedBankTransaction {
  return { id: crypto.randomUUID(), accountId, date: today(), description: '', amount: 0, category: '' };
}

function BalanceProjectionSummary() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const plannedEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const settings = usePlannedBankWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePlannedBankWorkbookStore((s) => s.updateSettings);
  const projection = useMemo(
    () => plannedBankProjection(accounts, transactions, plannedEntries),
    [accounts, transactions, plannedEntries],
  );
  const codes = Object.keys(projection);

  return (
    <CollapsibleCard
      title={
        <Tooltip text="See what your total balance would look like if every plan below actually happened — a reality check before you spend.">
          <h3 style={{ margin: 0, cursor: 'pointer' }}>Balance projection</h3>
        </Tooltip>
      }
      style={{ marginBottom: 16 }}
    >
      <div className="row" style={{ gap: 16, marginBottom: 12 }}>
        <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={settings.showRealBalance} onChange={(e) => updateSettings({ showRealBalance: e.target.checked })} />
          Real balance
        </label>
        <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={settings.showPlannedBalance} onChange={(e) => updateSettings({ showPlannedBalance: e.target.checked })} />
          Planned balance
        </label>
      </div>
      {!codes.length ? (
        <p className="text-muted">No balance yet — add an account or a plan below.</p>
      ) : (
        <div className="grid-auto" style={gridAutoStyle(180, 8)}>
          {codes.map((code) => (
            <div key={code} className="stat-card card">
              <div className="label">{code}</div>
              {settings.showRealBalance && (
                <div className={projection[code].real >= 0 ? 'pill-positive' : 'pill-negative'}>Real: {fmtMoney(projection[code].real, code)}</div>
              )}
              {settings.showPlannedBalance && (
                <div className={projection[code].planned >= 0 ? 'pill-positive' : 'pill-negative'}>
                  Planned: {fmtMoney(projection[code].planned, code)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}

/** README item 86 (2026-08-26 feedback): "Add a plan" shouldn't be
 * permanently visible either — same FAB+popup treatment as "Add a loan"
 * (Done item 166) and "Add an account" above. */
function AddBankPlanFab({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabButton label="Add a plan" onClick={() => setOpen(true)}><PlusIcon /></FabButton>
      {open && (
        <Modal title="Add a plan" onClose={() => setOpen(false)}>
          <AddBankPlanForm accountId={accountId} onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddBankPlanForm({ accountId, onSaved }: { accountId: string; onSaved?: () => void }) {
  const addPlan = usePlannedBankWorkbookStore((s) => s.addEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [p, setP] = useState<PlannedBankTransaction>(() => emptyBankPlan(accountId));
  // Same magnitude+direction UI as the real transaction forms above (user-
  // reported 2026-09-06) — `PlannedBankTransaction.amount` itself stays
  // signed, same convention as the real `BankTransaction` it'll become.
  const direction: 'in' | 'out' = p.amount >= 0 ? 'in' : 'out';
  const magnitude = Math.abs(p.amount);

  const submit = async () => {
    if (!p.amount || !p.description.trim()) return toast('Enter a description and a non-zero amount.');
    if (!(await ensureSignedIn('Sign in to save plans.'))) return;
    addPlan({ ...p, id: crypto.randomUUID(), accountId, category: p.category?.trim() || undefined });
    toast('Plan added.');
    setP(emptyBankPlan(accountId));
    onSaved?.();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Expected date">
          <TextInput
            type="date"
            value={p.date}
            onChange={(e) => setP({ ...p, date: e.target.value, recurrence: p.recurrence ? { ...p.recurrence, startDate: e.target.value } : undefined })}
          />
        </Field>
        <Field label="Description" width={160}>
          <TextInput value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} placeholder="e.g. Rent" />
        </Field>
        <Field label="Direction">
          <DirectionChips
            value={direction}
            onChange={(d) => setP({ ...p, amount: d === 'in' ? magnitude : -magnitude })}
            labels={{ in: 'Deposit', out: 'Withdrawal' }}
          />
        </Field>
        <Field label="Amount" width={110}>
          <TextInput
            type="number"
            step="0.01"
            min={0}
            value={magnitude || ''}
            onChange={(e) => setP({ ...p, amount: direction === 'in' ? Number(e.target.value) : -Number(e.target.value) })}
          />
        </Field>
        <Field label="Category (optional)" width={140}>
          <TextInput value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} />
        </Field>
        <RecurrenceFields startDate={p.date} value={p.recurrence} onChange={(recurrence) => setP({ ...p, recurrence })} />
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add plan
      </button>
    </div>
  );
}

function BankPlanList({ account }: { account: BankAccount }) {
  const allPlans = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const updatePlan = usePlannedBankWorkbookStore((s) => s.updateEntry);
  const deletePlan = usePlannedBankWorkbookStore((s) => s.deleteEntry);
  const addTransaction = useBankWorkbookStore((s) => s.addTransaction);
  const ensureSignedIn = useEnsureSignedIn();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PlannedBankTransaction | null>(null);

  const plans = useMemo(() => allPlans.filter((p) => p.accountId === account.id), [allPlans, account.id]);
  const sorted = useMemo(() => [...plans].sort((a, b) => a.date.localeCompare(b.date)), [plans]);

  const startEdit = (p: PlannedBankTransaction) => { setEditId(p.id); setEditRow({ ...p }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updatePlan(editId, editRow);
    toast('Plan updated.');
    setEditId(null);
    setEditRow(null);
  };

  const markDone = async (p: PlannedBankTransaction) => {
    const occurrenceDate = p.recurrence ? nextRecurrenceOccurrence(p.recurrence)?.toISOString().slice(0, 10) : p.date;
    if (!occurrenceDate) return toast('This plan has no more occurrences left (past its end date).');
    if (!(await ensureSignedIn('Sign in to save bank transactions.'))) return;
    addTransaction({
      id: crypto.randomUUID(),
      accountId: p.accountId,
      date: occurrenceDate,
      description: p.description,
      amount: p.amount,
      isDeposit: p.amount >= 0,
      category: p.category,
      source: 'manual',
    });
    if (p.recurrence) {
      updatePlan(p.id, { executedThrough: occurrenceDate });
      toast(`Marked ${occurrenceDate} as done — added to this account's transactions. This plan keeps recurring.`);
    } else {
      updatePlan(p.id, { executed: true });
      toast('Marked as done — added to this account\'s transactions.');
    }
  };

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Plans</h3>}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Repeats / status</th><th></th></tr>
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
                      style={{ width: 130 }}
                    />
                  </td>
                  <td><input value={editRow.description} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} /></td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 100 }} /></td>
                  <td><input value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} style={{ width: 100 }} /></td>
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
                  <td>{p.description}</td>
                  <td className={p.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(p.amount, account.currencyCode)}</td>
                  <td>{p.category || '—'}</td>
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
            {!sorted.length && <tr><td colSpan={6} className="text-muted">No plans for this account yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

// User-reported (2026-08-27, then again 2026-08-28: "Settings & 'Plans —
// account Synced...' still present, although clearly mentioned multiple
// times to move into single page"): this used to always render a card with
// a redundant sync-status line (duplicating the global /account hub's own
// Sync status section) even when there was nothing actionable to do. Now
// renders nothing unless the cloud genuinely looks empty and needs the
// user's explicit upload confirmation — same pattern as AccountSection.
function PlanningAccountSection({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const plans = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <Notice tone="warning" style={{ marginTop: 16 }}>
      <p style={{ marginTop: 0 }}>No data found in the cloud for this account's plans. This won't upload automatically.</p>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={async () => {
          const ok = await confirmDialog(
            `This will overwrite anything currently in the cloud for this account's plans (there is nothing there now, but confirming since this can't be undone).`,
            `Upload ${plans.length} local plan${plans.length === 1 ? '' : 's'} to the cloud?`,
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
        Upload local data to cloud ({plans.length} plans)
      </button>
    </Notice>
  );
}

/** README item 23 / MODULES_PLAN.md §11: per-module Analytics, Banking's
 * pass. An account picker (not a currency picker like Cash/Personal
 * Loans) since every chart here is naturally scoped to one account's own
 * transaction history — balance trend, category breakdown, and income vs.
 * spend by month all read `accountId`, not a currency. Also includes the
 * "simple budget/spend-plan tool" MODULES_PLAN.md §11 asks for: editable
 * monthly category targets (persisted in `settings.budgets`) compared
 * against this month's actual spend for the selected account. */
function AnalyticsTab() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const budgets = useBankWorkbookStore((s) => s.workbook.settings.budgets);
  const setBudget = useBankWorkbookStore((s) => s.setBudget);
  const ensureSignedIn = useEnsureSignedIn();
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const categoryList = useCategoryStore((s) => s.workbook.categories);

  const byCategory = useMemo(() => (account ? accountByCategory(account, transactions, categoryList) : {}), [account, transactions, categoryList]);
  const categories = Object.keys(byCategory).filter((c) => byCategory[c] < 0); // spend categories only — a doughnut of net credit/debit mixed together isn't meaningful
  const monthlyFlow = useMemo(() => (account ? bankMonthlyFlow(transactions, [account.id]) : []), [account, transactions]);
  const balanceOverTime = useMemo(() => (account ? accountRunningLedger(account, transactions) : []), [account, transactions]);

  const thisMonth = today().slice(0, 7);
  const budgetRows = useMemo(
    () => (account ? budgetVsActual(transactions, [account.id], budgets ?? {}, thisMonth, categoryList) : []),
    [account, transactions, budgets, thisMonth, categoryList],
  );
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState(0);

  if (!accounts.length) {
    return <p className="text-muted">Add a bank account first (Accounts tab) to see charts here.</p>;
  }

  return (
    <div>
      <Field label="Account" width={200}>
        <Select value={accountId || accounts[0].id} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
        </Select>
      </Field>
      {account && (
        <>
          <div className="grid-auto" style={{ ...gridAutoStyle(320, 16), marginTop: 12 }}>
            <ChartCard flat title="Balance over time" empty={!balanceOverTime.length}>
              <Line
                data={{
                  labels: balanceOverTime.map((r) => r.tx.date),
                  datasets: [{ label: 'Balance', data: balanceOverTime.map((r) => r.balance), borderColor: '#5aa9c9', backgroundColor: '#5aa9c933', fill: true, tension: 0.2 }],
                }}
                options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtMoney(v, account.currencyCode)) } }}
              />
            </ChartCard>
            <ChartCard flat title="Category breakdown (spend)" empty={!categories.length}>
              <Doughnut
                data={{
                  labels: categories,
                  datasets: [{ data: categories.map((c) => Math.abs(byCategory[c])), backgroundColor: categories.map((c) => tickerColor(c)) }],
                }}
                options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, account.currencyCode)) } }}
              />
            </ChartCard>
            <ChartCard flat title="Income vs. spend by month" empty={!monthlyFlow.length}>
              <Bar
                data={{
                  labels: monthlyFlow.map((f) => f.month),
                  datasets: [
                    { label: 'Income', data: monthlyFlow.map((f) => f.income), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                    { label: 'Expense', data: monthlyFlow.map((f) => f.expense), backgroundColor: cssVar('--loss') || '#e5484d' },
                  ],
                }}
                options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, account.currencyCode)) } }}
              />
            </ChartCard>
          </div>

          <CollapsibleCard title={<h3 style={{ margin: 0 }}>Budget — {thisMonth}</h3>} style={{ marginTop: 16 }}>
            <p className="text-muted" style={{ marginTop: 0 }}>
              Set a monthly spend target per category for {account.name}; compared against what you've actually
              spent there this month.
            </p>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Category</th><th>Budget</th><th>Actual</th><th>Remaining</th></tr></thead>
                <tbody>
                  {budgetRows.map((r) => (
                    <tr key={r.category}>
                      <td>{r.category}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="price-input"
                          defaultValue={r.budget || ''}
                          placeholder="—"
                          style={{ width: 96 }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              const val = parseFloat((e.target as HTMLInputElement).value) || 0;
                              if (await ensureSignedIn('Sign in to save a budget target.')) setBudget(r.category, val);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      </td>
                      <td className={r.budget > 0 && r.actual > r.budget ? 'pill-negative' : ''}>{fmtMoney(r.actual, account.currencyCode)}</td>
                      <td className={r.budget > 0 ? (r.budget - r.actual >= 0 ? 'pill-positive' : 'pill-negative') : ''}>
                        {r.budget > 0 ? fmtMoney(r.budget - r.actual, account.currencyCode) : '—'}
                      </td>
                    </tr>
                  ))}
                  {!budgetRows.length && <tr><td colSpan={4} className="text-muted">No spend or budget targets for this account yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <TextInput placeholder="New category" value={newBudgetCategory} onChange={(e) => setNewBudgetCategory(e.target.value)} style={{ width: 140 }} />
              <input
                type="number"
                step="0.01"
                placeholder="Monthly target"
                value={newBudgetAmount || ''}
                onChange={(e) => setNewBudgetAmount(Number(e.target.value))}
                style={{ width: 120 }}
              />
              <button
                className="btn secondary small"
                onClick={async () => {
                  if (!newBudgetCategory.trim() || !newBudgetAmount) return toast('Enter a category name and a target amount.');
                  if (!(await ensureSignedIn('Sign in to save a budget target.'))) return;
                  setBudget(newBudgetCategory.trim(), newBudgetAmount);
                  toast(`Budget set for ${newBudgetCategory.trim()}.`);
                  setNewBudgetCategory('');
                  setNewBudgetAmount(0);
                }}
              >
                <PlusIcon size={12} />Add budget category
              </button>
            </div>
          </CollapsibleCard>
        </>
      )}
    </div>
  );
}

export function PlanningTab({
  plannedCloudEmpty,
  uploadPlannedLocalToCloud,
}: {
  plannedSyncStatus?: string;
  plannedCloudEmpty: boolean;
  uploadPlannedLocalToCloud: () => Promise<void>;
}) {
  const { accounts, account, accountId, setAccountId } = useAccountPicker();

  if (!accounts.length) {
    return <p className="text-muted">Add a bank account first (Accounts tab) before planning transactions.</p>;
  }

  return (
    <div>
      <BalanceProjectionSummary />
      <Field label="Plans for account" width={220}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
        </Select>
      </Field>
      {account && (
        <div style={{ marginTop: 12 }}>
          <BankPlanList account={account} />
          <AddBankPlanFab accountId={account.id} />
        </div>
      )}
      <PlanningAccountSection cloudEmpty={plannedCloudEmpty} uploadLocalToCloud={uploadPlannedLocalToCloud} />
    </div>
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
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
      <div className="text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em', marginBottom: 8 }}>
        Data management
      </div>
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
        <button className="btn danger" onClick={clearAll}><TrashIcon size={12} />Clear all data</button>
      </div>
    </div>
  );
}

export function BankPage({
  cloudEmpty,
  uploadLocalToCloud,
  plannedCloudEmpty,
  uploadPlannedLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
  plannedSyncStatus: string;
  plannedCloudEmpty: boolean;
  uploadPlannedLocalToCloud: () => Promise<void>;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <h1 className="pagetitle" style={{ margin: 0 }}>Banking</h1>
        <Tooltip text="Bank account balances and transaction history, entered manually or imported from a CSV statement — no live bank connection (see Disclaimer & Privacy for why)." />
      </div>
      <Tabs
        tabs={[
          { key: 'accounts', label: 'Accounts', content: <AccountsTab /> },
          { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
          {
            key: 'planning',
            label: 'Planning',
            content: (
              <PlanningTab
                plannedCloudEmpty={plannedCloudEmpty}
                uploadPlannedLocalToCloud={uploadPlannedLocalToCloud}
              />
            ),
          },
          {
            key: 'settings',
            label: 'Settings',
            content: (
              <div>
                <p className="text-muted" style={{ marginTop: 0 }}>
                  Sign-in, profile, appearance, and a whole-app backup live on the{' '}
                  <Link to="/account">Account page →</Link>. What's below is specific to Banking.
                </p>
                <AccountSection cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
                <DataManagement />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
