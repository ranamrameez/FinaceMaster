import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, EntityCard, MoneyValue } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { hueStyle } from '../../../lib/statCardHues';
import { ArchiveIcon, CheckIcon, EditIcon, PlusIcon, RestoreIcon, SaveIcon, StarIcon, TransferIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { PendingToggle } from '../../../components/ui/PendingToggle';
import { IconButton } from '../../../components/ui/IconButton';
import { FabPanel } from '../../../components/ui/Fab';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { RecordDetailModal } from '../../../components/RecordDetailModal';
import { useEnabledCurrencies } from '../../../hooks/useEnabledCurrencies';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { ReorderButtons } from '../../../components/ui/ReorderButtons';
import { dateOnlyMs } from '../../../lib/datetime';
import { parseCSV, toCSV } from '../../../lib/csv';
import { fmtMoney } from '../../../lib/format';
import { confirmAndDeleteLinkable, propagateLinkedEdit, resolveLinkedEdit } from '../../../lib/linkCascade';
import {
  loanBalanceHistory,
  loanOutstanding,
  loanPendingImpact,
  netPendingByCurrency,
  netPositionByCurrency,
  outstandingByLoan,
  projectPayoff,
  repaymentRunningOutstanding,
  repaymentsByMonth,
} from '../../../lib/calc/personalLoansModule';
import { dlBarV, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar } from '../../../lib/cssVar';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { usePersonalLoansWorkbookStore } from '../../../store/personalLoansWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath, useLinkSideLabel } from '../../transfers/pages/TransferLinksPage';
import type { PersonalLoan, PersonalLoanRepayment } from '../../../types/personalLoansWorkbook';
import { ChartCard } from '../../qse/components/ChartCard';
import { gridAutoStyle } from '../../../lib/gridStyle';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLoan(defaultCurrency: string): PersonalLoan {
  return { id: '', person: '', direction: 'owed_to_me', currencyCode: defaultCurrency, principal: 0, date: today(), note: '' };
}

function NetPositionSummary() {
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const net = netPositionByCurrency(loans, repayments);
  const pending = netPendingByCurrency(loans, repayments);
  const codes = Object.keys(net);
  if (!codes.length) return null;

  return (
    <div className="grid-auto" style={{ ...gridAutoStyle(150, 8), marginBottom: 16 }}>
      {codes.map((code) => {
        const realPending = pending[code] ?? 0;
        return (
          <div key={code} className="stat-card card" style={hueStyle(net[code] >= 0 ? 'var(--profit)' : 'var(--loss)')}>
            <div className="label">Net position ({code})</div>
            <MoneyValue n={net[code]} currency={code} />
            <div className="sub">{net[code] >= 0 ? 'Net owed to you' : 'Net you owe'}</div>
            {/* User-requested (2026-09-08): don't just exclude pending
               repayments from the headline figure — show it too. */}
            {realPending !== 0 && (
              <div className="sub">
                {realPending > 0 ? '+' : ''}{fmtMoney(realPending, code)} pending → {fmtMoney(net[code] + realPending, code)} incl. pending
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** README item 23 / MODULES_PLAN.md §11: per-module Analytics, second
 * module (after Cash). The two charts sketched there — outstanding-by-
 * person, and a repayment timeline; the "payoff planner" from that same
 * sketch lives inside `LoanDetail` below instead, since it needs one
 * specific loan's outstanding balance to project from. */
function AnalyticsTab() {
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const currencies = useMemo(() => [...new Set(loans.map((l) => l.currencyCode))].sort(), [loans]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

  const outstandingRows = useMemo(
    () => outstandingByLoan(loans, repayments, effectiveCurrency),
    [loans, repayments, effectiveCurrency],
  );
  const monthlyRepayments = useMemo(
    () => repaymentsByMonth(loans, repayments, effectiveCurrency),
    [loans, repayments, effectiveCurrency],
  );

  if (!currencies.length) {
    return <p className="text-muted">Add a loan first to see charts here.</p>;
  }

  return (
    <div>
      {currencies.length > 1 && (
        <Field label="Currency" width={120}>
          <Select value={effectiveCurrency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid-auto" style={{ ...gridAutoStyle(320, 16), marginTop: 12 }}>
        <ChartCard title="Outstanding by loan" empty={!outstandingRows.length}>
          <Bar
            data={{
              labels: outstandingRows.map((r) => r.person),
              datasets: [
                {
                  data: outstandingRows.map((r) => r.outstanding),
                  backgroundColor: outstandingRows.map((r) => (r.direction === 'owed_to_me' ? cssVar('--profit') || '#3ecf8e' : cssVar('--loss') || '#e5484d')),
                },
              ],
            }}
            options={{
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                datalabels: dlBarV((v) => fmtMoney(v, effectiveCurrency)),
                tooltip: { callbacks: { afterLabel: (ctx) => (outstandingRows[ctx.dataIndex].direction === 'owed_to_me' ? 'Owed to you' : 'You owe') } },
              },
            }}
          />
        </ChartCard>
        <ChartCard title="Repayments by month" empty={!monthlyRepayments.length}>
          <Bar
            data={{
              labels: monthlyRepayments.map((f) => f.month),
              datasets: [{ label: 'Repayments', data: monthlyRepayments.map((f) => f.amount), backgroundColor: '#5aa9c9' }],
            }}
            options={{ plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
      </div>
    </div>
  );
}

/** Floating "add a loan" button (user feedback 2026-08-27: adding an entity
 * isn't a routine task, use FABs — same pattern already established for
 * EMI/Banking/Cash/Bank Planning, README Done items 166/170).
 *
 * User-reported (2026-08-28, real audit after "you're ignoring what's
 * asked for"): Bank's and EMI's landing FABs shipped with Transfers
 * alongside "Add [entity]," but Personal Loans/Rentals/Funds only ever got
 * Transfers on a specific record's own detail view — contradicting the
 * original ask for one Transfers button reachable everywhere. Matches
 * Bank's/EMI's landing-FAB shape exactly now: Transfers with no `ref`
 * pre-filled, still choosable from `SideFields`' own dropdown inside the
 * modal. */
function AddLoanFab() {
  const [open, setOpen] = useState<'loan' | 'transfer' | null>(null);
  return (
    <>
      <FabPanel
        actions={[
          { label: 'Add a loan', icon: <PlusIcon />, onClick: () => setOpen('loan') },
          { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
        ]}
      />
      {open === 'loan' && (
        <Modal title="Add a loan" onClose={() => setOpen(null)}>
          <AddLoanForm onSaved={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'transfer' && <TransactionEntryModal defaultFinance={{ module: 'personalLoans' }} onClose={() => setOpen(null)} />}
    </>
  );
}

/** `initialCurrency`/`onSaved(id)` — see `AddAccountForm`'s own comment
 * (`features/bank/pages/BankPage.tsx`) for why: the shared "+" quick-add in
 * `SideFields` reuses this exact form from `TransactionEntryModal`. */
export function AddLoanForm({ onSaved, initialCurrency }: { onSaved?: (id: string) => void; initialCurrency?: string } = {}) {
  const addLoan = usePersonalLoansWorkbookStore((s) => s.addLoan);
  const defaultCurrency = usePersonalLoansWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const [lastCurrency, setLastCurrency] = useLastCurrency('personalLoans', defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [l, setL] = useState<PersonalLoan>(() => emptyLoan(initialCurrency ?? lastCurrency));
  const currencyOptions = useEnabledCurrencies(l.currencyCode);

  const submit = async () => {
    if (!l.person.trim()) return toast('Enter a person/lender name.');
    if (!l.principal || l.principal <= 0) return toast('Enter a principal amount.');
    if (!(await ensureSignedIn('Sign in to save personal loans.'))) return;
    const id = crypto.randomUUID();
    addLoan({ ...l, id, person: l.person.trim(), note: l.note?.trim() || undefined });
    toast(`Loan with ${l.person.trim()} saved.`);
    setL(emptyLoan(l.currencyCode));
    onSaved?.(id);
  };

  return (
    <div>
      <div className="row gap-sm">
        <Field label="Person / lender" width={160} required>
          <TextInput value={l.person} onChange={(e) => setL({ ...l, person: e.target.value })} placeholder="e.g. Bilal" />
        </Field>
        <Field label="Direction" width={160}>
          <Select value={l.direction} onChange={(e) => setL({ ...l, direction: e.target.value as PersonalLoan['direction'] })}>
            <option value="owed_to_me">Money I lent out</option>
            <option value="i_owe">Money I owe</option>
          </Select>
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={l.currencyCode} onChange={(e) => { setL({ ...l, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {currencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Principal" width={110} required title="The original amount of the loan, before any repayments.">
          <TextInput type="number" step="0.01" value={l.principal || ''} onChange={(e) => setL({ ...l, principal: Number(e.target.value) })} />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={l.date} onChange={(e) => setL({ ...l, date: e.target.value })} />
        </Field>
        <Field label="Note (optional)" width={180}>
          <TextInput value={l.note} onChange={(e) => setL({ ...l, note: e.target.value })} />
        </Field>
      </div>
      <button className="btn mt-12" onClick={submit}>
        <PlusIcon />Add loan
      </button>
    </div>
  );
}

/** Pending item 62: the direct transfer-link shortcut already on PSX/QSE/
 * Rentals, now on a Personal Loans repayment add-form. `PersonalLoanRepayment`
 * ignores link direction (always positive, see `interEntityLink.ts`'s own
 * documented exception), but which side the REAL Bank/Cash account occupies
 * still depends on the loan's own `direction`: `owed_to_me` means a
 * repayment is money arriving from the other person (Bank/Cash = `to`,
 * receiving), `i_owe` means it's money leaving to pay them back (Bank/Cash
 * = `from`, paying). */
/** User-requested (2026-08-28): the loan's own "Transfers" FAB, replacing
 * the old always-visible add-repayment row AND its own bank/cash-only
 * `LinkedRepaymentFields` shortcut — the shared `TransactionEntryModal`
 * supersedes both, defaulted to THIS loan. */
function RepaymentsFab({ loan }: { loan: PersonalLoan }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabPanel actions={[{ label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen(true) }]} />
      {open && <TransactionEntryModal defaultFinance={{ module: 'personalLoans', ref: loan.id, currencyCode: loan.currencyCode }} onClose={() => setOpen(false)} />}
    </>
  );
}

function RepaymentsSection({ loan }: { loan: PersonalLoan }) {
  // Select the raw array (a stable reference from the store) and filter it
  // in a memo — filtering *inside* the zustand selector would return a new
  // array identity on every render, which zustand's useSyncExternalStore
  // reads as "state changed", risking an infinite re-render loop.
  const allRepayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const repayments = useMemo(() => allRepayments.filter((r) => r.loanId === loan.id), [allRepayments, loan.id]);
  // Independent of the table's own sort order, same reasoning as
  // transferRunningBalance — "Remaining" must reflect the true
  // chronological running total regardless of how rows are displayed.
  const remaining = useMemo(() => repaymentRunningOutstanding(loan, allRepayments), [loan, allRepayments]);
  const updateRepayment = usePersonalLoansWorkbookStore((s) => s.updateRepayment);
  const deleteRepayment = usePersonalLoansWorkbookStore((s) => s.deleteRepayment);
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const ensureSignedIn = useEnsureSignedIn();
  const sideLabel = useLinkSideLabel();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PersonalLoanRepayment | null>(null);
  const [detailRow, setDetailRow] = useState<PersonalLoanRepayment | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const linkByRecordId = useMemo(() => {
    const map = new Map<string, (typeof links)[number]>();
    for (const l of links) {
      if (l.from.module === 'personalLoans') map.set(l.fromRecordId, l);
      if (l.to.module === 'personalLoans') map.set(l.toRecordId, l);
    }
    return map;
  }, [links]);

  /** README item 40: extends Banking's account-detail statement export
   * (Done item 58) to this module's own primary record — a loan's
   * "statement" is its repayment history, with the same running-balance
   * ("Remaining") column already shown in the table. */
  const exportStatement = () => {
    const rows = [...repayments]
      .filter((r) => (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate))
      .sort((a, b) => a.date.localeCompare(b.date));
    const header = ['Date', 'Amount', 'Remaining', 'Source'];
    const body = rows.map((r) => [r.date, r.amount, remaining.get(r.id) ?? 0, r.source === 'statement-import' ? 'Import' : 'Manual']);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'now'}` : '';
    a.download = `${loan.person.replace(/\s+/g, '_')}_repayments${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Statement downloaded.');
  };

  const startEdit = (r: PersonalLoanRepayment) => { setEditId(r.id); setEditRow({ ...r }); };
  const saveEdit = async () => {
    if (editId === null || !editRow) return;
    const choice = await resolveLinkedEdit('personalLoans', editId);
    if (choice === 'cancel') return;
    updateRepayment(editId, editRow);
    let msg = 'Repayment updated.';
    if (choice === 'both') {
      const result = propagateLinkedEdit('personalLoans', editId, { date: editRow.date, amount: editRow.amount });
      if (result.error) msg = result.error;
      else if (result.message) msg = result.message;
    }
    toast(msg);
    setEditId(null);
    setEditRow(null);
  };

  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'statement-import'>('all');
  const filteredRepayments = useMemo(
    () => (sourceFilter === 'all' ? repayments : repayments.filter((r) => (r.source ?? 'manual') === sourceFilter)),
    [repayments, sourceFilter],
  );

  // User-reported (2026-09-06): "we may stop sorting options for
  // chronologically important tables (only sequence-aware tables) to
  // avoid the disordered mess" — same reasoning as Bank's/Cash's own
  // statement tables (Done item 235): a repayment's "Remaining" column
  // only makes sense in real chronological+sequence order, so free column
  // sorting is gone here, replaced by `ReorderButtons` for the one thing
  // that genuinely needs fixing (two same-instant repayments in the wrong
  // relative order).
  const instantOf = (r: PersonalLoanRepayment) => dateOnlyMs(r.date);
  const sorted = useMemo(
    () => [...filteredRepayments].sort((a, b) => instantOf(b) - instantOf(a) || (b.seq ?? 0) - (a.seq ?? 0)),
    [filteredRepayments],
  );
  const reorder = async (pair: [{ id: string; order: number }, { id: string; order: number }]) => {
    if (!(await ensureSignedIn('Sign in to reorder repayments.'))) return;
    for (const p of pair) updateRepayment(p.id, { seq: p.order });
  };

  return (
    <div>
      {/* README item 42's remainder: this component's add-form and list used
       * to have no clean seam for a CollapsibleCard — the form itself is
       * deliberately left outside it (collapsing a form mid-fill is a UX
       * trap, per the same rule every other module's rollout followed), but
       * the table + export controls below it split off cleanly into their
       * own collapsible section. */}
      <CollapsibleCard
        title={<h4 className="m-0">Repayment history</h4>}
        headerExtra={
          repayments.length > 0 ? (
            <div className="row gap-sm">
              <Field label="From (optional)">
                <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label="To (optional)">
                <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <button className="btn secondary" onClick={exportStatement}>Export CSV</button>
            </div>
          ) : undefined
        }
        className="mb-md"
      >
        {/* User-requested (2026-09-03): "add filters to other tables as
           well." */}
        <div className="row gap-sm mb-sm">
          <Field label="Source" width={140}>
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}>
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="statement-import">Imported</option>
            </Select>
          </Field>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date</th><th>Amount</th><th>Remaining</th><th>Source</th><th></th></tr></thead>
            <tbody>
              {sorted.map((r, i) => {
                const link = linkByRecordId.get(r.id);
                const otherSide = link ? (link.from.module === 'personalLoans' && link.fromRecordId === r.id ? link.to : link.from) : undefined;
                return editId === r.id && editRow ? (
                  <tr key={r.id}>
                    <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                    <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
                    <td></td>
                    <td className="text-muted cell-clip">{r.source === 'statement-import' ? `Import${r.statementRef ? ` (${r.statementRef})` : ''}` : 'Manual'}</td>
                    <td>
                      <PendingToggle
                        checked={!!editRow.isPending}
                        onChange={(v) => setEditRow({ ...editRow, isPending: v })}
                        title="Not yet cleared — excluded from Outstanding until unchecked."
                      />{' '}
                      <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                      <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} onClick={() => setDetailRow(r)} className="clickable">
                    <td>
                      {r.date}{' '}
                      <span onClick={(e) => e.stopPropagation()}>
                        <ReorderButtons
                          rows={sorted}
                          index={i}
                          instantOf={instantOf}
                          idOf={(row) => row.id}
                          orderOf={(row) => row.seq}
                          onMove={reorder}
                        />
                      </span>
                    </td>
                    <td>
                      {fmtMoney(r.amount, loan.currencyCode)}
                      {r.isPending && (
                        <Tooltip text="Not yet cleared — excluded from Outstanding above until marked cleared.">
                          <span className="pill-warn" style={{ marginLeft: 6 }}>Pending</span>
                        </Tooltip>
                      )}
                      {link && (
                        <Link to={linkTargetPath(otherSide!)} className="pill-info" style={{ marginLeft: 6, textDecoration: 'none' }} title="Linked — go to the other side" onClick={(e) => e.stopPropagation()}>
                          🔗 {sideLabel(link.from)} → {sideLabel(link.to)}
                        </Link>
                      )}
                    </td>
                    <td>
                      <Tooltip text="Loan balance still remaining after this repayment, in date order.">
                        <span>{fmtMoney(remaining.get(r.id) ?? 0, loan.currencyCode)}</span>
                      </Tooltip>
                    </td>
                    <td className="text-muted cell-clip" title={r.source === 'statement-import' ? `Import${r.statementRef ? ` (${r.statementRef})` : ''}` : 'Manual'}>
                      {r.source === 'statement-import' ? `Import${r.statementRef ? ` (${r.statementRef})` : ''}` : 'Manual'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {r.isPending && (
                        <IconButton
                          label="Mark cleared"
                          icon={<CheckIcon size={13} />}
                          align="right"
                          onClick={async () => {
                            if (!(await ensureSignedIn('Sign in to update this repayment.'))) return;
                            updateRepayment(r.id, { isPending: false });
                            toast('Marked cleared.');
                          }}
                        />
                      )}{' '}
                      <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(r)} />{' '}
                      <IconButton
                        label="Delete"
                        icon={<TrashIcon size={13} />}
                        align="right"
                        onClick={() => confirmAndDeleteLinkable('personalLoans', r.id, () => deleteRepayment(r.id))}
                      />
                    </td>
                  </tr>
                );
              })}
              {!sorted.length && (
                <tr>
                  <td colSpan={5} className="text-muted">
                    {repayments.length ? 'No repayments match this filter.' : 'No repayments logged yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
      <ImportRepaymentsSection loan={loan} />
      <RepaymentsFab loan={loan} />
      {detailRow && (
        <RecordDetailModal
          title="Repayment"
          onClose={() => setDetailRow(null)}
          fields={[
            { label: 'Date', value: detailRow.date },
            { label: 'Time', value: detailRow.time ?? '— (defaults to noon)' },
            { label: 'Timezone', value: detailRow.timezone ?? '—' },
            { label: 'Amount', value: fmtMoney(detailRow.amount, loan.currencyCode) },
            { label: 'Remaining after this repayment', value: fmtMoney(remaining.get(detailRow.id) ?? 0, loan.currencyCode) },
            { label: 'Source', value: detailRow.source === 'statement-import' ? `Import${detailRow.statementRef ? ` (${detailRow.statementRef})` : ''}` : 'Manual' },
            { label: 'Status', value: detailRow.isPending ? 'Pending (not yet cleared)' : 'Cleared' },
            ...(linkByRecordId.get(detailRow.id)
              ? (() => {
                  const l = linkByRecordId.get(detailRow.id)!;
                  return [{ label: 'Linked', value: `${sideLabel(l.from)} → ${sideLabel(l.to)}` }];
                })()
              : []),
          ]}
        />
      )}
    </div>
  );
}

/** README item 25 / MODULES_PLAN.md §13: same browser-only "map these
 * columns" CSV import pattern as Banking/Cash/Rentals. Unlike those
 * modules, a repayment's amount has no direction to derive from a sign —
 * it's always a positive amount against the loan — so there's no
 * "Flip sign" checkbox here, just Date + Amount (absolute value). */
function ImportRepaymentsSection({ loan }: { loan: PersonalLoan }) {
  const addRepayments = usePersonalLoansWorkbookStore((s) => s.addRepayments);
  const ensureSignedIn = useEnsureSignedIn();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState('');
  const [amountCol, setAmountCol] = useState('');

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
      setAmountCol(head[1] ?? '');
    };
    reader.readAsText(file);
  };

  const colIndex = (col: string) => headers.indexOf(col);
  const mapRow = (r: string[]) => ({
    date: (r[colIndex(dateCol)] ?? '').trim(),
    amount: Math.abs(Number(r[colIndex(amountCol)] ?? 0)),
  });
  const mappedPreview = rows.slice(0, 5).map(mapRow);

  const doImport = async () => {
    if (!dateCol || !amountCol) return toast('Map both the date and amount columns.');
    if (!(await ensureSignedIn('Sign in to import repayments.'))) return;
    const imported: PersonalLoanRepayment[] = rows
      .map(mapRow)
      .filter((r) => r.date && !Number.isNaN(r.amount) && r.amount !== 0)
      .map((r) => ({
        id: crypto.randomUUID(),
        loanId: loan.id,
        date: r.date,
        amount: r.amount,
        source: 'statement-import' as const,
        statementRef: fileName,
      }));
    if (!imported.length) return toast('No valid rows to import after mapping — check your column choices.');
    addRepayments(imported);
    toast(`Imported ${imported.length} repayment${imported.length === 1 ? '' : 's'} from ${fileName}.`);
    setHeaders([]);
    setRows([]);
    setFileName('');
  };

  return (
    <Card className="mt-12">
      <h4 className="mt-0">Import repayments (CSV)</h4>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <button className="btn secondary small" onClick={() => fileInput.current?.click()}>Choose CSV file</button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
        {fileName && <span className="text-muted">{fileName} ({rows.length} rows)</span>}
      </div>

      {headers.length > 0 && (
        <div className="mt-12">
          <div className="row gap-sm">
            <Field label="Date column" width={160}>
              <Select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <Field label="Amount column" width={160}>
              <Select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
          </div>
          <div className="table-scroll mt-sm">
            <table>
              <thead><tr><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                {mappedPreview.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{fmtMoney(r.amount, loan.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn secondary mt-12" onClick={doImport}>
            <PlusIcon />Import {rows.length} repayment{rows.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </Card>
  );
}

/** The "payoff planner" from MODULES_PLAN.md §11's Personal Loans sketch —
 * unlike EMI/Loans there's no interest/schedule concept for an informal
 * debt, so this is just "how many months at this repayment rate clears
 * what's left," recomputed live as the user types (nothing is saved). */
/** README item 99 (2026-08-26 feedback): no chart at all on a loan's own
 * detail page — the landing-page Analytics tab's charts (Done item 45)
 * are all scoped across every loan, not this one. A single balance-over-
 * time line is enough to show progress at a glance without duplicating
 * the full repayments table right below it. */
function LoanBalanceChart({ loan, repayments }: { loan: PersonalLoan; repayments: PersonalLoanRepayment[] }) {
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const history = useMemo(() => loanBalanceHistory(loan, repayments), [loan, repayments]);
  if (history.length < 2) return null; // nothing to chart until at least one repayment exists

  return (
    <ChartCard title="Balance over time">
      <Line
        data={{
          labels: history.map((p) => p.date),
          datasets: [{
            label: 'Outstanding',
            data: history.map((p) => p.balance),
            borderColor: '#5aa9c9',
            backgroundColor: '#5aa9c933',
            fill: true,
            tension: 0.2,
          }],
        }}
        options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtMoney(v, loan.currencyCode)) } }}
      />
    </ChartCard>
  );
}

function PayoffPlanner({ loan, outstanding }: { loan: PersonalLoan; outstanding: number }) {
  const [monthly, setMonthly] = useState(0);
  const projection = monthly > 0 ? projectPayoff(outstanding, monthly, today()) : null;

  if (outstanding <= 0) return null;

  return (
    <Card className="mb-md">
      <h4 className="mt-0">Payoff planner</h4>
      <p className="text-muted mt-0">
        A quick "what if" — see how many months it'd take to clear the remaining {fmtMoney(outstanding, loan.currencyCode)}
        {' '}at a repayment rate you pick. Not saved anywhere, just a live estimate.
      </p>
      <Field label={`Planned monthly repayment (${loan.currencyCode})`} width={200}>
        <TextInput type="number" step="0.01" value={monthly || ''} onChange={(e) => setMonthly(Number(e.target.value))} />
      </Field>
      {monthly > 0 && (
        projection ? (
          <p style={{ marginBottom: 0 }}>
            At {fmtMoney(monthly, loan.currencyCode)}/month, this loan would be paid off in{' '}
            <strong>{projection.months} month{projection.months === 1 ? '' : 's'}</strong>, around <strong>{projection.payoffDate}</strong>.
          </p>
        ) : (
          <p className="text-muted" style={{ marginBottom: 0 }}>Enter a positive monthly amount to project a payoff date.</p>
        )
      )}
    </Card>
  );
}

function LoanDetail({ loan, onBack, startInEditMode }: { loan: PersonalLoan; onBack: () => void; startInEditMode?: boolean }) {
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const deleteLoan = usePersonalLoansWorkbookStore((s) => s.deleteLoan);
  const updateLoan = usePersonalLoansWorkbookStore((s) => s.updateLoan);
  const ensureSignedIn = useEnsureSignedIn();
  const [editing, setEditing] = useState(!!startInEditMode);
  const [editRow, setEditRow] = useState<PersonalLoan>(loan);
  const currencyOptions = useEnabledCurrencies(editRow.currencyCode);
  const outstanding = loanOutstanding(loan, repayments);
  const pendingImpact = loanPendingImpact(loan, repayments);

  // User-requested (2026-09-03): "add isActive flag to all modules where
  // applicable" — same archive/restore pattern as `BankAccount.isActive`.
  // A reversible alternative to Delete; visibility only, never touches a
  // total.
  const toggleArchived = async () => {
    if (!(await ensureSignedIn(loan.isActive === false ? 'Sign in to reopen this loan.' : 'Sign in to close this loan.'))) return;
    updateLoan(loan.id, { isActive: loan.isActive === false ? true : false });
    toast(loan.isActive === false ? 'Loan reopened.' : 'Loan closed.');
  };

  return (
    <div>
      <button className="btn secondary small mb-12" onClick={onBack}>← All personal loans</button>
      <Card className="mb-md">
        {editing ? (
          <div>
            <div className="row gap-sm">
              <Field label="Person / lender">
                <TextInput value={editRow.person} onChange={(e) => setEditRow({ ...editRow, person: e.target.value })} />
              </Field>
              <Field label="Direction">
                <Select value={editRow.direction} onChange={(e) => setEditRow({ ...editRow, direction: e.target.value as PersonalLoan['direction'] })}>
                  <option value="owed_to_me">Money I lent out</option>
                  <option value="i_owe">Money I owe</option>
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                  {currencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
              </Field>
              <Field label="Principal">
                <TextInput type="number" step="0.01" value={editRow.principal} onChange={(e) => setEditRow({ ...editRow, principal: Number(e.target.value) })} />
              </Field>
              <Field label="Date">
                <TextInput type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} />
              </Field>
              <Field label="Note (optional)">
                <TextInput value={editRow.note ?? ''} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} />
              </Field>
            </div>
            <div className="row gap-sm mt-sm">
              <IconButton
                label="Save"
                icon={<SaveIcon size={13} />}
                align="right"
                onClick={() => { updateLoan(loan.id, editRow); toast('Loan updated.'); setEditing(false); }}
              />
              <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditing(false)} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                {loan.person}
                {loan.isActive === false && <span className="pill-warn" style={{ fontSize: 11 }}>Closed</span>}
              </div>
              <div className="text-muted">
                {loan.direction === 'owed_to_me' ? 'Money lent out' : 'Money I owe'} · {loan.currencyCode} · since {loan.date}
              </div>
              {loan.note && <div className="text-muted">{loan.note}</div>}
            </div>
            <div className="row gap-sm">
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => { setEditRow(loan); setEditing(true); }} />
              <IconButton
                label={loan.isActive === false ? 'Reopen' : 'Close'}
                icon={loan.isActive === false ? <RestoreIcon size={13} /> : <ArchiveIcon size={13} />}
                align="right"
                onClick={toggleArchived}
              />
              <IconButton
                label="Delete"
                icon={<TrashIcon size={13} />}
                align="right"
                onClick={async () => {
                  if (await confirmDialog('This deletes the loan and all its logged repayments.', `Delete loan with ${loan.person}?`)) {
                    deleteLoan(loan.id);
                    onBack();
                  }
                }}
              />
            </div>
          </div>
        )}
        <div className="grid-auto" style={{ ...gridAutoStyle(120, 8), marginTop: 12 }}>
          <div className="stat-card card">
            <Tooltip text="The original amount of the loan, before any repayments.">
              <div className="label clickable">Principal</div>
            </Tooltip>
            <MoneyValue n={loan.principal} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(loan.direction === 'owed_to_me' ? 'var(--profit)' : 'var(--loss)')}>
            <Tooltip text="How much of this loan is still unpaid, after subtracting all repayments logged so far.">
              <div className="label clickable">Outstanding</div>
            </Tooltip>
            <MoneyValue n={outstanding} currency={loan.currencyCode} />
            {pendingImpact !== 0 && (
              <div className="sub">
                -{fmtMoney(pendingImpact, loan.currencyCode)} pending → {fmtMoney(Math.max(0, outstanding - pendingImpact), loan.currencyCode)} incl. pending
              </div>
            )}
          </div>
        </div>
      </Card>
      {/* README item 100 of a 2026-08-26 feedback batch: repayments (real
         transactions) are more important than the payoff planner (a "what
         if" estimate), so they come first. */}
      <h3>Repayments</h3>
      <RepaymentsSection loan={loan} />
      <LoanBalanceChart loan={loan} repayments={repayments} />
      <PayoffPlanner loan={loan} outstanding={outstanding} />
    </div>
  );
}

/** Pending item 114: "Main tier: entity items as CARDS rather than long
 * tables with custom reordering options" — converted from a sortable
 * table to an `EntityCard` grid, same pattern already rolled out to
 * Banking's `AccountsList`/`BanksList` and Funds' `BrokersList`. The old
 * per-column sort is gone on purpose (rule 1); ordering is now
 * favorite-first (same "favorites float to the top" convention every
 * other `EntityCard` grid in the app already uses), with Sr# still shown
 * from the loan's own stable creation-order position. */
function LoanList({ onSelect, onEdit }: { onSelect: (loan: PersonalLoan) => void; onEdit: (loan: PersonalLoan) => void }) {
  const allLoans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const updateLoan = usePersonalLoansWorkbookStore((s) => s.updateLoan);
  const ensureSignedIn = useEnsureSignedIn();
  const [filter, setFilter] = useState<'all' | 'owed_to_me' | 'i_owe'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(() => allLoans.filter((l) => l.isActive === false).length, [allLoans]);
  const loans = useMemo(() => (showArchived ? allLoans : allLoans.filter((l) => l.isActive !== false)), [allLoans, showArchived]);
  const filtered = useMemo(
    () => (filter === 'all' ? loans : loans.filter((l) => l.direction === filter)).sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite)),
    [loans, filter],
  );
  // Pending item 115(c): Sr# = the loan's own stable position in the
  // underlying (unfiltered) array, creation order — not this grid's own
  // favorite-first display order. Same convention as Bank/Funds.
  const srNumOf = useMemo(() => new Map(allLoans.map((l, i) => [l.id, i + 1])), [allLoans]);

  const toggleFavorite = async (l: PersonalLoan) => {
    if (!(await ensureSignedIn(l.isFavorite ? 'Sign in to unfavorite this loan.' : 'Sign in to favorite this loan.'))) return;
    updateLoan(l.id, { isFavorite: !l.isFavorite });
  };

  return (
    <div>
      <div className="row gap-sm mb-sm">
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All directions</option>
          <option value="owed_to_me">Money I lent out</option>
          <option value="i_owe">Money I owe</option>
        </select>
        {archivedCount > 0 && (
          <button className="btn secondary small" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide' : 'Show'} closed ({archivedCount})
          </button>
        )}
      </div>
      {!filtered.length ? (
        <p className="text-muted">
          {allLoans.length ? 'Every loan is closed — click "Show closed" above to see them.' : 'No personal loans yet.'}
        </p>
      ) : (
        <div className="entity-card-grid">
          {filtered.map((l) => {
            const outstanding = loanOutstanding(l, repayments);
            return (
              <EntityCard
                key={l.id}
                title={<><span className="text-muted entity-card-sr">#{srNumOf.get(l.id)}</span>{l.person}</>}
                subtitle={l.direction === 'owed_to_me' ? 'Lent out' : 'I owe'}
                badge={l.isActive === false ? <span className="pill-warn" style={{ fontSize: 10 }}>Closed</span> : undefined}
                statLabel="Outstanding"
                stat={<MoneyValue n={outstanding} currency={l.currencyCode} />}
                hue={l.direction === 'owed_to_me' ? 'var(--profit)' : 'var(--loss)'}
                onClick={() => onSelect(l)}
                actions={
                  <>
                    <IconButton
                      label={l.isFavorite ? 'Unfavorite' : 'Favorite'}
                      icon={<StarIcon size={13} filled={l.isFavorite} />}
                      align="right"
                      onClick={() => toggleFavorite(l)}
                    />
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => onEdit(l)} />
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// User-reported (2026-08-27, then again 2026-08-28): duplicated the global
// /account hub's own Sync status section — dropped the status text/heading
// here, same fix already applied app-wide (see BankPage.tsx for the
// fullest write-up).
function AccountSection({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <Card>
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
          <p className="mt-0">
            No data found in the cloud for this account's Personal Loans workbook. This won't upload automatically.
          </p>
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

export function PersonalLoansPage({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<PersonalLoan | null>(null);
  const [editOnOpen, setEditOnOpen] = useState(false);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const liveSelected = selected ? loans.find((l) => l.id === selected.id) ?? null : null;

  const openLoan = (loan: PersonalLoan) => { setEditOnOpen(false); setSelected(loan); };
  const editLoan = (loan: PersonalLoan) => { setEditOnOpen(true); setSelected(loan); };

  return (
    <div>
      <h1 className="pagetitle">Personal Loans</h1>
      <p className="text-muted mb-12">
        Informal loans with another person, tracked in either direction — money you lent out, or money you owe —
        with a combined net position. No repayment schedule automation; if this loan actually has a real interest
        schedule, it probably belongs in EMI/Loans instead.
      </p>
      {liveSelected ? (
        <LoanDetail loan={liveSelected} onBack={() => setSelected(null)} startInEditMode={editOnOpen} />
      ) : (
        <div>
          <Tabs
            tabs={[
              {
                key: 'loans',
                label: 'Loans',
                content: (
                  <div>
                    <NetPositionSummary />
                    <LoanList onSelect={openLoan} onEdit={editLoan} />
                    <AddLoanFab />
                  </div>
                ),
              },
              { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
            ]}
          />
          <div className="mt-md">
            <AccountSection cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
          </div>
        </div>
      )}
    </div>
  );
}
