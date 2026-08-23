import type { User } from 'firebase/auth';
import { useMemo, useState } from 'react';
import { Card } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { fmtMoney } from '../../../lib/format';
import { buildLinkedRecords, isSupportedLinkPair, type LinkSideRecord } from '../../../lib/interEntityLink';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import { LINK_MODULES, LINK_MODULE_LABELS, type InterEntityTransfer, type LinkModule, type LinkSideConfig } from '../../../types/interEntityTransfer';

const today = () => new Date().toISOString().slice(0, 10);

/** Dispatches a side record into the module store it belongs to. Not pure
 * (touches live stores) and not unit-tested — same split as the rest of the
 * app: `lib/interEntityLink.ts`'s record-building is pure and tested,
 * wiring the result into each store is page-level glue verified live in
 * the browser, matching e.g. the Bank CSV-import wiring in BankPage.tsx. */
function dispatchAdd(side: LinkSideRecord) {
  switch (side.module) {
    case 'cash': return useCashWorkbookStore.getState().addEntry(side.record);
    case 'bank': return useBankWorkbookStore.getState().addTransaction(side.record);
    case 'qse': return useWorkbookStore.getState().addTransfer(side.record);
    case 'psx': return usePSXWorkbookStore.getState().addTransfer(side.record);
  }
}

function dispatchUpdate(side: LinkSideRecord) {
  switch (side.module) {
    case 'cash': return useCashWorkbookStore.getState().updateEntry(side.record.id, side.record);
    case 'bank': return useBankWorkbookStore.getState().updateTransaction(side.record.id, side.record);
    case 'qse': return useWorkbookStore.getState().updateTransfer(side.record.id, side.record);
    case 'psx': return usePSXWorkbookStore.getState().updateTransfer(side.record.id, side.record);
  }
}

function dispatchRemove(module: LinkModule, id: string) {
  switch (module) {
    case 'cash': return useCashWorkbookStore.getState().deleteEntry(id);
    case 'bank': return useBankWorkbookStore.getState().deleteTransaction(id);
    case 'qse': return useWorkbookStore.getState().deleteTransfer(id);
    case 'psx': return usePSXWorkbookStore.getState().deleteTransfer(id);
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
  switch (cfg.module) {
    case 'cash': return cashCurrency;
    case 'bank': return bankAccounts.find((a) => a.id === cfg.ref)?.currencyCode ?? null;
    case 'qse': return qseCurrency;
    case 'psx': return psxCurrency;
  }
}

function SideFields({ label, cfg, onChange }: { label: string; cfg: LinkSideConfig; onChange: (cfg: LinkSideConfig) => void }) {
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
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
              ref: module === 'bank' ? bankAccounts[0]?.id : undefined,
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
      {currency && <span className="footer-note">{currency}</span>}
    </div>
  );
}

function CreateLinkForm() {
  const ensureSignedIn = useEnsureSignedIn();
  const addLink = useInterEntityTransfersStore((s) => s.addEntry);
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);

  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [from, setFrom] = useState<LinkSideConfig>({ module: 'cash', currencyCode: cashCurrency });
  const [to, setTo] = useState<LinkSideConfig>({ module: 'bank', ref: bankAccounts[0]?.id });

  const fromCurrency = useSideCurrency(from);
  const toCurrency = useSideCurrency(to);
  const currencyMismatch = !!(fromCurrency && toCurrency && fromCurrency !== toCurrency);
  const sameBankAccount = from.module === 'bank' && to.module === 'bank' && from.ref && from.ref === to.ref;
  const pairSupported = isSupportedLinkPair(from.module, to.module);

  const submit = async () => {
    if (amount <= 0) return toast('Enter an amount.');
    if (!pairSupported) return toast(`Linking ${LINK_MODULE_LABELS[from.module]} → ${LINK_MODULE_LABELS[to.module]} isn't supported yet.`);
    if (sameBankAccount) return toast('Pick two different bank accounts.');
    if ((from.module === 'bank' && !from.ref) || (to.module === 'bank' && !to.ref)) return toast('Add a bank account first.');
    if (!(await ensureSignedIn('Sign in to save transfers.'))) return;

    const ids = { linkId: crypto.randomUUID(), fromRecordId: crypto.randomUUID(), toRecordId: crypto.randomUUID() };
    const { from: fromRecord, to: toRecord, link } = buildLinkedRecords({ date, amount, from, to, note: note.trim() || undefined }, ids);
    dispatchAdd(fromRecord);
    dispatchAdd(toRecord);
    addLink(link);
    toast('Linked transfer created — both sides updated.');
    setAmount(0);
    setNote('');
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>New linked transfer</h3>
      <p className="footer-note" style={{ marginTop: 0 }}>
        Creates one record on each side and keeps them linked — editing or deleting this transfer later updates both.
        No currency conversion happens; enter the amount in matching units on both sides.
      </p>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <SideFields label="From" cfg={from} onChange={setFrom} />
        <span style={{ alignSelf: 'center', fontSize: 18 }}>&rarr;</span>
        <SideFields label="To" cfg={to} onChange={setTo} />
      </div>
      {!pairSupported && (
        <p className="footer-note" style={{ color: 'var(--warn, orange)' }}>
          {LINK_MODULE_LABELS[from.module]} &rarr; {LINK_MODULE_LABELS[to.module]} isn't a supported linked pair yet — v1 only
          links Cash&harr;Bank and Bank&harr;QSE/PSX cash balances.
        </p>
      )}
      {currencyMismatch && (
        <p className="footer-note" style={{ color: 'var(--warn, orange)' }}>
          {fromCurrency} on one side, {toCurrency} on the other — the amount won't be converted, just copied as-is.
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Amount">
          <TextInput type="number" step="0.01" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} width={110} />
        </Field>
        <Field label="Note">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={submit}>
          <PlusIcon />Create link
        </button>
      </div>
    </Card>
  );
}

function moduleLabel(module: LinkModule, ref: string | undefined, bankAccounts: { id: string; name: string }[]) {
  if (module === 'bank') return `Banking${ref ? ` (${bankAccounts.find((a) => a.id === ref)?.name ?? '?'})` : ''}`;
  return LINK_MODULE_LABELS[module];
}

function LinksList() {
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const updateLink = useInterEntityTransfersStore((s) => s.updateEntry);
  const deleteLink = useInterEntityTransfersStore((s) => s.deleteEntry);
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');

  const sorted = useMemo(() => [...links].sort((a, b) => b.date.localeCompare(a.date)), [links]);

  const startEdit = (l: InterEntityTransfer) => {
    setEditId(l.id);
    setEditAmount(l.amount);
    setEditDate(l.date);
    setEditNote(l.note ?? '');
  };

  const saveEdit = (l: InterEntityTransfer) => {
    if (editAmount <= 0) return toast('Enter an amount.');
    const ids = { linkId: l.id, fromRecordId: l.fromRecordId, toRecordId: l.toRecordId };
    const { from, to, link } = buildLinkedRecords(
      { date: editDate, amount: editAmount, from: l.from, to: l.to, note: editNote.trim() || undefined },
      ids,
    );
    dispatchUpdate(from);
    dispatchUpdate(to);
    updateLink(l.id, link);
    toast('Linked transfer updated — both sides updated.');
    setEditId(null);
  };

  const removeLink = async (l: InterEntityTransfer) => {
    const ok = await confirmDialog(
      'This removes the record on both sides, not just this list — it cannot be undone.',
      'Delete this linked transfer?',
    );
    if (!ok) return;
    dispatchRemove(l.from.module, l.fromRecordId);
    dispatchRemove(l.to.module, l.toRecordId);
    deleteLink(l.id);
    toast('Linked transfer deleted.');
  };

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) =>
            editId === l.id ? (
              <tr key={l.id}>
                <td><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ width: 130 }} /></td>
                <td>{moduleLabel(l.from.module, l.from.ref, bankAccounts)}</td>
                <td>{moduleLabel(l.to.module, l.to.ref, bankAccounts)}</td>
                <td><input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} style={{ width: 90 }} /></td>
                <td><input value={editNote} onChange={(e) => setEditNote(e.target.value)} /></td>
                <td>
                  <button className="btn secondary small" onClick={() => saveEdit(l)}><SaveIcon size={12} />Save</button>{' '}
                  <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={l.id}>
                <td>{l.date}</td>
                <td>{moduleLabel(l.from.module, l.from.ref, bankAccounts)}</td>
                <td>{moduleLabel(l.to.module, l.to.ref, bankAccounts)}</td>
                <td>{fmtMoney(l.amount, l.from.currencyCode || '')}</td>
                <td>{l.note}</td>
                <td>
                  <button className="btn secondary small" onClick={() => startEdit(l)}>Edit</button>{' '}
                  <button className="btn secondary small" onClick={() => removeLink(l)}><TrashIcon size={12} />Delete</button>
                </td>
              </tr>
            ),
          )}
          {!sorted.length && <tr><td colSpan={6} className="footer-note">No linked transfers yet.</td></tr>}
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
        Move money between modules as one linked record instead of two entries that can drift apart. v1 supports
        Cash&harr;Bank and Bank&harr;QSE/PSX cash balances; other module pairs aren't wired up yet.
      </p>
      <CreateLinkForm />
      <Card>
        <h3 style={{ marginTop: 0 }}>Linked transfers</h3>
        <LinksList />
      </Card>
      {firebaseReady && (
        <Card style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Account</h3>
          <p className="footer-note">{syncStatus}</p>
          {cloudEmpty && (
            <div className="card" style={{ marginTop: 8, borderLeft: '3px solid var(--warn, orange)' }}>
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
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
