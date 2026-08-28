import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { hueStyle } from '../../../lib/statCardHues';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { FabButton } from '../../../components/ui/Fab';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { CURRENCIES } from '../../../lib/currencies';
import { defaultTimezoneForCurrency } from '../../../lib/datetime';
import { parseCSV, toCSV } from '../../../lib/csv';
import { fmtMoney } from '../../../lib/format';
import { confirmAndDeleteLinkable, createLinkedTransfer, warnIfLinked } from '../../../lib/linkCascade';
import { getLastTransferSource, rememberTransferSource } from '../../../hooks/useLastTransferSource';
import type { LinkSideConfig } from '../../../types/interEntityTransfer';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import {
  loanBalanceHistory,
  loanOutstanding,
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
import type { PersonalLoan, PersonalLoanRepayment } from '../../../types/personalLoansWorkbook';
import { ChartCard } from '../../qse/components/ChartCard';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLoan(defaultCurrency: string): PersonalLoan {
  return { id: '', person: '', direction: 'owed_to_me', currencyCode: defaultCurrency, principal: 0, date: today(), note: '' };
}

function NetPositionSummary() {
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const net = netPositionByCurrency(loans, repayments);
  const codes = Object.keys(net);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="stat-card card" style={hueStyle(net[code] >= 0 ? 'var(--profit)' : 'var(--loss)')}>
          <div className="label">Net position ({code})</div>
          <MoneyValue n={net[code]} currency={code} />
          <div className="sub">{net[code] >= 0 ? 'Net owed to you' : 'Net you owe'}</div>
        </div>
      ))}
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
    return <p className="footer-note">Add a loan first to see charts here.</p>;
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
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
 * EMI/Banking/Cash/Bank Planning, README Done items 166/170). */
function AddLoanFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabButton label="Add a loan" onClick={() => setOpen(true)}><PlusIcon /></FabButton>
      {open && (
        <Modal title="Add a loan" onClose={() => setOpen(false)}>
          <AddLoanForm onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddLoanForm({ onSaved }: { onSaved?: () => void } = {}) {
  const addLoan = usePersonalLoansWorkbookStore((s) => s.addLoan);
  const defaultCurrency = usePersonalLoansWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const [lastCurrency, setLastCurrency] = useLastCurrency('personalLoans', defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [l, setL] = useState<PersonalLoan>(() => emptyLoan(lastCurrency));

  const submit = async () => {
    if (!l.person.trim()) return toast('Enter a person/lender name.');
    if (!l.principal || l.principal <= 0) return toast('Enter a principal amount.');
    if (!(await ensureSignedIn('Sign in to save personal loans.'))) return;
    addLoan({ ...l, id: crypto.randomUUID(), person: l.person.trim(), note: l.note?.trim() || undefined });
    toast(`Loan with ${l.person.trim()} saved.`);
    setL(emptyLoan(l.currencyCode));
    onSaved?.();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
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
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
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
function LinkedRepaymentFields({ loan, date, amount, onLinked }: { loan: PersonalLoan; date: string; amount: number; onLinked: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const loanSide: LinkSideConfig = { module: 'personalLoans', ref: loan.id };
  const remembered = getLastTransferSource(loanSide);
  const [otherModule, setOtherModule] = useState<'bank' | 'cash'>(remembered?.module === 'cash' ? 'cash' : 'bank');
  const [otherAccountId, setOtherAccountId] = useState(remembered?.ref ?? bankAccounts[0]?.id ?? '');

  const create = async () => {
    if (amount <= 0) return toast('Enter an amount first.');
    if (otherModule === 'bank' && !otherAccountId) return toast('Add a bank account on the Banking page first.');
    if (!(await ensureSignedIn('Sign in to save transfers.'))) return;
    const other: LinkSideConfig = otherModule === 'bank' ? { module: 'bank', ref: otherAccountId } : { module: 'cash', currencyCode: cashCurrency };
    const otherReceives = loan.direction === 'owed_to_me';
    const input = {
      date,
      fromAmount: amount,
      toAmount: amount,
      from: otherReceives ? loanSide : other,
      to: otherReceives ? other : loanSide,
    };
    const result = createLinkedTransfer(input);
    if ('error' in result) return toast(result.error);
    rememberTransferSource(loanSide, other);
    toast('Linked repayment added — also recorded on the other side.');
    onLinked();
  };

  return (
    <>
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
          <span className="footer-note">No bank accounts yet.</span>
        )
      )}
      <button className="btn" onClick={create}>
        <PlusIcon />Link &amp; add
      </button>
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
  const addRepayment = usePersonalLoansWorkbookStore((s) => s.addRepayment);
  const updateRepayment = usePersonalLoansWorkbookStore((s) => s.updateRepayment);
  const deleteRepayment = usePersonalLoansWorkbookStore((s) => s.deleteRepayment);
  const ensureSignedIn = useEnsureSignedIn();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [linkMode, setLinkMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PersonalLoanRepayment | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [time, setTime] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string | undefined>(() => defaultTimezoneForCurrency(loan.currencyCode));

  const resetAdd = () => { setAmount(0); setTime(undefined); };

  const submit = async () => {
    if (!amount || amount <= 0) return toast('Enter a repayment amount.');
    if (!(await ensureSignedIn('Sign in to save repayments.'))) return;
    addRepayment({ id: crypto.randomUUID(), loanId: loan.id, date, amount, time, timezone });
    toast('Repayment logged.');
    resetAdd();
  };

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
    if (!(await warnIfLinked('personalLoans', editId))) return;
    updateRepayment(editId, editRow);
    toast('Repayment updated.');
    setEditId(null);
    setEditRow(null);
  };

  type Col = 'date' | 'amount' | 'remaining';
  const sortValue = (r: PersonalLoanRepayment, col: Col): number | string => {
    if (col === 'amount') return r.amount;
    if (col === 'remaining') return remaining.get(r.id) ?? 0;
    return r.date;
  };
  const { sorted, Th } = useSortableRows(repayments, sortValue, 'date', 'desc');

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="number" step="0.01" placeholder="Amount" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 100 }} />
        <TimeZoneFields time={time} timezone={timezone} onTimeChange={setTime} onTimezoneChange={setTimezone} />
        {linkMode ? (
          <LinkedRepaymentFields loan={loan} date={date} amount={amount} onLinked={resetAdd} />
        ) : (
          <button className="btn secondary" onClick={submit}><PlusIcon />Add repayment</button>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        <input type="checkbox" checked={linkMode} onChange={(e) => setLinkMode(e.target.checked)} />
        Link this to a Bank account or Cash (creates a matching entry there too, instead of just here)
      </label>
      {/* README item 42's remainder: this component's add-form and list used
       * to have no clean seam for a CollapsibleCard — the form itself is
       * deliberately left outside it (collapsing a form mid-fill is a UX
       * trap, per the same rule every other module's rollout followed), but
       * the table + export controls below it split off cleanly into their
       * own collapsible section. */}
      <CollapsibleCard
        title={<h4 style={{ margin: 0 }}>Repayment history</h4>}
        headerExtra={
          repayments.length > 0 ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
        style={{ marginBottom: 16 }}
      >
        <div className="table-scroll">
          <table>
            <thead><tr><Th col="date">Date</Th><Th col="amount">Amount</Th><Th col="remaining">Remaining</Th><th>Source</th><th></th></tr></thead>
            <tbody>
              {sorted.map((r) =>
                editId === r.id && editRow ? (
                  <tr key={r.id}>
                    <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                    <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
                    <td></td>
                    <td className="footer-note">{r.source === 'statement-import' ? `Import${r.statementRef ? ` (${r.statementRef})` : ''}` : 'Manual'}</td>
                    <td>
                      <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                      <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{fmtMoney(r.amount, loan.currencyCode)}</td>
                    <td>
                      <Tooltip text="Loan balance still remaining after this repayment, in date order.">
                        <span>{fmtMoney(remaining.get(r.id) ?? 0, loan.currencyCode)}</span>
                      </Tooltip>
                    </td>
                    <td className="footer-note">{r.source === 'statement-import' ? `Import${r.statementRef ? ` (${r.statementRef})` : ''}` : 'Manual'}</td>
                    <td>
                      <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(r)} />{' '}
                      <IconButton
                        label="Delete"
                        icon={<TrashIcon size={13} />}
                        align="right"
                        onClick={() => confirmAndDeleteLinkable('personalLoans', r.id, () => deleteRepayment(r.id))}
                      />
                    </td>
                  </tr>
                ),
              )}
              {!sorted.length && <tr><td colSpan={5} className="footer-note">No repayments logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
      <ImportRepaymentsSection loan={loan} />
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
    <Card style={{ marginTop: 12 }}>
      <h4 style={{ marginTop: 0 }}>Import repayments (CSV)</h4>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <button className="btn secondary small" onClick={() => fileInput.current?.click()}>Choose CSV file</button>
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
        {fileName && <span className="footer-note">{fileName} ({rows.length} rows)</span>}
      </div>

      {headers.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
          <div className="table-scroll" style={{ marginTop: 8 }}>
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
          <button className="btn secondary" style={{ marginTop: 12 }} onClick={doImport}>
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
    <Card style={{ marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>Payoff planner</h4>
      <p className="footer-note" style={{ marginTop: 0 }}>
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
          <p className="footer-note" style={{ marginBottom: 0 }}>Enter a positive monthly amount to project a payoff date.</p>
        )
      )}
    </Card>
  );
}

function LoanDetail({ loan, onBack, startInEditMode }: { loan: PersonalLoan; onBack: () => void; startInEditMode?: boolean }) {
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const deleteLoan = usePersonalLoansWorkbookStore((s) => s.deleteLoan);
  const updateLoan = usePersonalLoansWorkbookStore((s) => s.updateLoan);
  const [editing, setEditing] = useState(!!startInEditMode);
  const [editRow, setEditRow] = useState<PersonalLoan>(loan);
  const outstanding = loanOutstanding(loan, repayments);

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All personal loans</button>
      <Card style={{ marginBottom: 16 }}>
        {editing ? (
          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
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
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
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
              <div style={{ fontWeight: 700, fontSize: 16 }}>{loan.person}</div>
              <div className="footer-note">
                {loan.direction === 'owed_to_me' ? 'Money lent out' : 'Money I owe'} · {loan.currencyCode} · since {loan.date}
              </div>
              {loan.note && <div className="footer-note">{loan.note}</div>}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => { setEditRow(loan); setEditing(true); }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card">
            <Tooltip text="The original amount of the loan, before any repayments.">
              <div className="label" style={{ cursor: 'pointer' }}>Principal</div>
            </Tooltip>
            <MoneyValue n={loan.principal} currency={loan.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(loan.direction === 'owed_to_me' ? 'var(--profit)' : 'var(--loss)')}>
            <Tooltip text="How much of this loan is still unpaid, after subtracting all repayments logged so far.">
              <div className="label" style={{ cursor: 'pointer' }}>Outstanding</div>
            </Tooltip>
            <MoneyValue n={outstanding} currency={loan.currencyCode} />
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

function LoanList({ onSelect, onEdit }: { onSelect: (loan: PersonalLoan) => void; onEdit: (loan: PersonalLoan) => void }) {
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const repayments = usePersonalLoansWorkbookStore((s) => s.workbook.repayments);
  const [filter, setFilter] = useState<'all' | 'owed_to_me' | 'i_owe'>('all');
  const filtered = filter === 'all' ? loans : loans.filter((l) => l.direction === filter);

  type Row = { loan: PersonalLoan; outstanding: number };
  const rows: Row[] = filtered.map((loan) => ({ loan, outstanding: loanOutstanding(loan, repayments) }));
  type Col = 'person' | 'direction' | 'outstanding';
  const sortValue = (r: Row, col: Col): number | string => {
    switch (col) {
      case 'direction': return r.loan.direction;
      case 'outstanding': return r.outstanding;
      default: return r.loan.person;
    }
  };
  const { sorted, Th } = useSortableRows(rows, sortValue, 'person', 'asc');

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All directions</option>
          <option value="owed_to_me">Money I lent out</option>
          <option value="i_owe">Money I owe</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><Th col="person">Person</Th><Th col="direction">Direction</Th><Th col="outstanding">Outstanding</Th><th></th></tr></thead>
          <tbody>
            {sorted.map(({ loan: l, outstanding }) => (
              <tr key={l.id} onClick={() => onSelect(l)} style={{ cursor: 'pointer' }}>
                <td>{l.person}</td>
                <td className={l.direction === 'owed_to_me' ? 'pill-buy' : 'pill-sell'}>{l.direction === 'owed_to_me' ? 'Lent out' : 'I owe'}</td>
                <td>{fmtMoney(outstanding, l.currencyCode)}</td>
                <td>
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={(e) => { e.stopPropagation(); onEdit(l); }} />{' '}
                  <button className="btn secondary small" onClick={(e) => { e.stopPropagation(); onSelect(l); }}>Open</button>
                </td>
              </tr>
            ))}
            {!sorted.length && <tr><td colSpan={4} className="footer-note">No personal loans yet.</td></tr>}
          </tbody>
        </table>
      </div>
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
          <p style={{ marginTop: 0 }}>
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
      <p className="footer-note" style={{ marginBottom: 12 }}>
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
          <div style={{ marginTop: 16 }}>
            <AccountSection cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
          </div>
        </div>
      )}
    </div>
  );
}
