import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Card, CollapsibleCard } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { getLastTransferSource, rememberTransferSource } from '../../../hooks/useLastTransferSource';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { fmtMoney } from '../../../lib/format';
import { isSupportedLinkPair } from '../../../lib/interEntityLink';
import { createLinkedTransfer, deleteLinkCascade, updateLinkedTransfer } from '../../../lib/linkCascade';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { usePersonalLoansWorkbookStore } from '../../../store/personalLoansWorkbookStore';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import { LINK_MODULES, LINK_MODULE_LABELS, type InterEntityTransfer, type LinkModule, type LinkSideConfig } from '../../../types/interEntityTransfer';

const today = () => new Date().toISOString().slice(0, 10);

interface CurrencyContext {
  cashCurrency: string;
  bankAccounts: { id: string; currencyCode: string }[];
  qseCurrency: string;
  psxCurrency: string;
  fundsCurrency: string;
  properties: { id: string; currencyCode: string }[];
  loans: { id: string; currencyCode: string }[];
}

/** Resolves the display currency for one side — a plain function (not a
 * hook) so it can be called per-row inside a `.map()`, e.g. in `LinksList`
 * below, where the store selectors are read once at the top of the
 * component instead of once per row. */
function resolveCurrency(cfg: LinkSideConfig, ctx: CurrencyContext): string | null {
  switch (cfg.module) {
    case 'cash': return ctx.cashCurrency;
    case 'bank': return ctx.bankAccounts.find((a) => a.id === cfg.ref)?.currencyCode ?? null;
    case 'qse': return ctx.qseCurrency;
    case 'psx': return ctx.psxCurrency;
    // Unlike QSE/PSX, Funds has no single portfolio currency (funds can be
    // added in different currencies) — `defaultCurrency` is a pragmatic
    // stand-in, same simplification the unused `cashSummary`/
    // `buildCashLedger` calls in `useFundsDerived` already made implicitly
    // by treating every Transfer as one currency.
    case 'funds': return ctx.fundsCurrency;
    case 'rentals': return ctx.properties.find((p) => p.id === cfg.ref)?.currencyCode ?? null;
    case 'personalLoans': return ctx.loans.find((l) => l.id === cfg.ref)?.currencyCode ?? null;
  }
}

/** Resolves the display currency for one side, so the form can warn about
 * a currency mismatch before it's created — the link itself never converts
 * (no live FX-rate source, per MODULES_PLAN.md's cross-cutting decision),
 * so a mismatch here means the two ledger rows won't reconcile in the same
 * units even though the app treats the number as equal on both sides. */
function useSideCurrency(cfg: LinkSideConfig): string | null {
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const qseCurrency = useWorkbookStore((s) => s.workbook.settings.currency);
  const psxCurrency = usePSXWorkbookStore((s) => s.workbook.settings.currency);
  const fundsCurrency = useFundsWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  return resolveCurrency(cfg, { cashCurrency, bankAccounts, qseCurrency, psxCurrency, fundsCurrency, properties, loans });
}

function SideFields({ label, cfg, onChange }: { label: string; cfg: LinkSideConfig; onChange: (cfg: LinkSideConfig) => void }) {
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const currency = useSideCurrency(cfg);

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Field label={label}>
        <Select
          value={cfg.module}
          onChange={(e) => {
            const module = e.target.value as LinkModule;
            onChange({
              module,
              ref:
                module === 'bank' ? bankAccounts[0]?.id
                : module === 'rentals' ? properties[0]?.id
                : module === 'personalLoans' ? loans[0]?.id
                : undefined,
              currencyCode: module === 'cash' ? cashCurrency : undefined,
            });
          }}
        >
          {LINK_MODULES.map((m) => <option key={m} value={m}>{LINK_MODULE_LABELS[m]}</option>)}
        </Select>
      </Field>
      {cfg.module === 'bank' && (
        <Field label="Account">
          <Select value={cfg.ref ?? ''} onChange={(e) => onChange({ ...cfg, ref: e.target.value })}>
            {!bankAccounts.length && <option value="">No accounts yet</option>}
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
          </Select>
        </Field>
      )}
      {cfg.module === 'rentals' && (
        <Field label="Property">
          <Select value={cfg.ref ?? ''} onChange={(e) => onChange({ ...cfg, ref: e.target.value })}>
            {!properties.length && <option value="">No properties yet</option>}
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currencyCode})</option>)}
          </Select>
        </Field>
      )}
      {cfg.module === 'personalLoans' && (
        <Field label="Loan">
          <Select value={cfg.ref ?? ''} onChange={(e) => onChange({ ...cfg, ref: e.target.value })}>
            {!loans.length && <option value="">No loans yet</option>}
            {loans.map((l) => <option key={l.id} value={l.id}>{l.person} ({l.currencyCode})</option>)}
          </Select>
        </Field>
      )}
      {currency && <span className="footer-note">{currency}</span>}
    </div>
  );
}

function CreateLinkForm() {
  const ensureSignedIn = useEnsureSignedIn();
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);

  const [date, setDate] = useState(today());
  const [fromAmount, setFromAmount] = useState(0);
  const [toAmount, setToAmount] = useState(0);
  const [differentAmount, setDifferentAmount] = useState(false);
  const [note, setNote] = useState('');
  const [from, setFrom] = useState<LinkSideConfig>({ module: 'cash', currencyCode: cashCurrency });
  const [to, setTo] = useState<LinkSideConfig>({ module: 'bank', ref: bankAccounts[0]?.id });

  // User's own example: "PSX I can only use Zindagi Account for deposits &
  // withdrawals, while I can collect rent each month through a different
  // source" — remembers the last "From" used for each distinct "To" entity
  // (keyed by module+ref, so two rental properties can each have their own
  // usual source) and prefills it whenever "To" changes, without forcing
  // it — the user can still pick something else afterward.
  useEffect(() => {
    const remembered = getLastTransferSource(to);
    if (remembered) setFrom((prev) => ({ ...remembered, currencyCode: remembered.module === 'cash' ? cashCurrency : prev.currencyCode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to.module, to.ref]);

  const fromCurrency = useSideCurrency(from);
  const toCurrency = useSideCurrency(to);
  const currencyMismatch = !!(fromCurrency && toCurrency && fromCurrency !== toCurrency);
  const sameBankAccount = from.module === 'bank' && to.module === 'bank' && from.ref && from.ref === to.ref;
  const pairSupported = isSupportedLinkPair(from.module, to.module);
  const toAmountEffective = differentAmount ? toAmount : fromAmount;

  const submit = async () => {
    if (fromAmount <= 0) return toast('Enter an amount.');
    if (differentAmount && toAmountEffective <= 0) return toast('Enter the amount received on the other side.');
    if (!pairSupported) return toast(`Linking ${LINK_MODULE_LABELS[from.module]} → ${LINK_MODULE_LABELS[to.module]} isn't supported yet.`);
    if (sameBankAccount) return toast('Pick two different bank accounts.');
    if ((from.module === 'bank' && !from.ref) || (to.module === 'bank' && !to.ref)) return toast('Add a bank account first.');
    if ((from.module === 'rentals' && !from.ref) || (to.module === 'rentals' && !to.ref)) return toast('Add a rental property first.');
    if ((from.module === 'personalLoans' && !from.ref) || (to.module === 'personalLoans' && !to.ref)) return toast('Add a personal loan first.');
    if (!(await ensureSignedIn('Sign in to save transfers.'))) return;

    const result = createLinkedTransfer({ date, fromAmount, toAmount: toAmountEffective, from, to, note: note.trim() || undefined });
    if ('error' in result) return toast(`Couldn't create the linked transfer: ${result.error}`);
    rememberTransferSource(to, from);
    toast('Linked transfer created — both sides updated.');
    setFromAmount(0);
    setToAmount(0);
    setDifferentAmount(false);
    setNote('');
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>New linked transfer</h3>
      <p className="footer-note" style={{ marginTop: 0 }}>
        Creates one record on each side and keeps them linked — editing or deleting this transfer later updates both.
        No currency conversion happens; if the two sides use different currencies, enter the real converted amount
        on each side yourself (your bank's rate, a cash exchange receipt, etc.) using "Different amount" below.
      </p>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <SideFields label="From" cfg={from} onChange={setFrom} />
        <span style={{ alignSelf: 'center', fontSize: 18 }}>&rarr;</span>
        <SideFields label="To" cfg={to} onChange={setTo} />
      </div>
      {!pairSupported && (
        <p className="footer-note" style={{ color: 'var(--warn, orange)' }}>
          {LINK_MODULE_LABELS[from.module]} &rarr; {LINK_MODULE_LABELS[to.module]} isn't a supported linked pair yet — this
          only links Cash&harr;Bank, Bank&harr;QSE/PSX cash balances, Bank/Cash&harr;Rentals, Bank/Cash&harr;Personal Loans,
          and Bank/Cash&harr;Funds.
        </p>
      )}
      {currencyMismatch && !differentAmount && (
        <p className="footer-note" style={{ color: 'var(--warn, orange)' }}>
          {fromCurrency} on one side, {toCurrency} on the other — check "Different amount" below and enter the real
          converted amount, or the same number will be copied to both sides as-is.
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`Amount${fromCurrency ? ` (${fromCurrency})` : ''}`}>
          <TextInput type="number" step="0.01" value={fromAmount || ''} onChange={(e) => setFromAmount(Number(e.target.value))} width={110} />
        </Field>
        {differentAmount && (
          <Field label={`Amount received${toCurrency ? ` (${toCurrency})` : ''}`}>
            <TextInput type="number" step="0.01" value={toAmount || ''} onChange={(e) => setToAmount(Number(e.target.value))} width={110} />
          </Field>
        )}
        <Field label="Note">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        <button className="btn" onClick={submit}>
          <PlusIcon />Create link
        </button>
      </div>
      <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={differentAmount} onChange={(e) => setDifferentAmount(e.target.checked)} />
        Different amount on the other side (cross-currency transfer)
      </label>
    </Card>
  );
}

function moduleLabel(
  module: LinkModule,
  ref: string | undefined,
  bankAccounts: { id: string; name: string }[],
  properties: { id: string; name: string }[],
  loans: { id: string; person: string }[],
) {
  if (module === 'bank') return `Banking${ref ? ` (${bankAccounts.find((a) => a.id === ref)?.name ?? '?'})` : ''}`;
  if (module === 'rentals') return `Rentals${ref ? ` (${properties.find((p) => p.id === ref)?.name ?? '?'})` : ''}`;
  if (module === 'personalLoans') return `Personal Loans${ref ? ` (${loans.find((l) => l.id === ref)?.person ?? '?'})` : ''}`;
  return LINK_MODULE_LABELS[module];
}

function LinksList() {
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const qseCurrency = useWorkbookStore((s) => s.workbook.settings.currency);
  const psxCurrency = usePSXWorkbookStore((s) => s.workbook.settings.currency);
  const fundsCurrency = useFundsWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const currencyCtx: CurrencyContext = { cashCurrency, bankAccounts, qseCurrency, psxCurrency, fundsCurrency, properties, loans };
  const [editId, setEditId] = useState<string | null>(null);
  const [editFromAmount, setEditFromAmount] = useState(0);
  const [editToAmount, setEditToAmount] = useState(0);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');

  type Col = 'date' | 'fromAmount' | 'toAmount';
  const sortValue = (l: InterEntityTransfer, col: Col): number | string => (col === 'date' ? l.date : l[col]);
  const { sorted, Th } = useSortableRows(links, sortValue, 'date', 'desc');

  const startEdit = (l: InterEntityTransfer) => {
    setEditId(l.id);
    setEditFromAmount(l.fromAmount);
    setEditToAmount(l.toAmount);
    setEditDate(l.date);
    setEditNote(l.note ?? '');
  };

  const saveEdit = (l: InterEntityTransfer) => {
    if (editFromAmount <= 0 || editToAmount <= 0) return toast('Enter both amounts.');
    const result = updateLinkedTransfer(
      { date: editDate, fromAmount: editFromAmount, toAmount: editToAmount, from: l.from, to: l.to, note: editNote.trim() || undefined },
      l,
    );
    if ('error' in result) return toast(`Couldn't update the linked transfer: ${result.error}`);
    toast('Linked transfer updated — both sides updated.');
    setEditId(null);
  };

  const removeLink = async (l: InterEntityTransfer) => {
    const ok = await confirmDialog(
      'This removes the record on both sides, not just this list — it cannot be undone.',
      'Delete this linked transfer?',
    );
    if (!ok) return;
    deleteLinkCascade(l);
    toast('Linked transfer deleted.');
  };

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="date">Date</Th>
            <th>From</th>
            <th>To</th>
            <Th col="fromAmount">From amt</Th>
            <Th col="toAmount">To amt</Th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) =>
            editId === l.id ? (
              <tr key={l.id}>
                <td><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ width: 130 }} /></td>
                <td>{moduleLabel(l.from.module, l.from.ref, bankAccounts, properties, loans)}</td>
                <td>{moduleLabel(l.to.module, l.to.ref, bankAccounts, properties, loans)}</td>
                <td><input type="number" step="0.01" value={editFromAmount} onChange={(e) => setEditFromAmount(Number(e.target.value))} style={{ width: 90 }} /></td>
                <td><input type="number" step="0.01" value={editToAmount} onChange={(e) => setEditToAmount(Number(e.target.value))} style={{ width: 90 }} /></td>
                <td><input value={editNote} onChange={(e) => setEditNote(e.target.value)} /></td>
                <td>
                  <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={() => saveEdit(l)} />{' '}
                  <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                </td>
              </tr>
            ) : (
              <tr key={l.id}>
                <td>{l.date}</td>
                <td>{moduleLabel(l.from.module, l.from.ref, bankAccounts, properties, loans)}</td>
                <td>{moduleLabel(l.to.module, l.to.ref, bankAccounts, properties, loans)}</td>
                <td>{fmtMoney(l.fromAmount, resolveCurrency(l.from, currencyCtx) || '')}</td>
                <td>{fmtMoney(l.toAmount, resolveCurrency(l.to, currencyCtx) || '')}</td>
                <td>{l.note}</td>
                <td>
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(l)} />{' '}
                  <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => removeLink(l)} />
                </td>
              </tr>
            ),
          )}
          {!sorted.length && <tr><td colSpan={7} className="footer-note">No linked transfers yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function TransferLinksPage({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h1 className="pagetitle">Transfers</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Move money between modules as one linked record instead of two entries that can drift apart. Supports
        Cash&harr;Bank, Bank&harr;QSE/PSX cash balances, Bank/Cash&harr;Rentals (rent received or an expense paid),
        Bank/Cash&harr;Personal Loans (a repayment logged against a specific loan), and Bank/Cash&harr;Funds (a
        deposit or withdrawal against Funds' cash balance); other module pairs aren't wired up yet.
      </p>
      <CreateLinkForm />
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Linked transfers</h3>}>
        <LinksList />
      </CollapsibleCard>
      {firebaseReady && (
        <Card style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Account</h3>
          <p className="footer-note">{syncStatus}</p>
          {cloudEmpty && (
            <Notice tone="warning" style={{ marginTop: 8 }}>
              <p style={{ marginTop: 0 }}>
                No data found in the cloud for this account's linked transfers. This app will <strong>not</strong>{' '}
                upload anything automatically — if you expected existing data here and don't see it, stop and
                investigate before uploading rather than overwriting.
              </p>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={async () => {
                  const ok = await confirmDialog(
                    `This will overwrite anything currently in the cloud for this account's linked transfers (there is nothing there now, but confirming since this can't be undone).`,
                    `Upload ${links.length} local link${links.length === 1 ? '' : 's'} to the cloud?`,
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
                Upload local data to cloud ({links.length} links)
              </button>
            </Notice>
          )}
        </Card>
      )}
    </div>
  );
}
