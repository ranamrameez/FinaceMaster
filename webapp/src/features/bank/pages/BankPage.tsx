import type { User } from 'firebase/auth';
import { Fragment, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { ChartCard } from '../../qse/components/ChartCard';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { useAmountFormat } from '../../../hooks/useAmountFormat';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { hueStyle } from '../../../lib/statCardHues';
import { defaultTimezoneForCurrency } from '../../../lib/datetime';
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
function AddAccountFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500 }}>
        <Tooltip text="Add an account" align="right">
          <button
            className="btn"
            onClick={() => setOpen(true)}
            aria-label="Add an account"
            style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, fontSize: 22, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
          >
            <PlusIcon />
          </button>
        </Tooltip>
      </div>
      {open && (
        <Modal title="Add an account" onClose={() => setOpen(false)}>
          <AddAccountForm onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddAccountForm({ onSaved }: { onSaved?: () => void }) {
  const addAccount = useBankWorkbookStore((s) => s.addAccount);
  const [lastCurrency, setLastCurrency] = useLastCurrency('bank-account', 'USD');
  const ensureSignedIn = useEnsureSignedIn();
  const [a, setA] = useState(() => emptyAccount(lastCurrency));

  const submit = async () => {
    if (!a.name.trim()) return toast('Enter an account name.');
    if (!(await ensureSignedIn('Sign in to save bank accounts.'))) return;
    addAccount({ ...a, id: uid(), name: a.name.trim() });
    toast(`Account "${a.name.trim()}" added.`);
    setA(emptyAccount(a.currencyCode));
    onSaved?.();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Account name" width={180} required>
          <TextInput value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. Meezan Checking" />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={a.currencyCode} onChange={(e) => { setA({ ...a, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Opening balance (optional)" width={140}>
          <TextInput type="number" step="0.01" value={a.openingBalance || ''} onChange={(e) => setA({ ...a, openingBalance: Number(e.target.value) })} />
        </Field>
      </div>
      {/* README item 82: branch/account-type, free-form (not a fixed enum) —
         ACCOUNT_TYPES is just a datalist of common suggestions, any value is
         accepted. */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Field label="Branch (optional)" width={160}>
          <TextInput value={a.branch ?? ''} onChange={(e) => setA({ ...a, branch: e.target.value || undefined })} placeholder="e.g. Gulberg Branch" />
        </Field>
        <Field label="Account type (optional)" width={160}>
          <TextInput list="bank-account-type-datalist" value={a.accountType ?? ''} onChange={(e) => setA({ ...a, accountType: e.target.value || undefined })} placeholder="e.g. Savings" />
        </Field>
      </div>
      {/* User-requested: an IBAN lookup fills bank name/BIC automatically
         when supported; all still hand-editable. */}
      <IbanLookupFields value={a} onChange={(patch) => setA({ ...a, ...patch })} bankNameDatalistId="bank-name-datalist-add" />
      <CreditCardFields value={a} onChange={(patch) => setA({ ...a, ...patch })} datalistId="card-network-datalist-add" />
      {/* User-requested: save an account number + the SMS sender details a
         bank alert actually arrives from, for a future SMS-based
         transaction-import feature (nothing reads these yet — this just
         gives that feature somewhere to read from). All optional, so
         skipping them changes nothing about today's add-account flow. */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Field label="Account number (optional)" width={160} title="However your bank shows it on statements/SMS — often partially masked, e.g. xxxx1234.">
          <TextInput value={a.accountNumber ?? ''} onChange={(e) => setA({ ...a, accountNumber: e.target.value || undefined })} placeholder="e.g. xxxx1234" />
        </Field>
        <Field label="SMS sender ID (optional)" width={160} title="The sender ID/short code your bank's alert SMS arrives from, e.g. a bank name or a numeric short code.">
          <TextInput value={a.smsSenderId ?? ''} onChange={(e) => setA({ ...a, smsSenderId: e.target.value || undefined })} placeholder="e.g. 8123 or MEEZAN" />
        </Field>
        <Field label="SMS sender number (optional)" width={160} title="If your bank's alerts come from a full phone number instead of a short code.">
          <TextInput value={a.smsSenderNumber ?? ''} onChange={(e) => setA({ ...a, smsSenderNumber: e.target.value || undefined })} placeholder="e.g. +923001234567" />
        </Field>
      </div>
      <datalist id="bank-account-type-datalist">
        {ACCOUNT_TYPES.map((t) => <option key={t} value={t} />)}
      </datalist>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add account
      </button>
      <p className="footer-note" style={{ marginTop: 8 }}><span style={{ color: 'var(--loss)' }}>*</span> Required. Everything else on this form is optional.</p>
    </div>
  );
}

function AccountsList() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateAccount = useBankWorkbookStore((s) => s.updateAccount);
  const deleteAccount = useBankWorkbookStore((s) => s.deleteAccount);
  const navigate = useNavigate();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<BankAccount | null>(null);

  const startEdit = (a: BankAccount) => { setEditId(a.id); setEditRow({ ...a }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updateAccount(editId, editRow);
    toast('Account updated.');
    setEditId(null);
    setEditRow(null);
  };

  type Col = 'name' | 'currency' | 'opening' | 'current';
  const sortValue = (a: BankAccount, col: Col): number | string => {
    switch (col) {
      case 'currency': return a.currencyCode;
      case 'opening': return a.openingBalance;
      case 'current': return accountBalance(a, transactions);
      default: return a.name;
    }
  };
  const { sorted, Th } = useSortableRows(accounts, sortValue, 'name', 'asc');

  // User-requested (2026-08-26): "accounts should be categed by currency" —
  // grouped into a sub-header row per currency rather than a flat list,
  // while still respecting whatever column the user has sorted by within
  // each group (grouping and sorting are independent: Th's own sort still
  // reorders rows inside a currency, it just no longer mixes currencies
  // together in one run).
  const currencyGroups = useMemo(() => {
    const byCurrency = new Map<string, BankAccount[]>();
    for (const a of sorted) {
      const list = byCurrency.get(a.currencyCode) ?? [];
      list.push(a);
      byCurrency.set(a.currencyCode, list);
    }
    return [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sorted]);

  return (
    <div className="table-scroll">
      <table>
        <thead><tr><Th col="name">Name</Th><th>Type / Branch</th><Th col="currency">Currency</Th><Th col="opening">Opening balance</Th><Th col="current">Current balance</Th><th></th></tr></thead>
        <tbody>
          {currencyGroups.map(([currency, group]) => (
            <Fragment key={currency}>
              <tr className="group-row"><td colSpan={6}>{currency}</td></tr>
              {group.map((a) =>
            editId === a.id && editRow ? (
              <tr key={a.id}>
                <td><input value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} /></td>
                <td>
                  <input placeholder="Type" value={editRow.accountType ?? ''} onChange={(e) => setEditRow({ ...editRow, accountType: e.target.value || undefined })} style={{ width: 90, marginBottom: 4 }} />
                  <input placeholder="Branch" value={editRow.branch ?? ''} onChange={(e) => setEditRow({ ...editRow, branch: e.target.value || undefined })} style={{ width: 90 }} />
                </td>
                <td>
                  <select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </td>
                <td><input type="number" step="0.01" value={editRow.openingBalance} onChange={(e) => setEditRow({ ...editRow, openingBalance: Number(e.target.value) })} style={{ width: 110 }} /></td>
                <td></td>
                <td>
                  <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                  <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                </td>
              </tr>
            ) : (
              <tr key={a.id} onClick={() => navigate(`/bank/account/${a.id}`)} style={{ cursor: 'pointer' }}>
                <td>
                  {a.name}
                  {a.isLiability && <span className="pill-sell" style={{ marginLeft: 6, fontSize: 10 }}>Credit card</span>}
                </td>
                <td className="footer-note">{[a.accountType, a.branch].filter(Boolean).join(' · ') || '—'}</td>
                <td>{a.currencyCode}</td>
                <td>{fmtMoney(a.openingBalance, a.currencyCode)}</td>
                <td className={a.isLiability ? (accountBalance(a, transactions) < 0 ? 'pill-sell' : 'pill-buy') : undefined}>
                  {a.isLiability
                    ? `${fmtMoney(Math.max(0, -accountBalance(a, transactions)), a.currencyCode)} owed`
                    : fmtMoney(accountBalance(a, transactions), a.currencyCode)}
                </td>
                <td>
                  <button className="btn secondary small" onClick={(e) => { e.stopPropagation(); navigate(`/bank/account/${a.id}`); }}>Details</button>{' '}
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={(e) => { e.stopPropagation(); startEdit(a); }} />{' '}
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon size={13} />}
                    align="right"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirmDialog('This deletes the account and all its transactions.', `Delete account "${a.name}"?`)) deleteAccount(a.id);
                    }}
                  />
                </td>
              </tr>
            ),
              )}
            </Fragment>
          ))}
          {!sorted.length && <tr><td colSpan={6} className="footer-note">No accounts yet — use the + button below to add one.</td></tr>}
        </tbody>
      </table>
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
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const account = accounts.find((a) => a.id === id);
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateAccount = useBankWorkbookStore((s) => s.updateAccount);
  const ensureSignedIn = useEnsureSignedIn();
  const plannedEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const { num } = useAmountFormat();
  // Local draft state (same pattern as Rentals' PropertyDetailModal) rather
  // than editing `account` directly — see the fallback values below: all
  // hooks must run unconditionally on every render (rules of hooks), so
  // the "account not found" guard has to come AFTER every hook call, not
  // before — these `?.` fallbacks just keep the initial render safe for
  // an id that doesn't resolve, before that guard renders instead.
  const [meta, setMeta] = useState({
    accountNumber: account?.accountNumber ?? '',
    smsSenderId: account?.smsSenderId ?? '',
    smsSenderNumber: account?.smsSenderNumber ?? '',
    branch: account?.branch ?? '',
    accountType: account?.accountType ?? '',
    iban: account?.iban ?? '',
    bankName: account?.bankName ?? '',
    bic: account?.bic ?? '',
    isLiability: account?.isLiability,
    creditLimit: account?.creditLimit,
    annualFee: account?.annualFee,
    statementDate: account?.statementDate,
    paymentDueDate: account?.paymentDueDate,
    lateFeeAfterDue: account?.lateFeeAfterDue,
    minPaymentAmount: account?.minPaymentAmount,
    cardNetwork: account?.cardNetwork,
    cardBin: account?.cardBin,
  });
  const saveMeta = async () => {
    if (!account) return;
    if (!(await ensureSignedIn('Sign in to save account details.'))) return;
    updateAccount(account.id, {
      ...account,
      accountNumber: meta.accountNumber.trim() || undefined,
      smsSenderId: meta.smsSenderId.trim() || undefined,
      smsSenderNumber: meta.smsSenderNumber.trim() || undefined,
      branch: meta.branch.trim() || undefined,
      accountType: meta.accountType.trim() || undefined,
      iban: meta.iban.trim() || undefined,
      bankName: meta.bankName.trim() || undefined,
      bic: meta.bic.trim() || undefined,
      isLiability: meta.isLiability,
      creditLimit: meta.creditLimit,
      annualFee: meta.annualFee,
      statementDate: meta.statementDate,
      paymentDueDate: meta.paymentDueDate,
      lateFeeAfterDue: meta.lateFeeAfterDue,
      minPaymentAmount: meta.minPaymentAmount,
      cardNetwork: meta.cardNetwork,
      cardBin: meta.cardBin,
    });
    toast('Account details saved.');
  };
  const ledger = useMemo(() => (account ? [...accountRunningLedger(account, transactions)].reverse() : []), [account, transactions]);
  const upcoming = useMemo(
    () => (account ? plannedEntries.filter((p) => p.accountId === account.id && !p.executed).sort((a, b) => a.date.localeCompare(b.date)) : []),
    [plannedEntries, account],
  );
  const knownCategories = useMemo(
    () => (account ? [...new Set(transactions.filter((t) => t.accountId === account.id).map((t) => t.category).filter((c): c is string => !!c))].sort() : []),
    [transactions, account],
  );

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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

  return (
    <div>
      <Link to="/bank" className="footer-note">← Back to Banking</Link>
      <h1 className="pagetitle" style={{ marginTop: 8 }}>{account.name}</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        {account.isLiability ? 'Amount owed:' : 'Current balance:'}{' '}
        <strong title={fmtMoney(account.isLiability ? Math.max(0, -accountBalance(account, transactions)) : accountBalance(account, transactions), account.currencyCode)}>
          {num(account.isLiability ? Math.max(0, -accountBalance(account, transactions)) : accountBalance(account, transactions))} {account.currencyCode}
        </strong>
        {account.isLiability && account.creditLimit ? (
          <span className="footer-note"> · {num(Math.max(0, account.creditLimit - Math.max(0, -accountBalance(account, transactions))))} {account.currencyCode} available of {num(account.creditLimit)} limit</span>
        ) : null}
      </p>

      {/* User-requested (2026-08-26): "a transaction/repayment/entry
         conceptually belongs to its parent Account... should be logged...
         from THAT item's own detail page/view" — Banking's own detail modal
         was the clearest gap (no way to add a transaction from inside it at
         all), exactly backwards from what a user wants when clicking into
         an account. Leads with this now; the account-metadata edit form
         (rare to touch after setup) is demoted into a collapsed card below. */}
      <h4 style={{ margin: '0 0 6px' }}>Add a transaction</h4>
      <div style={{ marginBottom: 16 }}>
        <AddTransactionsForm accountId={account.id} currencyCode={account.currencyCode} knownCategories={knownCategories} />
      </div>

      {/* User-requested: save an account number + SMS sender details for a
         future SMS-based transaction-import feature. Nothing reads these
         yet — they're just captured here so that feature has somewhere to
         read from once built. Collapsed by default (2026-08-26) — editing
         an account's own metadata is rare, adding a transaction is the
         common case, so this no longer leads the modal. */}
      <CollapsibleCard
        defaultOpen={false}
        style={{ marginBottom: 16 }}
        title={<h4 style={{ margin: 0 }}>Account details</h4>}
        headerExtra={<button className="btn secondary" onClick={saveMeta}><SaveIcon size={13} />Save details</button>}
      >
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Field label="Branch" width={160}>
            <TextInput value={meta.branch} onChange={(e) => setMeta({ ...meta, branch: e.target.value })} placeholder="e.g. Gulberg Branch" />
          </Field>
          <Field label="Account type" width={160}>
            <TextInput list="bank-account-type-datalist-detail" value={meta.accountType} onChange={(e) => setMeta({ ...meta, accountType: e.target.value })} placeholder="e.g. Savings" />
          </Field>
        </div>
        <datalist id="bank-account-type-datalist-detail">
          {ACCOUNT_TYPES.map((t) => <option key={t} value={t} />)}
        </datalist>
        <IbanLookupFields
          value={meta}
          onChange={(patch) => setMeta((m) => ({
            ...m,
            ...('iban' in patch ? { iban: patch.iban ?? '' } : {}),
            ...('bankName' in patch ? { bankName: patch.bankName ?? '' } : {}),
            ...('bic' in patch ? { bic: patch.bic ?? '' } : {}),
          }))}
          bankNameDatalistId="bank-name-datalist-detail"
        />
        <CreditCardFields
          value={meta}
          onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
          datalistId="card-network-datalist-detail"
        />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <Field label="Account number" width={160} title="However your bank shows it on statements/SMS — often partially masked, e.g. xxxx1234.">
            <TextInput value={meta.accountNumber} onChange={(e) => setMeta({ ...meta, accountNumber: e.target.value })} placeholder="e.g. xxxx1234" />
          </Field>
          <Field label="SMS sender ID" width={160} title="The sender ID/short code your bank's alert SMS arrives from, e.g. a bank name or a numeric short code.">
            <TextInput value={meta.smsSenderId} onChange={(e) => setMeta({ ...meta, smsSenderId: e.target.value })} placeholder="e.g. 8123 or MEEZAN" />
          </Field>
          <Field label="SMS sender number" width={160} title="If your bank's alerts come from a full phone number instead of a short code.">
            <TextInput value={meta.smsSenderNumber} onChange={(e) => setMeta({ ...meta, smsSenderNumber: e.target.value })} placeholder="e.g. +923001234567" />
          </Field>
        </div>
      </CollapsibleCard>

      {upcoming.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 6px' }}>Upcoming plans ({upcoming.length})</h4>
          <div className="table-scroll" style={{ marginBottom: 16 }}>
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
        </>
      )}

      {/* User-requested (2026-08-26): "Transactions belong to an account so
         should be on its detail page/popup and editable" — this used to be
         a read-only 20-row preview; now reuses the same `TransactionsList`
         the standalone Transactions tab already uses (full CRUD: sort,
         inline edit, delete with the linked-record warning), so editing a
         transaction no longer requires leaving the account's own modal. */}
      <h4 style={{ margin: '0 0 6px' }}>Transactions</h4>
      <div style={{ marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
        <TransactionsList account={account} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h4 style={{ margin: 0 }}>Download statement</h4>
        <button className="btn" onClick={exportStatement}>Export CSV</button>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="From (optional)">
          <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="To (optional)">
          <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function AccountsTab() {
  return (
    <div>
      <TotalBalances />
      <AccountsList />
      <AddAccountFab />
    </div>
  );
}

/* ============================== Transactions ============================== */

function useAccountPicker() {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;
  return { accounts, account, accountId: account?.id ?? '', setAccountId };
}

function emptyTxRow(accountId: string, currencyCode?: string): BankTransaction {
  return { id: '', accountId, date: today(), amount: 0, description: '', category: '', source: 'manual', timezone: defaultTimezoneForCurrency(currencyCode) };
}

function AddTransactionsForm({ accountId, currencyCode, knownCategories }: { accountId: string; currencyCode: string; knownCategories: string[] }) {
  const addTransactions = useBankWorkbookStore((s) => s.addTransactions);
  const ensureSignedIn = useEnsureSignedIn();
  const [rows, setRows] = useState<BankTransaction[]>([emptyTxRow(accountId, currencyCode)]);

  const update = (i: number, patch: Partial<BankTransaction>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    const valid = rows.filter((r) => r.amount !== 0 && r.description.trim());
    if (!valid.length) return toast('Fill in at least one complete row (description + non-zero amount).');
    if (!(await ensureSignedIn('Sign in to save bank transactions.'))) return;
    addTransactions(valid.map((r) => ({ ...r, id: uid(), accountId, category: r.category?.trim() || undefined })));
    toast(`Added ${valid.length} transaction${valid.length > 1 ? 's' : ''}.`);
    setRows([emptyTxRow(accountId, currencyCode)]);
  };

  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
          <input placeholder="Description" value={r.description} onChange={(e) => update(i, { description: e.target.value })} style={{ width: 160 }} />
          <input
            type="number"
            step="0.01"
            placeholder="Amount (+/-)"
            value={r.amount || ''}
            onChange={(e) => update(i, { amount: Number(e.target.value) })}
            style={{ width: 110 }}
            title="Negative = spend/debit, positive = deposit/credit"
          />
          <input
            list="bank-category-datalist"
            placeholder="Category (optional)"
            value={r.category}
            onChange={(e) => update(i, { category: e.target.value })}
            style={{ width: 130 }}
          />
          <TimeZoneFields
            time={r.time}
            timezone={r.timezone}
            onTimeChange={(time) => update(i, { time })}
            onTimezoneChange={(timezone) => update(i, { timezone })}
          />
          <button className="btn secondary small" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
            <TrashIcon size={12} />Remove
          </button>
        </div>
      ))}
      <datalist id="bank-category-datalist">
        {knownCategories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn secondary" onClick={() => setRows((rs) => [...rs, emptyTxRow(accountId)])}>
          <PlusIcon />Add row
        </button>
        <button className="btn" onClick={submit}>
          <SaveIcon />Save {rows.length > 1 ? `${rows.length} transactions` : 'transaction'}
        </button>
      </div>
      <p className="footer-note" style={{ marginTop: 8 }}>Negative amount = spend/debit, positive = deposit/credit.</p>
    </div>
  );
}

function TransactionsList({ account }: { account: BankAccount }) {
  const allTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const updateTransaction = useBankWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = useBankWorkbookStore((s) => s.deleteTransaction);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<BankTransaction | null>(null);

  const ledger = useMemo(() => accountRunningLedger(account, allTransactions), [account, allTransactions]);

  type Col = 'date' | 'description' | 'amount' | 'category';
  const sortValue = (r: (typeof ledger)[number], col: Col): number | string => {
    switch (col) {
      case 'description': return r.tx.description;
      case 'amount': return r.tx.amount;
      case 'category': return r.tx.category ?? '';
      default: return r.tx.date;
    }
  };
  const { sorted, Th } = useSortableRows(ledger, sortValue, 'date', 'desc');

  const startEdit = (tx: BankTransaction) => { setEditId(tx.id); setEditRow({ ...tx }); };
  const saveEdit = async () => {
    if (!editId || !editRow) return;
    if (!(await warnIfLinked('bank', editId))) return;
    updateTransaction(editId, editRow);
    toast('Transaction updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="date">Date</Th>
            <Th col="description">Description</Th>
            <Th col="amount">Amount</Th>
            <Th col="category">Category</Th>
            <th>Source</th>
            <th>Balance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ tx, balance }) =>
            editId === tx.id && editRow ? (
              <tr key={tx.id}>
                <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                <td><input value={editRow.description} onChange={(e) => setEditRow({ ...editRow, description: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 100 }} /></td>
                <td><input value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} style={{ width: 100 }} /></td>
                <td>{editRow.source}</td>
                <td></td>
                <td>
                  <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                  <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                </td>
              </tr>
            ) : (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description}</td>
                <td className={tx.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(tx.amount, account.currencyCode)}</td>
                <td>{tx.category || '—'}</td>
                <td className="footer-note">{tx.source === 'statement-import' ? `Import${tx.statementRef ? ` (${tx.statementRef})` : ''}` : 'Manual'}</td>
                <td>{fmtMoney(balance, account.currencyCode)}</td>
                <td>
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(tx)} />{' '}
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon size={13} />}
                    align="right"
                    onClick={() => confirmAndDeleteLinkable('bank', tx.id, () => deleteTransaction(tx.id))}
                  />
                </td>
              </tr>
            ),
          )}
          {!sorted.length && <tr><td colSpan={7} className="footer-note">No transactions for this account yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CategoryBreakdown({ account }: { account: BankAccount }) {
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const byCategory = accountByCategory(account, transactions);
  const cats = Object.keys(byCategory);
  if (!cats.length) return null;

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>By category</h3>} style={{ marginBottom: 16 }}>
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
    </CollapsibleCard>
  );
}

function TransactionsTab() {
  const { accounts, account, accountId, setAccountId } = useAccountPicker();
  const allTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const knownCategories = useMemo(
    () => [...new Set(allTransactions.filter((t) => t.accountId === accountId).map((t) => t.category).filter((c): c is string => !!c))].sort(),
    [allTransactions, accountId],
  );

  if (!accounts.length) {
    return <p className="footer-note">Add a bank account first (Accounts tab) before logging transactions.</p>;
  }

  return (
    <div>
      <Field label="Account" width={220}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
        </Select>
      </Field>
      {account && (
        <div style={{ marginTop: 12 }}>
          <AddTransactionsForm accountId={account.id} currencyCode={account.currencyCode} knownCategories={knownCategories} />
          <div style={{ marginTop: 16 }}>
            <CategoryBreakdown account={account} />
            <TransactionsList account={account} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Statement import ============================== */

function ImportTab() {
  const { accounts, account, accountId, setAccountId } = useAccountPicker();
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
    if (!account) return toast('Add and select a bank account first.');
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

  if (!accounts.length) {
    return <p className="footer-note">Add a bank account first (Accounts tab) before importing a statement.</p>;
  }

  return (
    <div>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Import a CSV export from your bank. This is a simple "map these columns" tool, not a per-bank-format
        parser — pick which column is which below, since every bank's export looks a little different.
      </p>
      <Field label="Import into account" width={220}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
        </Select>
      </Field>
      <div style={{ marginTop: 8 }}>
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
        <Card style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Map columns</h3>
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
                    <td className={r.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{account ? fmtMoney(r.amount, account.currencyCode) : r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={doImport}>
            <PlusIcon />Import {rows.length} transaction{rows.length > 1 ? 's' : ''}
          </button>
        </Card>
      )}
    </div>
  );
}

/* ============================== Settings ============================== */

function AccountSection({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const transactions = useBankWorkbookStore((s) => s.workbook.transactions);
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
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Account</h3>
      <p className="footer-note">{syncStatus}</p>
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
    </Card>
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
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Balance projection</h3>} style={{ marginBottom: 16 }}>
      <p className="footer-note" style={{ marginTop: 0 }}>
        See what your total balance would look like if every plan below actually happened — a reality check
        before you spend. Choose what you want to see:
      </p>
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
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500 }}>
        <Tooltip text="Add a plan" align="right">
          <button
            className="btn"
            onClick={() => setOpen(true)}
            aria-label="Add a plan"
            style={{ width: 52, height: 52, borderRadius: '50%', padding: 0, fontSize: 22, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
          >
            <PlusIcon />
          </button>
        </Tooltip>
      </div>
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

function PlanningAccountSection({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const plans = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady) return null;
  return (
    <Card style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Plans — account</h3>
      <p className="footer-note">{syncStatus}</p>
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
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
      )}
    </Card>
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

  const byCategory = useMemo(() => (account ? accountByCategory(account, transactions) : {}), [account, transactions]);
  const categories = Object.keys(byCategory).filter((c) => byCategory[c] < 0); // spend categories only — a doughnut of net credit/debit mixed together isn't meaningful
  const monthlyFlow = useMemo(() => (account ? bankMonthlyFlow(transactions, [account.id]) : []), [account, transactions]);
  const balanceOverTime = useMemo(() => (account ? accountRunningLedger(account, transactions) : []), [account, transactions]);

  const thisMonth = today().slice(0, 7);
  const budgetRows = useMemo(
    () => (account ? budgetVsActual(transactions, [account.id], budgets ?? {}, thisMonth) : []),
    [account, transactions, budgets, thisMonth],
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
            <ChartCard title="Balance over time" empty={!balanceOverTime.length}>
              <Line
                data={{
                  labels: balanceOverTime.map((r) => r.tx.date),
                  datasets: [{ label: 'Balance', data: balanceOverTime.map((r) => r.balance), borderColor: '#5aa9c9', backgroundColor: '#5aa9c933', fill: true, tension: 0.2 }],
                }}
                options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtMoney(v, account.currencyCode)) } }}
              />
            </ChartCard>
            <ChartCard title="Category breakdown (spend)" empty={!categories.length}>
              <Doughnut
                data={{
                  labels: categories,
                  datasets: [{ data: categories.map((c) => Math.abs(byCategory[c])), backgroundColor: categories.map((c) => tickerColor(c)) }],
                }}
                options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, account.currencyCode)) } }}
              />
            </ChartCard>
            <ChartCard title="Income vs. spend by month" empty={!monthlyFlow.length}>
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
  plannedSyncStatus,
  plannedCloudEmpty,
  uploadPlannedLocalToCloud,
}: {
  plannedSyncStatus: string;
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
      <PlanningAccountSection syncStatus={plannedSyncStatus} cloudEmpty={plannedCloudEmpty} uploadLocalToCloud={uploadPlannedLocalToCloud} />
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
    <Card>
      <h3 style={{ marginTop: 0 }}>Data management</h3>
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
        <button className="btn secondary" onClick={clearAll}><TrashIcon size={12} />Clear all data</button>
      </div>
    </Card>
  );
}

export function BankPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
  plannedSyncStatus,
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
      <h1 className="pagetitle">Banking</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Bank account balances and transaction history, entered manually or imported from a CSV statement — no
        live bank connection (see Disclaimer &amp; Privacy for why).
      </p>
      <Tabs
        tabs={[
          { key: 'accounts', label: 'Accounts', content: <AccountsTab /> },
          { key: 'transactions', label: 'Transactions', content: <TransactionsTab /> },
          { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
          {
            key: 'planning',
            label: 'Planning',
            content: (
              <PlanningTab
                plannedSyncStatus={plannedSyncStatus}
                plannedCloudEmpty={plannedCloudEmpty}
                uploadPlannedLocalToCloud={uploadPlannedLocalToCloud}
              />
            ),
          },
          { key: 'import', label: 'Import statement', content: <ImportTab /> },
          {
            key: 'settings',
            label: 'Settings',
            content: (
              <div>
                <AccountSection syncStatus={syncStatus} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
                <DataManagement />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
