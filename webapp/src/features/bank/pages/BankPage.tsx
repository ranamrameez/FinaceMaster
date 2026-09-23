import type { User } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, EntityCard, MoneyValue } from '../../../components/Card';
import { SummaryChip, type StandardCardAction } from '../../../components/StandardCard';
import { StandardPageSections, type StandardPageSection } from '../../../components/StandardPageSections';
import { TopBarControls, TopBarSelect } from '../../../components/TopBarControls';
import { TransactionFilterMenu } from '../../../components/TransactionFilterMenu';
import { UsageBar } from '../../../components/ui/UsageBar';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { ChartCard } from '../../qse/components/ChartCard';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { ArchiveIcon, CheckIcon, EditIcon, ExportIcon, ListIcon, PlusIcon, RestoreIcon, SaveIcon, StarIcon, TransferIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { RecordDetailModal } from '../../../components/RecordDetailModal';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { DateInput, Field, Select, TextInput } from '../../../components/ui/Field';
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
import { usePrimaryCurrency } from '../../../hooks/usePrimaryCurrency';
import { usePageFabActions } from '../../../hooks/usePageFabActions';
import { usePageTopBarRightSlot } from '../../../hooks/usePageTopBar';
import { useUrlTransactionFilters } from '../../../hooks/useUrlTransactionFilters';
import { allExtraActions, useFabActionsStore } from '../../../store/fabActionsStore';
import { ReorderButtons } from '../../../components/ui/ReorderButtons';
import { RecurrenceFields } from '../../../components/ui/RecurrenceFields';
import { PlanningHorizonField } from '../../../components/ui/PlanningHorizonField';
import { nextRecurrenceOccurrence } from '../../../lib/calc/recurrence';
import { recurrenceLabel } from '../../../lib/recurrenceLabel';
import { hueStyle } from '../../../lib/statCardHues';
import { categoryName, UNCATEGORIZED_ID } from '../../../lib/categories';
import { useCategoryStore } from '../../../store/categoryStore';
import { accountBalance, accountByCategory, accountPendingBalance, accountPeriodAnalytics, accountRunningLedger, bankAnalyticsFromLedger, bankTotalsByCurrency, budgetVsActual, totalBalanceByCurrency } from '../../../lib/calc/bankModule';
import { outstandingBalanceByCard } from '../../../lib/calc/creditCardModule';
import { isPlanDue, planWithinHorizon, plannedBankProjection, type PlanningHorizonDays } from '../../../lib/calc/plannedBalance';
import { dlBarV, dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { chartAlpha, chartDepthPlugin } from '../../../lib/chartVisuals';
import { parseCSV, toCSV } from '../../../lib/csv';
import { formatDate, fmtMoney, parseDateInput } from '../../../lib/format';
import { dateOnlyMs } from '../../../lib/datetime';
import { confirmAndDeleteLinkable, propagateLinkedEdit, resolveLinkedEdit } from '../../../lib/linkCascade';
import { isValidIbanFormat, lookupIban } from '../../../lib/ibanLookup';
import { banksForCurrency } from '../../../lib/bankDirectory';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { createEmptyBankWorkbook } from '../../../store/defaultBankWorkbook';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCreditCardWorkbookStore } from '../../../store/creditCardWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath, useLinkSideLabel } from '../../transfers/pages/TransferLinksPage';
import { CreditCardsTab } from './CreditCardsSection';
import type { BankAccount, BankTransaction } from '../../../types/bankWorkbook';
import type { CreditCard } from '../../../types/creditCard';
import type { PlannedBankTransaction } from '../../../types/plannedBank';
import { gridAutoStyle } from '../../../lib/gridStyle';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

function emptyAccount(defaultCurrency: string, bankId?: string): Omit<BankAccount, 'id'> {
  return { name: '', currencyCode: defaultCurrency, openingBalance: 0, bankId };
}

const ACCOUNT_TYPES = ['Savings', 'Current', 'Checking', 'Salary', 'Business', 'Fixed deposit'];

/* ============================== Accounts ============================== */

function TotalBalances() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const plannedEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const { num } = useAmountFormat();
  const totals = totalBalanceByCurrency(accounts, transactions);
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  // Not-yet-executed, near-term plans, per currency — surfaced here (not
  // just inside the Planning tab) so "how much is still hanging over my
  // balance" is visible at a glance without a click, per a user report
  // that stats didn't show upcoming/in-process planned payments at all.
  // Fixed 30-day ("This month") horizon, same default as the Planning
  // tab's own picker (2026-09-20) — see Cash's identical fix on
  // `BalancesSummary` for the full reasoning.
  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currencyCode]));
  const upcoming = plannedEntries.filter((p) => isPlanDue(p, new Date(), 30));

  return (
    <div className="grid-auto" style={{ ...gridAutoStyle(150, 8), marginBottom: 16 }}>
      {codes.map((code) => {
        const pending = upcoming.filter((p) => currencyByAccount.get(p.accountId) === code);
        const net = pending.reduce((s, p) => s + p.amount, 0);
        return (
          <div key={code} className="stat-card card" style={hueStyle(totals[code] >= 0 ? 'var(--profit)' : 'var(--loss)')}>
            <Tooltip text={`Sum of your bank accounts that use ${code} — no live currency conversion, just accounts that happen to share this currency.`}>
              <div className="label clickable">Accounts in {code}</div>
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
    <div className="row gap-sm mt-sm">
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
/** User-reported (2026-09-11): "CC is stuck in a popup" batch also found a
 * real, separate bug while checking — `Tabs.tsx`'s own "a chip click
 * force-opens a section without closing the others" design (see that
 * file's own comment) means Banking's Accounts/Credit Cards/Planning tabs
 * can easily all be open at once, each rendering its OWN independent
 * `FabPanel` at the identical fixed corner — confirmed live via Playwright
 * (two "Open actions" buttons stacked at the exact same coordinates).
 * Fixed by registering via the keyed `usePageFabActions` (same mechanism
 * QSE's/PSX's Transfers FAB already used for the single-writer case) —
 * `BankPage` itself renders the one merged `FabPanel` for the whole page. */
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
  const actions = useMemo(
    () => [
      { label: 'Add an account', icon: <PlusIcon />, onClick: () => setOpen('account') },
      { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
      // Pending item 115(a): grouped here rather than a second floating
      // button, so it can't stack/overlap with this panel (same class
      // of bug already fixed once for the app-wide Transfers FAB —
      // see Done item 239).
      { label: 'Add a bank', icon: <PlusIcon />, onClick: () => setOpen('bank') },
    ],
    [],
  );
  usePageFabActions('bank-accounts', actions);
  return (
    <>
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
          <div className="d-flex justify-center mt-md">
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
      <div className="row gap-sm mb-sm">
        <BankIdentityField value={value} onChange={onChange} idSuffix={idSuffix} />
      </div>
      <div className="row gap-sm">
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
      <div className="row gap-sm mt-sm">
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
      {/* User-requested: save an account number + the SMS sender details a
         bank alert actually arrives from, for a future SMS-based
         transaction-import feature (nothing reads these yet — this just
         gives that feature somewhere to read from). All optional, so
         skipping them changes nothing about today's add-account flow. */}
      <div className="row gap-sm mt-sm">
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
  const primaryCurrency = usePrimaryCurrency();
  const [lastCurrency, setLastCurrency] = useLastCurrency('bank-account', primaryCurrency ?? 'USD');
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
      <button className="btn mt-12" onClick={submit}>
        <PlusIcon />Add account
      </button>
      <p className="text-muted mt-sm"><span className="text-loss">*</span> Required. Everything else on this form is optional.</p>
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
 * collapsed-by-default `CollapsibleCard` — a Bank is purely optional
 * grouping, so most workbooks (no banks created yet) show nothing extra
 * here at all.
 *
 * User-reported (2026-09-14): "In the Accounts card, Parent Banks have a
 * separate card (which should be extracted on top, collapsed by
 * default)." It already WAS its own separate, collapsed-by-default card —
 * the real remaining problem was WHERE: nested inside the "Accounts" tab's
 * own content, sandwiched between the currency stat cards and the account
 * list, which read as buried rather than "extracted." Moved to render at
 * the PAGE level (see `BankPage`, above the whole `Tabs` component) — the
 * first thing on the page after the title, not nested one level down
 * inside a specific tab. */
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
        <button className="btn secondary small mb-12" onClick={() => setShowArchived((v) => !v)}>
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
              badge={b.isActive === false ? <span className="pill-warn fs-10">Closed</span> : undefined}
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
  // Excludes migrated accounts (see `BankAccount.migratedToCreditCardId`) —
  // once converted to a real `CreditCard` record, the old account is a
  // closed duplicate of the same real card, not a second account under
  // this bank (real bug, user-reported 2026-09-13: a migrated account was
  // still showing up here, clickable into its own separate, fully-editable
  // page — see `RepairStaleMigrations` in `CreditCardsSection.tsx`).
  const linkedAccounts = useMemo(() => accounts.filter((a) => a.bankId === id && !a.migratedToCreditCardId), [accounts, id]);
  const totals = useMemo(() => (bank ? bankTotalsByCurrency(bank.id, accounts, transactions) : {}), [bank, accounts, transactions]);
  const [addOpen, setAddOpen] = useState(false);
  // User-requested (2026-09-14): "CCs should be listed in all banks. we
  // can seperate it using <hr> after the accounts listing" — a card is a
  // structurally distinct entity from a `BankAccount` (see
  // `types/creditCard.ts`'s own file-level comment) but still belongs to
  // this same real institution, so it's surfaced here too, not just under
  // the module-wide "Credit Cards" tab.
  const allCards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  const cardTransactions = useCreditCardWorkbookStore((s) => s.workbook.transactions);
  const linkedCards = useMemo(() => allCards.filter((c) => c.bankId === id), [allCards, id]);

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
            <div className="row gap-sm mt-sm">
              <button className="btn" onClick={save}><SaveIcon />Save</button>
              <button className="btn secondary" onClick={() => setEditing(false)}><XIcon />Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            {bank.notes && <p className="text-muted mt-0">{bank.notes}</p>}
            <div className="row" style={{ gap: 16 }}>
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
      <div className="mt-md">
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
      {linkedCards.length > 0 && (
        <>
          <hr className="mt-md mb-md" />
          <h3 className="mt-0 mb-sm">Credit cards</h3>
          <div className="entity-card-grid">
            {linkedCards.map((c) => {
              const balance = Math.max(0, outstandingBalanceByCard(c, cardTransactions));
              return (
                <EntityCard
                  key={c.id}
                  title={c.name}
                  subtitle={<>{c.currencyCode}{c.cardNetwork ? ` · ${c.cardNetwork}` : ''}{c.creditLimit ? ` · Limit ${fmtMoney(c.creditLimit, c.currencyCode)}` : ''}</>}
                  badge={c.isActive === false ? <span className="pill-warn fs-10">Closed</span> : undefined}
                  statLabel="Owed"
                  stat={<MoneyValue n={balance} currency={c.currencyCode} />}
                  hue={balance > 0 ? 'var(--loss)' : 'var(--profit)'}
                  onClick={() => navigate(`/bank/card/${c.id}`)}
                />
              );
            })}
          </div>
        </>
      )}
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
 * visibility choice, not a "this account/money doesn't exist" claim.
 *
 * User-requested (2026-09-14): "CC should be listed in All accounts under
 * its currency, separated by a divider. A user may have only one currency
 * or he may deal in like 5! so the app must be capable to handle all
 * cases." Credit Cards are a genuinely separate entity/store
 * (`useCreditCardWorkbookStore`, see `types/creditCard.ts`'s own file-level
 * comment on why), so this pulls them in alongside plain accounts and
 * groups BOTH by currency — a currency group can now exist from a card
 * alone (no plain account in that currency yet), from an account alone, or
 * both; the divider only renders when a group actually has cards. */
function AccountsList() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateAccount = useBankWorkbookStore((s) => s.updateAccount);
  const cards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  const cardTransactions = useCreditCardWorkbookStore((s) => s.workbook.transactions);
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
  const cardSrNumOf = useMemo(() => new Map(cards.map((c, i) => [c.id, i + 1])), [cards]);

  const archivedCount = useMemo(
    () => accounts.filter((a) => a.isActive === false).length + cards.filter((c) => c.isActive === false).length,
    [accounts, cards],
  );
  const visibleAccounts = useMemo(
    () => (showArchived ? accounts : accounts.filter((a) => a.isActive !== false)),
    [accounts, showArchived],
  );
  const visibleCards = useMemo(
    () => (showArchived ? cards : cards.filter((c) => c.isActive !== false)),
    [cards, showArchived],
  );

  const toggleFavorite = async (a: BankAccount) => {
    if (!(await ensureSignedIn(a.isFavorite ? 'Sign in to unfavorite this account.' : 'Sign in to favorite this account.'))) return;
    updateAccount(a.id, { isFavorite: !a.isFavorite });
  };

  const currencyGroups = useMemo(() => {
    const byCurrency = new Map<string, { accounts: BankAccount[]; cards: CreditCard[] }>();
    const groupFor = (code: string) => {
      let g = byCurrency.get(code);
      if (!g) { g = { accounts: [], cards: [] }; byCurrency.set(code, g); }
      return g;
    };
    for (const a of visibleAccounts) groupFor(a.currencyCode).accounts.push(a);
    for (const c of visibleCards) groupFor(c.currencyCode).cards.push(c);
    // Favorites float to the top of each currency group; a stable sort
    // otherwise leaves creation order (matching Sr#) as the tiebreak.
    for (const g of byCurrency.values()) {
      g.accounts.sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite));
      g.cards.sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite));
    }
    return [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleAccounts, visibleCards]);

  if (!accounts.length && !cards.length) {
    return <p className="text-muted">No accounts yet — use the + button below to add one.</p>;
  }

  return (
    <div>
      {archivedCount > 0 && (
        <button
          className="btn secondary small mb-12"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? 'Hide' : 'Show'} closed ({archivedCount})
        </button>
      )}
      {!visibleAccounts.length && !visibleCards.length && (
        <p className="text-muted">Every account is closed — click "Show closed" above to see them.</p>
      )}
      {currencyGroups.map(([currency, group]) => {
        // User-requested (2026-09-06): "give sums in a tag for each
        // currency in header/label" — a quick total for whichever accounts
        // are actually visible in THIS group right now (respects the
        // "Show archived" toggle above), distinct from `TotalBalances`'
        // own top-of-page stat cards (which always include archived
        // accounts in their true grand total) — this is "what am I looking
        // at in this group," not "the real overall total." Credit card debt
        // is deliberately excluded from this tag (it's an amount OWED, the
        // opposite sense from a plain balance) — its own "Owed" figure sits
        // on each card's own EntityCard instead.
        const groupSum = group.accounts.reduce((s, a) => s + accountBalance(a, transactions), 0);
        return (
        <div key={currency} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em' }}>
              {currency}
            </span>
            {group.accounts.length > 0 && <span className="pill-info fs-11">{num(groupSum)} {currency}</span>}
          </div>
          {group.accounts.length > 0 && (
            <div className="entity-card-grid">
              {group.accounts.map((a) => (
                <EntityCard
                  key={a.id}
                  title={<><span className="text-muted entity-card-sr">#{srNumOf.get(a.id)}</span>{a.name}</>}
                  subtitle={[a.accountType, a.branch].filter(Boolean).join(' · ') || undefined}
                  badge={
                    a.isLiability || a.isActive === false ? (
                      <span style={{ display: 'flex', gap: 4 }}>
                        {a.isLiability && <span className="pill-negative fs-10">Credit card</span>}
                        {a.isActive === false && <span className="pill-warn fs-10">Closed</span>}
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
          )}
          {group.cards.length > 0 && (
            <>
              {group.accounts.length > 0 && <hr className="mt-sm mb-sm" />}
              <div className="entity-card-grid">
                {group.cards.map((c) => {
                  const balance = Math.max(0, outstandingBalanceByCard(c, cardTransactions));
                  return (
                    <EntityCard
                      key={c.id}
                      title={<><span className="text-muted entity-card-sr">#{cardSrNumOf.get(c.id)}</span>{c.name}</>}
                      subtitle={<>{c.cardNetwork ? `Credit card · ${c.cardNetwork}` : 'Credit card'}{c.creditLimit ? ` · Limit ${fmtMoney(c.creditLimit, c.currencyCode)}` : ''}</>}
                      badge={c.isActive === false ? <span className="pill-warn fs-10">Closed</span> : undefined}
                      statLabel="Owed"
                      stat={<MoneyValue n={balance} currency={c.currencyCode} />}
                      hue={balance > 0 ? 'var(--loss)' : 'var(--profit)'}
                      onClick={() => navigate(`/bank/card/${c.id}`)}
                    />
                  );
                })}
              </div>
            </>
          )}
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
  return (
    <UsageBar
      used={used}
      total={limit}
      leftLabel={`Used: ${fmtMoney(used, currency)}`}
      rightLabel={`Available: ${fmtMoney(Math.max(0, limit - used), currency)} of ${fmtMoney(limit, currency)}`}
    />
  );
}

export function AccountDetailPage() {
  const dateFormat = useAppearanceStore((state) => state.appearance.dateFormat ?? 'DD-MMM-YYYY');
  const { id } = useParams();
  const navigate = useNavigate();
  const accounts = useBankWorkbookStore((state) => state.workbook.settings.accounts);
  const banks = useBankWorkbookStore((state) => state.workbook.settings.banks ?? []);
  const account = accounts.find((item) => item.id === id);
  const transactions = useBankWorkbookStore((state) => state.workbook.transactions);
  const updateAccount = useBankWorkbookStore((state) => state.updateAccount);
  const deleteAccount = useBankWorkbookStore((state) => state.deleteAccount);
  const ensureSignedIn = useEnsureSignedIn();
  const plannedEntries = usePlannedBankWorkbookStore((state) => state.workbook.entries);
  const categories = useCategoryStore((state) => state.workbook.categories);
  const { num } = useAmountFormat();
  const { filters, setFilters, resetFilters, activeCount } = useUrlTransactionFilters();

  const accountToFormValue = (value: BankAccount | undefined): Omit<BankAccount, 'id'> => ({
    name: value?.name ?? '',
    currencyCode: value?.currencyCode ?? 'USD',
    openingBalance: value?.openingBalance ?? 0,
    accountNumber: value?.accountNumber,
    smsSenderId: value?.smsSenderId,
    smsSenderNumber: value?.smsSenderNumber,
    branch: value?.branch,
    accountType: value?.accountType,
    iban: value?.iban,
    bankName: value?.bankName,
    bic: value?.bic,
    isLiability: value?.isLiability,
    creditLimit: value?.creditLimit,
    annualFee: value?.annualFee,
    statementDate: value?.statementDate,
    paymentDueDate: value?.paymentDueDate,
    lateFeeAfterDue: value?.lateFeeAfterDue,
    minPaymentAmount: value?.minPaymentAmount,
    cardNetwork: value?.cardNetwork,
    cardBin: value?.cardBin,
    bankId: value?.bankId,
  });
  const [meta, setMeta] = useState<Omit<BankAccount, 'id'>>(() => accountToFormValue(account));
  const [editingMeta, setEditingMeta] = useState(false);

  const allLedger = useMemo(() => account ? accountRunningLedger(account, transactions) : [], [account, transactions]);
  const categoryOptions = useMemo(
    () => [...new Set(allLedger.map((row) => categoryName(row.tx.categoryID, categories)))].sort(),
    [allLedger, categories],
  );
  const filteredLedger = useMemo(() => allLedger.filter((row) => {
    if (row.tx.date < filters.fromDate || row.tx.date > filters.toDate) return false;
    if (filters.direction === 'in' && row.tx.amount < 0) return false;
    if (filters.direction === 'out' && row.tx.amount >= 0) return false;
    if (filters.category !== 'all' && categoryName(row.tx.categoryID, categories) !== filters.category) return false;
    if (filters.source !== 'all' && (row.tx.source ?? 'manual') !== filters.source) return false;
    return true;
  }), [allLedger, filters, categories]);
  const analytics = useMemo(() => bankAnalyticsFromLedger(filteredLedger), [filteredLedger]);
  const upcoming = useMemo(
    () => account
      ? plannedEntries
          .filter((plan) => plan.accountId === account.id && !plan.executed)
          .filter((plan) => plan.date >= filters.fromDate && plan.date <= filters.toDate)
          .filter((plan) => filters.direction === 'all' || (filters.direction === 'in' ? plan.amount >= 0 : plan.amount < 0))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [],
    [plannedEntries, account, filters.fromDate, filters.toDate, filters.direction],
  );

  usePageTopBarRightSlot(account ? (
    <TopBarControls>
      <TopBarSelect
        label="Switch bank"
        value={account.bankId ?? ''}
        onChange={(event) => {
          const bankId = event.target.value;
          navigate(bankId ? `/bank/bank/${bankId}` : '/bank');
        }}
        options={[
          { value: '', label: 'All banks' },
          ...banks.filter((bank) => bank.isActive !== false).map((bank) => ({ value: bank.id, label: bank.name })),
        ]}
      />
      <TransactionFilterMenu
        value={filters}
        categories={categoryOptions}
        activeCount={activeCount}
        onChange={setFilters}
        onClear={resetFilters}
      />
    </TopBarControls>
  ) : null);

  if (!account) {
    return <div className="standard-page"><Link to="/bank" className="text-muted">← Back to Banking</Link><p className="text-muted mt-12">Account not found.</p></div>;
  }

  const saveMeta = async () => {
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
    setEditingMeta(false);
    toast('Account details saved.');
  };
  const cancelMetaEdit = () => { setMeta(accountToFormValue(account)); setEditingMeta(false); };
  const deleteThisAccount = async () => {
    if (!(await confirmDialog('This deletes the account and all its transactions — this cannot be undone.', `Delete "${account.name}"?`))) return;
    deleteAccount(account.id);
    toast('Account deleted.');
    navigate('/bank');
  };
  const toggleArchived = async () => {
    if (!(await ensureSignedIn(account.isActive === false ? 'Sign in to reopen this account.' : 'Sign in to close this account.'))) return;
    updateAccount(account.id, { isActive: account.isActive === false ? true : false });
    toast(account.isActive === false ? 'Account reopened.' : 'Account closed.');
  };

  const currentBalance = accountBalance(account, transactions);
  const displayBalance = account.isLiability ? Math.max(0, -currentBalance) : currentBalance;
  const pendingAmount = accountPendingBalance(account, transactions);

  const exportTransactions = () => {
    const header = ['#', 'Date', 'Description', 'Category', 'Amount', 'Balance', 'Source'];
    const body = [...filteredLedger].reverse().map(({ tx, balance }) => [
      tx.serialNumber ?? '', tx.date, tx.description, categoryName(tx.categoryID, categories), tx.amount, balance,
      tx.source === 'statement-import' ? `Imported${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual',
    ]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${account.name.replace(/\s+/g, '_')}_transactions_${filters.fromDate}_to_${filters.toDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast(`${body.length} transaction${body.length === 1 ? '' : 's'} downloaded.`);
  };

  const detailActions: StandardCardAction[] = editingMeta
    ? [
        { label: 'Save', onClick: saveMeta },
        { label: 'Cancel', onClick: cancelMetaEdit },
        { label: account.isActive === false ? 'Reopen account' : 'Close account', onClick: toggleArchived },
        { label: 'Delete account', onClick: deleteThisAccount, tone: 'danger' },
      ]
    : [
        { label: 'Edit', onClick: () => setEditingMeta(true) },
        { label: account.isActive === false ? 'Reopen account' : 'Close account', onClick: toggleArchived },
        { label: 'Delete account', onClick: deleteThisAccount, tone: 'danger' },
      ];

  const sections: StandardPageSection[] = [
    {
      key: 'details',
      label: 'Account details',
      summary: <>
        <SummaryChip label={account.isLiability ? 'Owed' : 'Balance'} value={`${num(displayBalance)} ${account.currencyCode}`} />
        {pendingAmount !== 0 && <SummaryChip label="Pending" value={`${pendingAmount > 0 ? '+' : ''}${num(pendingAmount)} ${account.currencyCode}`} />}
      </>,
      actions: detailActions,
      content: <>
        {!editingMeta ? (
          <AttributeList items={[
            { label: 'Name', value: account.name },
            { label: 'Currency', value: account.currencyCode },
            { label: 'Opening balance', value: fmtMoney(account.openingBalance, account.currencyCode) },
            { label: 'Branch', value: account.branch },
            { label: 'Account type', value: account.accountType },
            { label: 'IBAN', value: account.iban },
            { label: 'Bank name', value: account.bankName },
            { label: 'BIC', value: account.bic },
            { label: 'Account number', value: account.accountNumber },
            { label: 'SMS sender ID', value: account.smsSenderId },
            { label: 'SMS sender number', value: account.smsSenderNumber },
          ]} />
        ) : (
          <AccountFormFields value={meta} onChange={(patch) => setMeta((current) => ({ ...current, ...patch }))} idSuffix="detail" />
        )}
        {account.isLiability && account.creditLimit ? <CreditUsageBar used={Math.max(0, -currentBalance)} limit={account.creditLimit} currency={account.currencyCode} /> : null}
      </>,
    },
    ...(upcoming.length ? [{
      key: 'plans',
      label: 'Upcoming plans',
      summary: <SummaryChip label="Visible" value={upcoming.length} />,
      content: <div className="table-scroll"><table><thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead><tbody>
        {upcoming.map((plan) => <tr key={plan.id}><td>{formatDate(plan.date, dateFormat)}</td><td>{plan.description}</td><td className={plan.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(plan.amount, account.currencyCode)}</td></tr>)}
      </tbody></table></div>,
    } satisfies StandardPageSection] : []),
    {
      key: 'transactions',
      label: 'Transactions',
      summary: <SummaryChip label="Filtered" value={filteredLedger.length} />,
      actions: [{ label: 'Export filtered CSV', onClick: exportTransactions, disabled: !filteredLedger.length }],
      content: <TransactionsList account={account} ledger={filteredLedger} allLedgerCount={allLedger.length} />,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      summary: <>
        <SummaryChip label="Deposits" value={fmtMoney(analytics.deposits, account.currencyCode)} />
        <SummaryChip label="Withdrawals" value={fmtMoney(analytics.withdrawals, account.currencyCode)} />
        <SummaryChip label="Net" value={fmtMoney(analytics.netFlow, account.currencyCode)} />
      </>,
      content: <AccountAnalyticsSection account={account} ledger={filteredLedger} />,
    },
  ];

  return (
    <div className="standard-page">
      <div className="page-heading">
        <div>
          <Link to="/bank" className="text-muted">← Back to Banking</Link>
          <div className="page-heading-title-row"><h1 className="pagetitle m-0">{account.name}</h1>{account.isActive === false && <span className="pill-warn fs-11">Closed</span>}</div>
        </div>
      </div>
      {account.migratedToCreditCardId && <Notice tone="info" className="mb-md">This account was migrated to a real Credit Card record — its transactions and balance now live there.{' '}<Link to={`/bank/card/${account.migratedToCreditCardId}`}>View the Credit Card →</Link></Notice>}
      <StandardPageSections sections={sections} defaultKey="details" />
      <AccountTransfersFab accountId={account.id} currencyCode={account.currencyCode} />
    </div>
  );
}

function AccountsTab()
function AccountsTab() {
  return (
    <div>
      <TotalBalances />
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
  const actionsByKey = useFabActionsStore((s) => s.actionsByKey);
  const fabActions = allExtraActions(actionsByKey);
  const actions = useMemo(
    () => [{ label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen(true) }],
    [],
  );
  usePageFabActions('bank-account-detail', actions);
  return (
    <>
      <FabPanel actions={fabActions} />
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
    const choice = await resolveLinkedEdit('bank', tx.id);
    if (choice === 'cancel') return;
    updateTransaction(tx.id, draft);
    let msg = 'Transaction updated.';
    if (choice === 'both') {
      const result = propagateLinkedEdit('bank', tx.id, { date: draft.date, amount: Math.abs(draft.amount), note: draft.description });
      if (result.error) msg = result.error;
      else if (result.message) msg = result.message;
    }
    toast(msg);
    onClose();
  };

  return (
    <FinanceEditModal titleText="Edit transaction" onClose={onClose} onSave={save}>
      <div className="row gap-sm">
        <Field label="Date">
          <DateInput value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
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
      <div className="mt-sm">
        <PendingToggle
          checked={!!draft.isPending}
          onChange={(v) => setDraft({ ...draft, isPending: v })}
          label="Pending (not yet cleared)"
          title="Not yet cleared — excluded from Current balance until unchecked."
        />
      </div>
      <p className="text-muted mt-sm">
        {draft.source === 'statement-import' ? `Imported${draft.statementRef ? ` from ${draft.statementRef}` : ''}` : 'Entered manually'}
      </p>
    </FinanceEditModal>
  );
}

/** User-requested (2026-09-03): "add filters to other tables as well" —
 * extends the Type/Category filter treatment Cash's statement tables got
 * (README Done item 224) here too. */
function TransactionsList({ account, ledger, allLedgerCount }: { account: BankAccount; ledger: ReturnType<typeof accountRunningLedger>; allLedgerCount: number }) {
  const dateFormat = useAppearanceStore((state) => state.appearance.dateFormat ?? 'DD-MMM-YYYY');
  const updateTransaction = useBankWorkbookStore((state) => state.updateTransaction);
  const deleteTransaction = useBankWorkbookStore((state) => state.deleteTransaction);
  const categories = useCategoryStore((state) => state.workbook.categories);
  const links = useInterEntityTransfersStore((state) => state.workbook.entries);
  const ensureSignedIn = useEnsureSignedIn();
  const sideLabel = useLinkSideLabel();
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);
  const [detailTx, setDetailTx] = useState<BankTransaction | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sorted = useMemo(() => [...ledger].reverse(), [ledger]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => sorted.slice((safePage - 1) * pageSize, safePage * pageSize), [sorted, safePage, pageSize]);
  useEffect(() => setPage(1), [ledger, pageSize]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const linkByRecordId = useMemo(() => {
    const map = new Map<string, (typeof links)[number]>();
    for (const link of links) {
      if (link.from.module === 'bank') map.set(link.fromRecordId, link);
      if (link.to.module === 'bank') map.set(link.toRecordId, link);
    }
    return map;
  }, [links]);

  const instantOf = (row: (typeof sorted)[number]) => dateOnlyMs(row.tx.date);
  const reorder = async (pair: [{ id: string; order: number }, { id: string; order: number }]) => {
    if (!(await ensureSignedIn('Sign in to reorder transactions.'))) return;
    for (const item of pair) updateTransaction(item.id, { serialNumber: item.order });
  };

  return <>
    <div className="section-toolbar"><ImportStatementSection account={account} compact /></div>
    <div className="table-scroll"><table>
      <thead><tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Balance</th><th>Source</th><th></th></tr></thead>
      <tbody>
        {pageRows.map(({ tx, balance }, index) => {
          const link = linkByRecordId.get(tx.id);
          const otherSide = link ? (link.from.module === 'bank' && link.fromRecordId === tx.id ? link.to : link.from) : undefined;
          return <tr key={tx.id} onClick={() => setDetailTx(tx)} className="clickable">
            <td className="text-muted">{tx.serialNumber ?? '—'}{' '}<span onClick={(event) => event.stopPropagation()}><ReorderButtons rows={sorted} index={(safePage - 1) * pageSize + index} instantOf={instantOf} idOf={(row) => row.tx.id} orderOf={(row) => row.tx.serialNumber} onMove={reorder} /></span></td>
            <td>{formatDate(tx.date, dateFormat)}</td>
            <td className="cell-clip" title={tx.description} onClick={(event) => event.stopPropagation()}>{tx.description}{tx.isPending && <span className="pill-warn ml-6">Pending</span>}{link && <Link to={linkTargetPath(otherSide!)} className="pill-info ml-6">🔗 {sideLabel(link.from)} → {sideLabel(link.to)}</Link>}</td>
            <td><span className="pill-info">{categoryName(tx.categoryID, categories)}</span></td>
            <td className={tx.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(tx.amount, account.currencyCode)}</td>
            <td>{fmtMoney(balance, account.currencyCode)}</td>
            <td className="text-muted cell-clip">{tx.source === 'statement-import' ? `Import${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual'}</td>
            <td onClick={(event) => event.stopPropagation()}>
              {tx.isPending && <IconButton label="Mark cleared" icon={<CheckIcon size={13} />} align="right" onClick={async()=>{if(!(await ensureSignedIn('Sign in to update this transaction.')))return;updateTransaction(tx.id,{isPending:false});toast('Marked cleared.');}} />}{' '}
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => setEditingTx(tx)} />{' '}
              <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => confirmAndDeleteLinkable('bank', tx.id, () => deleteTransaction(tx.id))} />
            </td>
          </tr>;
        })}
        {!sorted.length && <tr><td colSpan={8} className="text-muted">{allLedgerCount ? 'No transactions match the page filters.' : 'No transactions for this account yet.'}</td></tr>}
      </tbody>
    </table></div>
    <div className="pagination-bar">
      <div className="text-muted">{sorted.length ? `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length}` : 'No rows'}</div>
      <div className="pagination-actions">
        <Field label="Rows" width={78}><Select value={String(pageSize)} onChange={(event)=>setPageSize(Number(event.target.value))}><option value="25">25</option><option value="50">50</option><option value="100">100</option></Select></Field>
        <button type="button" className="btn secondary small" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span className="text-muted">Page {safePage} of {pageCount}</span>
        <button type="button" className="btn secondary small" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
      </div>
    </div>
    {editingTx && <EditTransactionModal tx={editingTx} onClose={() => setEditingTx(null)} />}
    {detailTx && <RecordDetailModal title={detailTx.amount >= 0 ? 'Deposit' : 'Withdrawal'} onClose={() => setDetailTx(null)} fields={[
      { label: '#', value: detailTx.serialNumber ?? '—' }, { label: 'Date', value: formatDate(detailTx.date, dateFormat) }, { label: 'Time', value: detailTx.time ?? '— (defaults to noon)' },
      { label: 'Timezone', value: detailTx.timezone ?? '—' }, { label: 'Description', value: detailTx.description || '—' }, { label: 'Category', value: categoryName(detailTx.categoryID, categories) },
      { label: 'Amount', value: fmtMoney(detailTx.amount, account.currencyCode) }, { label: 'Source', value: detailTx.source === 'statement-import' ? `Imported${detailTx.statementRef ? ` (${detailTx.statementRef})` : ''}` : 'Manual' },
      { label: 'Status', value: detailTx.isPending ? 'Pending (not yet cleared)' : 'Cleared' },
    ]} />}
  </>;
}

/** Renders just the category table
/** Renders just the category table (no card wrapper of its own) — the
 * caller (`AccountDetailPage`) supplies the `CollapsibleCard` so this
 * never nests a card inside a card (rule 1). */
/** Per-account Analytics grid on `AccountDetailPage` — user-requested
 * 2026-09-06 (see that page's own call-site comment for the exact
 * wording). Reuses the SAME three chart shapes as the whole-module
 * `AnalyticsTab` below (Balance over time / Deposits vs. withdrawals by month /
 * Category breakdown), pre-scoped to this one account instead of needing
 * an account picker — "Balance over time" and "Deposits vs. withdrawals by month"
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
function AccountAnalyticsSection({ account, ledger }: { account: BankAccount; ledger: ReturnType<typeof accountRunningLedger> }) {
  const dateFormat = useAppearanceStore((state) => state.appearance.dateFormat ?? 'DD-MMM-YYYY');
  const categories = useCategoryStore((state) => state.workbook.categories);
  useAppearanceStore((state) => state.appearance);
  applyChartTheme();

  const analytics = useMemo(() => bankAnalyticsFromLedger(ledger), [ledger]);
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of ledger) {
      const name = categoryName(row.tx.categoryID, categories);
      totals[name] = (totals[name] ?? 0) + Math.abs(row.tx.amount);
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [ledger, categories]);

  if (!ledger.length) return <p className="text-muted m-0">No transactions match the page filters.</p>;

  const profit = cssVar('--profit') || '#3ecf8e';
  const loss = cssVar('--loss') || '#e5484d';

  return <div className="analytics-grid">
    <div className="analytics-chart"><h4>Balance over time</h4><div className="chart-canvas-wrap"><Line plugins={[chartDepthPlugin]} data={{labels:ledger.map((row)=>formatDate(row.tx.date,dateFormat)),datasets:[{label:'Balance',data:ledger.map((row)=>row.balance),borderColor:chartAlpha('#5aa9c9',.82),backgroundColor:chartAlpha('#5aa9c9',.24),fill:true,tension:.24,pointRadius:2}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},datalabels:{display:false}}}} /></div></div>
    <div className="analytics-chart"><h4>Transactions by category</h4><div className="chart-canvas-wrap"><Doughnut plugins={[chartDepthPlugin]} data={{labels:categoryTotals.map(([name])=>name),datasets:[{data:categoryTotals.map(([,amount])=>amount),backgroundColor:categoryTotals.map(([name])=>chartAlpha(tickerColor(name),.58)),borderColor:categoryTotals.map(([name])=>chartAlpha(tickerColor(name),.85)),borderWidth:2,hoverOffset:8}]}} options={{responsive:true,maintainAspectRatio:false,cutout:'48%',rotation:-25,plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:10,padding:8}},datalabels:{display:false}},layout:{padding:8}}} /></div></div>
    <div className="analytics-chart"><h4>Deposits vs. withdrawals</h4><div className="chart-canvas-wrap"><Bar plugins={[chartDepthPlugin]} data={{labels:analytics.monthlyFlow.map((flow)=>flow.month),datasets:[{label:'Deposits',data:analytics.monthlyFlow.map((flow)=>flow.income),backgroundColor:chartAlpha(profit,.58),borderColor:chartAlpha(profit,.88),borderWidth:2,borderRadius:6},{label:'Withdrawals',data:analytics.monthlyFlow.map((flow)=>flow.expense),backgroundColor:chartAlpha(loss,.58),borderColor:chartAlpha(loss,.88),borderWidth:2,borderRadius:6}]}} options={{plugins:{datalabels:{display:false}}}} /></div></div>
  </div>;
}

/* ============================== Statement import ============================== */

/** User-reported (2026-08-27): "Import CSV should belong an account, rather
 * than hey look here, i am a very big card with just one button! DO NOT DO
 * THAT!" — this used to be its own top-level tab with its own account
 * picker (exactly the "DO NOT ask user on the main screen to use
 * selectboxes to alter info" pattern the user separately called out).
 * Scoped to the account whose detail page it's embedded in — no picker,
 * since there's nothing to pick, the account is already known. */
function ImportStatementSection({ account, compact = false }: { account: BankAccount; compact?: boolean }) {
  const dateFormat = useAppearanceStore((s) => s.appearance.dateFormat ?? 'DD-MMM-YYYY');
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const addTransactions = useBankWorkbookStore((s) => s.addTransactions);
  const replaceTransactions = useBankWorkbookStore((s) => s.replaceTransactions);
  const ensureSignedIn = useEnsureSignedIn();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  const [flipSign, setFlipSign] = useState(false);

  const reset = () => { setOpen(false); setFileName(''); setHeaders([]); setRows([]); setDateCol(''); setDescCol(''); setAmountCol(''); setFlipSign(false); };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result));
      if (parsed.length < 2) return toast('Could not find any data rows in that file.');
      const [head, ...body] = parsed;
      setFileName(file.name); setHeaders(head); setRows(body);
      setDateCol(head[0] ?? ''); setDescCol(head[1] ?? ''); setAmountCol(head[2] ?? ''); setOpen(true);
    };
    reader.readAsText(file);
  };

  const colIndex = (col: string) => headers.indexOf(col);
  const parseImportedDate = (raw: string): string | null => {
    const formats = ['DD-MMM-YYYY','YYYY-MMM-DD','DD-MM-YYYY','MM-DD-YYYY','DD/MM/YYYY','MM/DD/YYYY'] as const;
    for (const format of formats) { const parsed = parseDateInput(raw, format); if (parsed) return parsed; }
    return null;
  };

  const mappedRows = useMemo(() => rows.map((r, index) => {
    const rawDate = (r[colIndex(dateCol)] ?? '').trim();
    const date = parseImportedDate(rawDate);
    const description = (r[colIndex(descCol)] ?? '').trim();
    const amount = Number(r[colIndex(amountCol)] ?? 0) * (flipSign ? -1 : 1);
    return { index, rawDate, date, description, amount, valid: Boolean(date && description && !Number.isNaN(amount) && amount !== 0) };
  }), [rows, dateCol, descCol, amountCol, flipSign]);

  const fingerprint = (t: { date: string; description: string; amount: number }) => t.date + '|' + t.description.trim().toLowerCase().replace(/\s+/g, ' ') + '|' + t.amount.toFixed(8);
  const existingByFingerprint = useMemo(() => {
    const map = new Map<string, BankTransaction>();
    transactions.filter((t) => t.accountId === account.id).forEach((t) => map.set(fingerprint(t), t));
    return map;
  }, [transactions, account.id]);

  const validRows = mappedRows.filter((r) => r.valid && r.date) as Array<typeof mappedRows[number] & { date: string }>;
  const duplicateRows = useMemo(() => validRows.filter((r) => existingByFingerprint.has(fingerprint({ date: r.date, description: r.description, amount: r.amount }))), [validRows, existingByFingerprint]);
  const uniqueRows = useMemo(() => {
    const seen = new Set<string>();
    return validRows.filter((r) => { const key = fingerprint({ date: r.date, description: r.description, amount: r.amount }); if (seen.has(key)) return false; seen.add(key); return true; });
  }, [validRows]);

  const buildTransactions = (rowsToImport: typeof validRows): BankTransaction[] => rowsToImport.map((r) => ({
    id: uid(), accountId: account.id, date: r.date, description: r.description, amount: r.amount, isDeposit: r.amount >= 0,
    source: 'statement-import' as const, statementRef: fileName,
  }));

  const doImport = async (mode: 'new-only' | 'replace' | 'keep-all') => {
    if (!dateCol || !descCol || !amountCol) return toast('Map all three columns before importing.');
    if (!validRows.length) return toast('No valid rows found. Check the date, description and amount mappings.');
    if (!(await ensureSignedIn('Sign in to import transactions.'))) return;
    const duplicateIds = duplicateRows.map((r) => existingByFingerprint.get(fingerprint({ date: r.date, description: r.description, amount: r.amount }))?.id).filter(Boolean) as string[];
    const rowsToImport = mode === 'keep-all'
      ? validRows
      : uniqueRows.filter((r) => mode === 'replace' || !existingByFingerprint.has(fingerprint({ date: r.date, description: r.description, amount: r.amount })));
    if (mode === 'replace') replaceTransactions(duplicateIds, buildTransactions(rowsToImport));
    else addTransactions(buildTransactions(rowsToImport));
    const skipped = validRows.length - rowsToImport.length;
    toast((mode === 'replace' ? 'Imported and replaced' : 'Imported') + ' ' + rowsToImport.length + ' transaction' + (rowsToImport.length === 1 ? '' : 's') + (skipped ? '; skipped ' + skipped + ' duplicate' + (skipped === 1 ? '' : 's') : '') + '.');
    reset();
  };

  return (
    <div>
      {compact && <button className="btn secondary small" onClick={() => fileInput.current?.click()}><PlusIcon size={13} />Import</button>}
      {!compact && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span className="text-muted">Import a CSV export from your bank into {account.name}.</span>
        <Tooltip text="Choose a CSV, map its columns, review the import, then confirm. Existing matching transactions are detected by date + description + amount so importing the same statement again does not create duplicates." />
      </div>}
      {!compact && <button className="btn secondary" onClick={() => fileInput.current?.click()}>Choose CSV file</button>}
      <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden-file-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''; }} />

      {open && (
        <Modal title={`Import statement — ${fileName}`} onClose={reset} width="900px">
          <div className="row gap-sm">
            <Field label="Date column" width={180}><Select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</Select></Field>
            <Field label="Description column" width={220}><Select value={descCol} onChange={(e) => setDescCol(e.target.value)}>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</Select></Field>
            <Field label="Amount column" width={180}><Select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</Select></Field>
            <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 20 }}><input type="checkbox" checked={flipSign} onChange={(e) => setFlipSign(e.target.checked)} />Flip sign</label>
          </div>
          <div className="grid-auto mt-md" style={gridAutoStyle(150, 8)}>
            <div className="stat-card card"><div className="label">CSV rows</div><strong>{rows.length}</strong></div>
            <div className="stat-card card"><div className="label">Valid rows</div><strong>{validRows.length}</strong></div>
            <div className="stat-card card"><div className="label">New transactions</div><strong>{uniqueRows.filter((r) => !existingByFingerprint.has(fingerprint({ date: r.date, description: r.description, amount: r.amount }))).length}</strong></div>
            <div className="stat-card card"><div className="label">Existing duplicates</div><strong className={duplicateRows.length ? 'pill-negative' : 'pill-positive'}>{duplicateRows.length}</strong></div>
          </div>
          <h4>Preview</h4>
          <div className="table-scroll" style={{ maxHeight: 360 }}>
            <table><thead><tr><th>#</th><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{mappedRows.slice(0, 100).map((r) => {
                const duplicate = r.valid && r.date ? existingByFingerprint.has(fingerprint({ date: r.date, description: r.description, amount: r.amount })) : false;
                return <tr key={r.index}><td>{r.index + 1}</td><td>{r.date ? formatDate(r.date, dateFormat) : r.rawDate || '—'}</td><td>{r.description}</td><td className={r.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{Number.isFinite(r.amount) ? fmtMoney(r.amount, account.currencyCode) : 'Invalid'}</td><td className={r.valid ? (duplicate ? 'text-loss' : 'text-profit') : 'text-loss'}>{r.valid ? (duplicate ? 'Duplicate' : 'New') : 'Invalid'}</td></tr>;
              })}</tbody>
            </table>
          </div>
          {rows.length > 100 && <p className="text-muted">Showing first 100 of {rows.length} rows in the preview.</p>}
          {duplicateRows.length > 0 && <Notice tone="warning" className="mt-md"><strong>{duplicateRows.length} matching transaction{duplicateRows.length === 1 ? '' : 's'} already exist.</strong><div className="text-muted mt-sm">Import new only skips them. Replace duplicates overwrites matching existing transactions and requires confirmation.</div></Notice>}
          <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={reset}>Cancel</button>
            <Tooltip text="Skip rows that already exist in this account, based on date + description + amount. New rows are imported.">
              <button className="btn" disabled={!validRows.length} onClick={() => doImport('new-only')}><PlusIcon />Import new only</button>
            </Tooltip>
            {duplicateRows.length > 0 && <Tooltip text="Replace matching existing transactions with the CSV version. This requires confirmation because the existing records are overwritten.">
              <button className="btn danger" onClick={() => {
  void confirmDialog(
    `This will replace ${duplicateRows.length} existing matching transaction${duplicateRows.length === 1 ? '' : 's'} with the CSV version. This cannot be undone.`,
    'Confirm overwrite?',
  ).then((ok) => {
    if (ok) void doImport('replace');
  });
}}>Replace duplicates</button>
            </Tooltip>}
            {duplicateRows.length > 0 && <Tooltip text="Import every valid CSV row, including rows already detected as duplicates. Use this when you want to review and handle duplicates yourself after import.">
              <button className="btn secondary" disabled={!validRows.length} onClick={() => doImport('keep-all')}>Keep all</button>
            </Tooltip>}
          </div>
        </Modal>
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
        <Notice tone="warning" className="mt-sm">
          <p className="mt-0">
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

function BalanceProjectionSummary({ horizonDays }: { horizonDays: PlanningHorizonDays }) {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const plannedEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const settings = usePlannedBankWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePlannedBankWorkbookStore((s) => s.updateSettings);
  const projection = useMemo(
    () => plannedBankProjection(accounts, transactions, plannedEntries, new Date(), horizonDays),
    [accounts, transactions, plannedEntries, horizonDays],
  );
  const codes = Object.keys(projection);

  return (
    <CollapsibleCard
      title={
        <Tooltip text="See what your total balance would look like if every plan due within the chosen time period actually happened — a reality check before you spend.">
          <h3 style={{ margin: 0, cursor: 'pointer' }}>Balance projection</h3>
        </Tooltip>
      }
      className="mb-md"
    >
      <div className="row" style={{ gap: 16, marginBottom: 12 }}>
        <label className="text-muted flex-center-gap4">
          <input type="checkbox" checked={settings.showRealBalance} onChange={(e) => updateSettings({ showRealBalance: e.target.checked })} />
          Real balance
        </label>
        <label className="text-muted flex-center-gap4">
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
 * (Done item 166) and "Add an account" above.
 *
 * 2026-09-11: registers via the keyed `usePageFabActions` instead of
 * rendering its own `FabButton` — see `AccountsFab`'s own comment on the
 * real FAB-stacking bug this fixes (Planning is a third simultaneous
 * contributor alongside Accounts/Credit Cards once more than one Banking
 * tab is open at once). */
function AddBankPlanFab({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const actions = useMemo(() => [{ label: 'Add a plan', icon: <PlusIcon />, onClick: () => setOpen(true) }], []);
  usePageFabActions('bank-planning', actions);
  return (
    <>
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
      <div className="row gap-sm">
        <Field label="Expected date">
          <DateInput
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
      <button className="btn mt-12" onClick={submit}>
        <PlusIcon />Add plan
      </button>
    </div>
  );
}

function BankPlanList({ account, horizonDays }: { account: BankAccount; horizonDays: PlanningHorizonDays }) {
  const dateFormat = useAppearanceStore((s) => s.appearance.dateFormat ?? 'DD-MMM-YYYY');
  const allPlans = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const updatePlan = usePlannedBankWorkbookStore((s) => s.updateEntry);
  const deletePlan = usePlannedBankWorkbookStore((s) => s.deleteEntry);
  const addTransaction = useBankWorkbookStore((s) => s.addTransaction);
  const ensureSignedIn = useEnsureSignedIn();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PlannedBankTransaction | null>(null);
  const asOf = useMemo(() => new Date(), []);

  const plans = useMemo(
    () => allPlans.filter((p) => p.accountId === account.id && planWithinHorizon(p, asOf, horizonDays)),
    [allPlans, account.id, horizonDays, asOf],
  );
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
    <CollapsibleCard title={<h3 className="m-0">Plans</h3>}>
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
                    <DateInput
                      value={editRow.date}
                      onChange={(e) => setEditRow({ ...editRow, date: e.target.value, recurrence: editRow.recurrence ? { ...editRow.recurrence, startDate: e.target.value } : undefined })}
                      width={130}
                    />
                  </td>
                  <td><input value={editRow.description} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} /></td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} className="w-100" /></td>
                  <td><input value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} className="w-100" /></td>
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
                  <td>{formatDate(p.date, dateFormat)}</td>
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
    <Notice tone="warning" className="mt-md">
      <p className="mt-0">No data found in the cloud for this account's plans. This won't upload automatically.</p>
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
  const dateFormat = useAppearanceStore((s) => s.appearance.dateFormat ?? 'DD-MMM-YYYY');
  applyChartTheme();

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const categoryList = useCategoryStore((s) => s.workbook.categories);

  const byCategory = useMemo(() => (account ? accountByCategory(account, transactions, categoryList) : {}), [account, transactions, categoryList]);
  const categories = Object.keys(byCategory).filter((c) => byCategory[c] < 0); // spend categories only — a doughnut of net credit/debit mixed together isn't meaningful
  // Keep the module-level Analytics tab on the same one-account source of
  // truth as Account Detail. With no period bounds this preserves its current
  // full-history charts while preventing any parent-Bank aggregation.
  const analytics = useMemo(
    () => (account ? accountPeriodAnalytics(account, transactions) : null),
    [account, transactions],
  );
  const monthlyFlow = analytics?.monthlyFlow ?? [];
  const balanceOverTime = analytics?.ledger ?? [];

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
                  labels: balanceOverTime.map((r) => formatDate(r.tx.date, dateFormat)),
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
            <ChartCard
              flat
              title="Deposits vs. withdrawals by month"
              titleTooltip="Every deposit vs. withdrawal across the selected account(s), including any inter-account transfer — this is a raw cash-flow view, not a categorized income/expense breakdown."
              empty={!monthlyFlow.length}
            >
              <Bar
                data={{
                  labels: monthlyFlow.map((f) => f.month),
                  datasets: [
                    { label: 'Deposits', data: monthlyFlow.map((f) => f.income), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                    { label: 'Withdrawals', data: monthlyFlow.map((f) => f.expense), backgroundColor: cssVar('--loss') || '#e5484d' },
                  ],
                }}
                options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, account.currencyCode)) } }}
              />
            </ChartCard>
          </div>

          <CollapsibleCard title={<h3 className="m-0">Budget — {thisMonth}</h3>} className="mt-md">
            <p className="text-muted mt-0">
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
                          className="price-input w-96"
                          defaultValue={r.budget || ''}
                          placeholder="—"
                          
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
            <div className="row gap-sm mt-sm">
              <TextInput placeholder="New category" value={newBudgetCategory} onChange={(e) => setNewBudgetCategory(e.target.value)} className="w-140" />
              <input
                type="number"
                step="0.01"
                placeholder="Monthly target"
                value={newBudgetAmount || ''}
                onChange={(e) => setNewBudgetAmount(Number(e.target.value))}
                className="w-120"
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
  // Same shared-picker reasoning as Cash's own PlanningTab (2026-09-20) —
  // one "Time period" control governs both the projection and the list
  // below. Declared before the early return so this hook always runs
  // (rules of hooks), regardless of whether there are any accounts yet.
  const [horizonDays, setHorizonDays] = useState<PlanningHorizonDays>(30);

  if (!accounts.length) {
    return <p className="text-muted">Add a bank account first (Accounts tab) before planning transactions.</p>;
  }

  return (
    <div>
      <PlanningHorizonField value={horizonDays} onChange={setHorizonDays} />
      <BalanceProjectionSummary horizonDays={horizonDays} />
      <Field label="Plans for account" width={220}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
        </Select>
      </Field>
      {account && (
        <div className="mt-12">
          <BankPlanList account={account} horizonDays={horizonDays} />
          <AddBankPlanFab accountId={account.id} />
        </div>
      )}
      <PlanningAccountSection cloudEmpty={plannedCloudEmpty} uploadLocalToCloud={uploadPlannedLocalToCloud} />
    </div>
  );
}

// User-requested (2026-09-16): "No need of settings in individual modules!"
// — Default currency and JSON export/import were per-module settings
// duplicating two already-unified hubs: currency is now driven app-wide by
// the Account page's Primary/Secondary/Other ranking (`usePrimaryCurrency`),
// and export/import lives at `/app-data` (Done item 177). Only "Clear all
// data" stays here — a real, destructive, module-scoped action `/app-data`
// has no equivalent for.
function DataManagement() {
  const setWorkbook = useBankWorkbookStore((s) => s.setWorkbook);

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
      <p className="text-muted" style={{ marginTop: 0 }}>
        Currency preferences live on the <Link to="/account">Account page</Link>; whole-app JSON
        export/import lives on the <Link to="/app-data">Data page</Link>.
      </p>
      <div className="row gap-sm">
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
  plannedCreditCardCloudEmpty,
  uploadPlannedCreditCardLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
  plannedSyncStatus: string;
  plannedCloudEmpty: boolean;
  uploadPlannedLocalToCloud: () => Promise<void>;
  plannedCreditCardCloudEmpty: boolean;
  uploadPlannedCreditCardLocalToCloud: () => Promise<void>;
}) {
  // Real bug, user-reported (2026-09-11): `Tabs.tsx`'s own "a chip click
  // force-opens a section without closing the others" design means this
  // page's Accounts/Credit Cards/Planning tabs can all be open, hence all
  // mounted, at once — each used to render its OWN independent `FabPanel`
  // at the identical fixed corner (confirmed live: two "Open actions"
  // buttons stacked at the exact same coordinates). Fixed by having each
  // of those tabs register its own actions via the keyed
  // `usePageFabActions` instead, merged into the ONE panel rendered here —
  // same mechanism `CalculatorLauncher` already uses for Stock Exchanges
  // routes, just consumed directly by this page instead of a second
  // globally-mounted component.
  const actionsByKey = useFabActionsStore((s) => s.actionsByKey);
  const fabActions = allExtraActions(actionsByKey);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <h1 className="pagetitle m-0">Banking</h1>
        <Tooltip text="Bank account balances and transaction history, entered manually or imported from a CSV statement — no live bank connection (see Disclaimer & Privacy for why)." />
      </div>
      {/* User-requested (2026-09-14): Parent Banks "extracted on top,
         collapsed by default" — a page-level section, above the whole
         tabbed area, not nested inside the "Accounts" tab's own content. */}
      <BanksList />
      <Tabs
        tabs={[
          { key: 'accounts', label: 'All Accounts', content: <AccountsTab /> },
          {
            key: 'creditCards',
            label: 'Credit Cards',
            content: (
              <CreditCardsTab
                plannedCreditCardCloudEmpty={plannedCreditCardCloudEmpty}
                uploadPlannedCreditCardLocalToCloud={uploadPlannedCreditCardLocalToCloud}
              />
            ),
          },
          {
            // Placed before Analytics to match Cash's own explicit tab order
            // for this exact same Planning feature (README Done item 224:
            // "Cash statement, Plans, Analytics, Categs..") — Bank had
            // Planning after Analytics with no stated reason, a real
            // page-order inconsistency (README Pending item 121(a)).
            key: 'planning',
            label: 'Planning',
            content: (
              <PlanningTab
                plannedCloudEmpty={plannedCloudEmpty}
                uploadPlannedLocalToCloud={uploadPlannedLocalToCloud}
              />
            ),
          },
          { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
          {
            key: 'settings',
            label: 'Settings',
            content: (
              <div>
                <p className="text-muted mt-0">
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
      <FabPanel actions={fabActions} />
    </div>
  );
}