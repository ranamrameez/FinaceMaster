import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, EntityCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { ChartCard } from '../../qse/components/ChartCard';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { ArchiveIcon, EditIcon, ExportIcon, ListIcon, PlusIcon, RestoreIcon, SaveIcon, TransferIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { AttributeList } from '../../../components/ui/AttributeList';
import { FabButton, FabPanel } from '../../../components/ui/Fab';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { CategorySelect } from '../../../components/CategorySelect';
import { FinanceEditModal } from '../../../components/FinanceEditModal';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { useAmountFormat } from '../../../hooks/useAmountFormat';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { hueStyle } from '../../../lib/statCardHues';
import { categoryName, UNCATEGORIZED_ID } from '../../../lib/categories';
import { useCategoryStore } from '../../../store/categoryStore';
import { accountBalance, accountByCategory, accountRunningLedger, bankMonthlyFlow, budgetVsActual, totalBalanceByCurrency } from '../../../lib/calc/bankModule';
import { plannedBankProjection } from '../../../lib/calc/plannedBalance';
import { dlBarV, dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { parseCSV, toCSV } from '../../../lib/csv';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { confirmAndDeleteLinkable, warnIfLinked } from '../../../lib/linkCascade';
import { isValidIbanFormat, lookupIban } from '../../../lib/ibanLookup';
import { isValidBin, lookupBin } from '../../../lib/binLookup';
import { PK_QA_BANKS_AND_WALLETS } from '../../../lib/bankDirectory';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { createEmptyBankWorkbook } from '../../../store/defaultBankWorkbook';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath } from '../../transfers/pages/TransferLinksPage';
import type { BankAccount, BankTransaction, BankWorkbook } from '../../../types/bankWorkbook';
import type { PlannedBankTransaction } from '../../../types/plannedBank';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

function emptyAccount(defaultCurrency: string): Omit<BankAccount, 'id'> {
  return { name: '', currencyCode: defaultCurrency, openingBalance: 0 };
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
      <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
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
  bankName?: string;
  bic?: string;
}

/** User-requested (2026-08-26): look up a bank's name/BIC from its IBAN
 * instead of typing them by hand. See `lib/ibanLookup.ts` for the
 * provider-chain design and why only one live provider is wired in today.
 * All three fields stay freely hand-editable regardless of whether lookup
 * succeeds — an account may have no IBAN at all (common for PKR/QAR
 * accounts), or the lookup may simply fail, and that shouldn't block
 * entering the bank name manually. */
function IbanLookupFields({ value, onChange, bankNameDatalistId }: { value: IbanLookupValue; onChange: (patch: Partial<IbanLookupValue>) => void; bankNameDatalistId: string }) {
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
      onChange({ bankName: result.bankName ?? value.bankName, bic: result.bic ?? value.bic });
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
      <Field label="Bank name (optional)" width={180} title="Type to search — includes common Pakistani and Qatari banks/wallet apps, or type any other bank's name.">
        <TextInput list={bankNameDatalistId} value={value.bankName ?? ''} onChange={(e) => onChange({ bankName: e.target.value || undefined })} placeholder="e.g. Standard Chartered" />
      </Field>
      <Field label="BIC / SWIFT (optional)" width={140}>
        <TextInput value={value.bic ?? ''} onChange={(e) => onChange({ bic: e.target.value || undefined })} placeholder="e.g. SCBLPKKX" />
      </Field>
      {/* User-requested (2026-08-26): prefilled Pakistan/Qatar banks + mobile
         wallet apps — a suggestion list, never a fixed enum; any other bank
         name typed here is accepted exactly the same way. */}
      <datalist id={bankNameDatalistId}>
        {PK_QA_BANKS_AND_WALLETS.map((b) => <option key={b} value={b} />)}
      </datalist>
    </div>
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
  const [open, setOpen] = useState<'account' | 'transfer' | null>(null);
  return (
    <>
      <FabPanel
        actions={[
          { label: 'Add an account', icon: <PlusIcon />, onClick: () => setOpen('account') },
          { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
        ]}
      />
      {open === 'account' && (
        <Modal title="Add an account" onClose={() => setOpen(null)}>
          <AddAccountForm onSaved={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'transfer' && <TransactionEntryModal onClose={() => setOpen(null)} />}
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
  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Account name" width={180} required>
          <TextInput value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Meezan Checking" />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={value.currencyCode} onChange={(e) => onChange({ currencyCode: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
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
      {/* User-requested: an IBAN lookup fills bank name/BIC automatically
         when supported; all still hand-editable. */}
      <IbanLookupFields value={value} onChange={onChange} bankNameDatalistId={`bank-name-datalist-${idSuffix}`} />
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
export function AddAccountForm({ onSaved, initialCurrency }: { onSaved?: (id: string) => void; initialCurrency?: string }) {
  const addAccount = useBankWorkbookStore((s) => s.addAccount);
  const [lastCurrency, setLastCurrency] = useLastCurrency('bank-account', 'USD');
  const ensureSignedIn = useEnsureSignedIn();
  const [a, setA] = useState(() => emptyAccount(initialCurrency ?? lastCurrency));

  const submit = async () => {
    if (!a.name.trim()) return toast('Enter an account name.');
    if (!(await ensureSignedIn('Sign in to save bank accounts.'))) return;
    const id = uid();
    addAccount({ ...a, id, name: a.name.trim() });
    toast(`Account "${a.name.trim()}" added.`);
    setA(emptyAccount(a.currencyCode));
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
      <p className="footer-note" style={{ marginTop: 8 }}><span style={{ color: 'var(--loss)' }}>*</span> Required. Everything else on this form is optional.</p>
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
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = useMemo(() => accounts.filter((a) => a.isActive === false).length, [accounts]);
  const visibleAccounts = useMemo(
    () => (showArchived ? accounts : accounts.filter((a) => a.isActive !== false)),
    [accounts, showArchived],
  );

  const currencyGroups = useMemo(() => {
    const byCurrency = new Map<string, BankAccount[]>();
    for (const a of visibleAccounts) {
      const list = byCurrency.get(a.currencyCode) ?? [];
      list.push(a);
      byCurrency.set(a.currencyCode, list);
    }
    return [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleAccounts]);

  if (!accounts.length) {
    return <p className="footer-note">No accounts yet — use the + button below to add one.</p>;
  }

  return (
    <div>
      {archivedCount > 0 && (
        <button
          className="btn secondary small"
          style={{ marginBottom: 12 }}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
        </button>
      )}
      {!visibleAccounts.length && (
        <p className="footer-note">Every account is archived — click "Show archived" above to see them.</p>
      )}
      {currencyGroups.map(([currency, group]) => (
        <div key={currency} style={{ marginBottom: 20 }}>
          <div className="footer-note" style={{ marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em' }}>
            {currency}
          </div>
          <div className="entity-card-grid">
            {group.map((a) => (
              <EntityCard
                key={a.id}
                title={a.name}
                subtitle={[a.accountType, a.branch].filter(Boolean).join(' · ') || undefined}
                badge={
                  a.isLiability || a.isActive === false ? (
                    <span style={{ display: 'flex', gap: 4 }}>
                      {a.isLiability && <span className="pill-sell" style={{ fontSize: 10 }}>Credit card</span>}
                      {a.isActive === false && <span className="pill-warn" style={{ fontSize: 10 }}>Archived</span>}
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
                  <IconButton
                    label="Transactions"
                    icon={<ListIcon size={13} />}
                    align="right"
                    onClick={() => navigate(`/bank/account/${a.id}`)}
                  />
                }
              />
            ))}
          </div>
        </div>
      ))}
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
        <Link to="/bank" className="footer-note">← Back to Banking</Link>
        <p className="footer-note" style={{ marginTop: 12 }}>Account not found.</p>
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
    if (!(await ensureSignedIn(account.isActive === false ? 'Sign in to restore this account.' : 'Sign in to archive this account.'))) return;
    updateAccount(account.id, { isActive: account.isActive === false ? true : false });
    toast(account.isActive === false ? 'Account restored.' : 'Account archived.');
  };

  return (
    <div>
      <Link to="/bank" className="footer-note">← Back to Banking</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="pagetitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {account.name}
          {account.isActive === false && <span className="pill-warn" style={{ fontSize: 11 }}>Archived</span>}
        </h1>
        {/* User-requested (2026-08-27): "Delete and Edit are rare operations
           they should [be] on details page only... with delete as a red
           danger button." Edit already lives on the Account Details card
           below (its own Edit icon); Delete/Archive are the account's own
           destructive/reversible actions, both moved off the homepage
           entity card entirely and grouped together here (rule 7). */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary small" onClick={toggleArchived}>
            {account.isActive === false ? <><RestoreIcon size={13} />Restore account</> : <><ArchiveIcon size={13} />Archive account</>}
          </button>
          <button className="btn danger small" onClick={deleteThisAccount}>
            <TrashIcon size={13} />Delete account
          </button>
        </div>
      </div>
      <p className="footer-note" style={{ marginBottom: 16 }}>
        {account.isLiability ? 'Amount owed:' : 'Current balance:'}{' '}
        <strong title={fmtMoney(account.isLiability ? Math.max(0, -accountBalance(account, transactions)) : accountBalance(account, transactions), account.currencyCode)}>
          {num(account.isLiability ? Math.max(0, -accountBalance(account, transactions)) : accountBalance(account, transactions))} {account.currencyCode}
        </strong>
        {account.isLiability && account.creditLimit ? (
          <span className="footer-note"> · {num(Math.max(0, account.creditLimit - Math.max(0, -accountBalance(account, transactions))))} {account.currencyCode} available of {num(account.creditLimit)} limit</span>
        ) : null}
      </p>

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
                      <td className={p.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(p.amount, account.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleCard>
        )}
      </div>

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
 * reasoning as `CashPage.tsx`'s `EditEntryModal`. `amount` stays signed
 * (Bank's own convention, see `types/finance.ts`) — `isDeposit` is
 * re-derived from it by the store itself on save, never edited directly
 * here. */
function EditTransactionModal({ tx, onClose }: { tx: BankTransaction; onClose: () => void }) {
  const updateTransaction = useBankWorkbookStore((s) => s.updateTransaction);
  const [draft, setDraft] = useState<BankTransaction>({ ...tx });

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
        <Field label="Amount" required title="Negative = spend/debit, positive = deposit/credit.">
          <TextInput type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
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
      <p className="footer-note" style={{ marginTop: 8 }}>
        {draft.source === 'statement-import' ? `Imported${draft.statementRef ? ` from ${draft.statementRef}` : ''}` : 'Entered manually'}
      </p>
    </FinanceEditModal>
  );
}

function TransactionsList({ account }: { account: BankAccount }) {
  const allTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const deleteTransaction = useBankWorkbookStore((s) => s.deleteTransaction);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);

  const ledger = useMemo(() => accountRunningLedger(account, allTransactions), [account, allTransactions]);

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

  type Col = 'date' | 'description' | 'amount' | 'category';
  const sortValue = (r: (typeof ledger)[number], col: Col): number | string => {
    switch (col) {
      case 'description': return r.tx.description;
      case 'amount': return r.tx.amount;
      case 'category': return categoryName(r.tx.categoryID, categories);
      default: return r.tx.date;
    }
  };
  const { sorted, Th } = useSortableRows(ledger, sortValue, 'date', 'desc');

  return (
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
            <Th col="date">Date</Th>
            {/* User-reported (2026-08-28): "Description and Source are
               making the table too large to read" + "Credit/Debit and
               balance should be next to each other. Categories can be
               marked as labels" — Description/Source clipped with a hover
               tooltip for the full text; Category rendered as a colored
               `.pill-info` label instead of plain text; Amount and Balance
               moved next to each other at the end, ahead of actions. */}
            <Th col="description">Description</Th>
            <Th col="category">Category</Th>
            <Th col="amount">Amount</Th>
            <th>Balance</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ tx, balance }) => {
            const link = linkByRecordId.get(tx.id);
            const otherSide = link ? (link.from.module === 'bank' && link.fromRecordId === tx.id ? link.to : link.from) : undefined;
            return (
              <tr key={tx.id}>
                <td className="footer-note">{tx.serialNumber ?? '—'}</td>
                <td>{tx.date}</td>
                <td className="cell-clip" title={tx.description}>
                  {tx.description}
                  {otherSide && (
                    <Link to={linkTargetPath(otherSide)} className="pill-info" style={{ marginLeft: 6, textDecoration: 'none' }} title="Linked — go to the other side">
                      🔗 Linked
                    </Link>
                  )}
                </td>
                <td><span className="pill-info">{categoryName(tx.categoryID, categories)}</span></td>
                <td className={tx.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(tx.amount, account.currencyCode)}</td>
                <td>{fmtMoney(balance, account.currencyCode)}</td>
                <td className="footer-note cell-clip" title={tx.source === 'statement-import' ? `Import${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual'}>
                  {tx.source === 'statement-import' ? `Import${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual'}
                </td>
                <td>
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
          {!sorted.length && <tr><td colSpan={7} className="footer-note">No transactions for this account yet.</td></tr>}
        </tbody>
      </table>
      {editingTx && <EditTransactionModal tx={editingTx} onClose={() => setEditingTx(null)} />}
    </div>
  );
}

/** Renders just the category table (no card wrapper of its own) — the
 * caller (`AccountDetailPage`) supplies the `CollapsibleCard` so this
 * never nests a card inside a card (rule 1). */
function CategoryBreakdownBody({ account }: { account: BankAccount }) {
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const byCategory = accountByCategory(account, transactions, categories);
  const cats = Object.keys(byCategory);
  if (!cats.length) return <p className="footer-note" style={{ margin: 0 }}>No categorized transactions yet.</p>;

  return (
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
        <span className="footer-note">Import a CSV export from your bank into {account.name}.</span>
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
        {fileName && <span className="footer-note" style={{ marginLeft: 8 }}>{fileName} ({rows.length} rows)</span>}
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
                    <td className={r.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(r.amount, account.currencyCode)}</td>
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
        <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={settings.showRealBalance} onChange={(e) => updateSettings({ showRealBalance: e.target.checked })} />
          Real balance
        </label>
        <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={settings.showPlannedBalance} onChange={(e) => updateSettings({ showPlannedBalance: e.target.checked })} />
          Planned balance
        </label>
      </div>
      {!codes.length ? (
        <p className="footer-note">No balance yet — add an account or a plan below.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8 }}>
          {codes.map((code) => (
            <div key={code} className="stat-card card">
              <div className="label">{code}</div>
              {settings.showRealBalance && (
                <div className={projection[code].real >= 0 ? 'pill-buy' : 'pill-sell'}>Real: {fmtMoney(projection[code].real, code)}</div>
              )}
              {settings.showPlannedBalance && (
                <div className={projection[code].planned >= 0 ? 'pill-buy' : 'pill-sell'}>
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
          <TextInput type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} />
        </Field>
        <Field label="Description" width={160}>
          <TextInput value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} placeholder="e.g. Rent" />
        </Field>
        <Field label="Amount (+/-)" width={110}>
          <TextInput
            type="number"
            step="0.01"
            value={p.amount || ''}
            onChange={(e) => setP({ ...p, amount: Number(e.target.value) })}
            title="Negative = spend/debit, positive = deposit/credit"
          />
        </Field>
        <Field label="Category (optional)" width={140}>
          <TextInput value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add plan
      </button>
      <p className="footer-note" style={{ marginTop: 8 }}>Negative amount = spend/debit, positive = deposit/credit.</p>
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
    if (!(await ensureSignedIn('Sign in to save bank transactions.'))) return;
    addTransaction({
      id: crypto.randomUUID(),
      accountId: p.accountId,
      date: p.date,
      description: p.description,
      amount: p.amount,
      isDeposit: p.amount >= 0,
      category: p.category,
      source: 'manual',
    });
    updatePlan(p.id, { executed: true });
    toast('Marked as done — added to this account\'s transactions.');
  };

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Plans</h3>}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {sorted.map((p) =>
              editId === p.id && editRow ? (
                <tr key={p.id}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td><input value={editRow.description} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} /></td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 100 }} /></td>
                  <td><input value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} style={{ width: 100 }} /></td>
                  <td></td>
                  <td>
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{p.description}</td>
                  <td className={p.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(p.amount, account.currencyCode)}</td>
                  <td>{p.category || '—'}</td>
                  <td className="footer-note">{p.executed ? 'Done' : 'Planned'}</td>
                  <td>
                    {!p.executed && (
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
            {!sorted.length && <tr><td colSpan={6} className="footer-note">No plans for this account yet.</td></tr>}
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
    return <p className="footer-note">Add a bank account first (Accounts tab) to see charts here.</p>;
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
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
            <p className="footer-note" style={{ marginTop: 0 }}>
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
                      <td className={r.budget > 0 && r.actual > r.budget ? 'pill-sell' : ''}>{fmtMoney(r.actual, account.currencyCode)}</td>
                      <td className={r.budget > 0 ? (r.budget - r.actual >= 0 ? 'pill-buy' : 'pill-sell') : ''}>
                        {r.budget > 0 ? fmtMoney(r.budget - r.actual, account.currencyCode) : '—'}
                      </td>
                    </tr>
                  ))}
                  {!budgetRows.length && <tr><td colSpan={4} className="footer-note">No spend or budget targets for this account yet.</td></tr>}
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
    return <p className="footer-note">Add a bank account first (Accounts tab) before planning transactions.</p>;
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
      <div className="footer-note" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em', marginBottom: 8 }}>
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
                <p className="footer-note" style={{ marginTop: 0 }}>
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
