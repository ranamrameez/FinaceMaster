import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Card, CollapsibleCard } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Tooltip } from '../../../components/Tooltip';
import { toast } from '../../../components/Toast';
import { ChartCard } from '../../qse/components/ChartCard';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { FabButton } from '../../../components/ui/Fab';
import { useSortableRows } from '../../../hooks/useSortableRows';
import {
  collectBudgetActivities,
  currentMonth as currentMonthOf,
  monthlyIncomeExpense,
  monthRange,
  PREDEFINED_EXPENSE_CATEGORIES,
  PREDEFINED_INCOME_CATEGORIES,
  type BudgetActivity,
  type BudgetModule,
  type MonthlyIncomeExpense,
} from '../../../lib/calc/budgetPlanner';
import { projectedNetWorthTrend, type MonthlyNetWorthPoint } from '../../../lib/calc/netWorthTrend';
import { useNetWorthSummary } from '../../netWorth/hooks/useNetWorthSummary';
import { dlBarV } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar } from '../../../lib/cssVar';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useCategoryStore } from '../../../store/categoryStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../../store/plannedCashWorkbookStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../../../store/plannedRentalsWorkbookStore';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import { useNetWorthSnapshotsWorkbookStore } from '../../../store/netWorthSnapshotsWorkbookStore';
import { PlusIcon } from '../../../components/icons';
import type { PlannedCashEntry } from '../../../types/plannedCash';
import type { PlannedBankTransaction } from '../../../types/plannedBank';
import type { PlannedRentalEntry } from '../../../types/plannedRentals';
import type { BankAccount } from '../../../types/bankWorkbook';
import type { Property } from '../../../types/rentalsWorkbook';

const today = () => new Date().toISOString().slice(0, 10);

/** README item 106 (user-requested, 2026-08-26) — see `lib/calc/
 * budgetPlanner.ts`'s own doc comment for the full design: a UNIFIED view
 * over Cash/Bank/Rentals' already-existing planned entries, plus an
 * "add a plan" form right here that writes into whichever module's store
 * the user picks. Nothing about those modules' own Planning tabs changes —
 * this is a read+write convenience layer on top of them, not a
 * replacement. The 3-month (previous/current/next) projection chart's
 * primary home is Net Worth's homepage (per explicit user direction); the
 * same numbers are also shown here since this page IS the natural place
 * to act on what the projection shows. */
export function BudgetPlannerPage() {
  const cashEntries = useCashWorkbookStore((s) => s.workbook.entries);
  const cashSettings = useCashWorkbookStore((s) => s.workbook.settings);
  const plannedCash = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const addPlannedCash = usePlannedCashWorkbookStore((s) => s.addEntry);

  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const bankTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const plannedBank = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const addPlannedBank = usePlannedBankWorkbookStore((s) => s.addEntry);

  const rentalProperties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const rentalEntries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const plannedRentals = usePlannedRentalsWorkbookStore((s) => s.workbook.entries);
  const addPlannedRentals = usePlannedRentalsWorkbookStore((s) => s.addEntry);

  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const netWorthSnapshots = useNetWorthSnapshotsWorkbookStore((s) => s.workbook.entries);
  const netWorthSummary = useNetWorthSummary();
  const categories = useCategoryStore((s) => s.workbook.categories);

  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const activities = useMemo(
    () => collectBudgetActivities({ cashEntries, plannedCash, bankAccounts, bankTransactions, plannedBank, rentalProperties, rentalEntries, plannedRentals, categories }),
    [cashEntries, plannedCash, bankAccounts, bankTransactions, plannedBank, rentalProperties, rentalEntries, plannedRentals, categories],
  );

  // README item 107 (user-requested 2026-08-27): a scrollable window rather
  // than a fixed 3 months — `windowStart` is the offset (in months from
  // today) of the FIRST visible column; the window is always 6 months wide
  // (`windowStart` .. `windowStart+5`), defaulting to 3 past + current + 2
  // future, matching the user's own "at least 6 months history including
  // future 2 months projection" wording. Scrolling shifts `windowStart` by
  // 1 month at a time; "Today" resets it back to the default.
  const [windowStart, setWindowStart] = useState(-3);
  const months = useMemo(() => monthRange(windowStart, windowStart + 5), [windowStart]);
  const nowMonth = useMemo(() => currentMonthOf(), []);
  const todayISODate = useMemo(() => today(), []);
  const monthly = useMemo(() => monthlyIncomeExpense(activities, months), [activities, months]);
  const currencies = useMemo(() => [...new Set(activities.map((a) => a.currencyCode))].sort(), [activities]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

  const currentNetWorthByCurrency = useMemo(
    () => Object.fromEntries(netWorthSummary.rows.map((r) => [r.currency, r.net])),
    [netWorthSummary.rows],
  );
  const netWorthTrend = useMemo(
    () => projectedNetWorthTrend({
      months, currentMonth: nowMonth, todayISODate, currentNetWorthByCurrency, activities, emiLoans, snapshots: netWorthSnapshots,
    }),
    [months, nowMonth, todayISODate, currentNetWorthByCurrency, activities, emiLoans, netWorthSnapshots],
  );

  const monthLabel = (m: string) => new Date(`${m}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <h1 className="pagetitle">Budget Planner</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Every planned income/expense across Cash, Banking, and Rentals in one place — this doesn't replace those
        modules' own Planning tabs, it's a combined view of the same plans, plus a shortcut to add a new one linked
        to whichever account you want.
      </p>

      {!activities.length ? (
        <Card><p className="footer-note" style={{ marginBottom: 0 }}>No income/expense activity or plans yet across Cash, Banking, or Rentals.</p></Card>
      ) : (
        <>
          {currencies.length > 1 && (
            <Field label="Currency" width={120}>
              <Select value={effectiveCurrency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          )}

          <MonthlySummaryTable
            months={months}
            nowMonth={nowMonth}
            monthLabel={monthLabel}
            monthly={monthly}
            netWorthTrend={netWorthTrend}
            currency={effectiveCurrency}
            onScrollEarlier={() => setWindowStart((w) => w - 1)}
            onScrollLater={() => setWindowStart((w) => w + 1)}
            onToday={() => setWindowStart(-3)}
          />

          <div style={{ marginTop: 12, marginBottom: 16 }}>
          <ChartCard title={`Income vs. expense — ${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}`}>
            <Bar
              data={{
                labels: months.map(monthLabel),
                datasets: [
                  { label: 'Income', data: monthly.map((m) => m.income[effectiveCurrency] ?? 0), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                  { label: 'Expense', data: monthly.map((m) => m.expense[effectiveCurrency] ?? 0), backgroundColor: cssVar('--loss') || '#e5484d' },
                ],
              }}
              options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, effectiveCurrency)) } }}
            />
          </ChartCard>
          </div>
        </>
      )}

      <ActivityList activities={activities} />
      <AddPlanFab
        addPlannedCash={addPlannedCash} cashDefaultCurrency={cashSettings.defaultCurrency}
        bankAccounts={bankAccounts} addPlannedBank={addPlannedBank}
        rentalProperties={rentalProperties} addPlannedRentals={addPlannedRentals}
      />
    </div>
  );
}

interface MonthlySummaryTableProps {
  months: string[];
  nowMonth: string;
  monthLabel: (m: string) => string;
  monthly: MonthlyIncomeExpense[];
  netWorthTrend: MonthlyNetWorthPoint[];
  currency: string;
  onScrollEarlier: () => void;
  onScrollLater: () => void;
  onToday: () => void;
}

/** The scrollable multi-month summary table (README item 107, user-
 * requested 2026-08-27: "It should be able to let the user scroll through
 * months and see at least 6 months history including future 2 months
 * projection" — modeled on the user's own reference Google Sheet, which
 * has one big per-month summary table). Months are columns, same shape as
 * that sheet; ◀/▶ shift the 6-month window one month at a time so it
 * genuinely scrolls rather than being capped at a fixed range, and the
 * native horizontal scrollbar on `.table-scroll` covers the visible window
 * itself on a narrow viewport.
 *
 * The "Net worth" row is the concrete answer to the user's second point in
 * the same message ("an EMI will take 36 months... I will always see my
 * Net Worth negative... we must zoom in to see deeper picture") — see
 * `netWorthTrend.ts`'s own doc comment for exactly how each month's figure
 * is derived. It's a TRAJECTORY, not a re-stated headline: a past month
 * with no saved snapshot yet shows "—" rather than a guessed number. */
function MonthlySummaryTable({ months, nowMonth, monthLabel, monthly, netWorthTrend, currency, onScrollEarlier, onScrollLater, onToday }: MonthlySummaryTableProps) {
  const monthlyByMonth = new Map(monthly.map((m) => [m.month, m]));
  const trendByMonth = new Map(netWorthTrend.map((m) => [m.month, m]));

  const statusFor = (m: string): 'Actual' | 'Current' | 'Projected' =>
    m < nowMonth ? 'Actual' : m === nowMonth ? 'Current' : 'Projected';

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Monthly summary</h3>} style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button className="btn secondary small" onClick={onScrollEarlier}>◀ Earlier</button>
        <button className="btn secondary small" onClick={onToday}>Today</button>
        <button className="btn secondary small" onClick={onScrollLater}>Later ▶</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              {months.map((m) => (
                <th key={m} style={{ minWidth: 130 }}>
                  {monthLabel(m)}<br />
                  <span className="footer-note" style={{ fontWeight: statusFor(m) === 'Current' ? 700 : 400 }}>
                    {statusFor(m)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Income</td>
              {months.map((m) => <td key={m}>{fmtMoney(monthlyByMonth.get(m)?.income[currency] ?? 0, currency)}</td>)}
            </tr>
            <tr>
              <td>Expense</td>
              {months.map((m) => <td key={m}>{fmtMoney(monthlyByMonth.get(m)?.expense[currency] ?? 0, currency)}</td>)}
            </tr>
            <tr>
              <td>Net</td>
              {months.map((m) => {
                const row = monthlyByMonth.get(m);
                const net = (row?.income[currency] ?? 0) - (row?.expense[currency] ?? 0);
                return <td key={m} className={net >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(net, currency)}</td>;
              })}
            </tr>
            <tr>
              <td>
                <Tooltip text="Today's real net worth, projected forward through each future month using Budget Planner's own planned income/expense plus each EMI loan's amortization schedule. Past months come from your saved Net Worth snapshots — shows as — where none exists yet.">
                  Net worth
                </Tooltip>
              </td>
              {months.map((m) => {
                const value = trendByMonth.get(m)?.byCurrency[currency];
                return (
                  <td key={m} className={value === undefined ? 'footer-note' : value >= 0 ? 'pill-buy' : 'pill-sell'}>
                    {value === undefined ? '—' : fmtMoney(value, currency)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="footer-note" style={{ marginTop: 8, marginBottom: 0 }}>
        Past months show Net worth only where a snapshot was saved for that period (Net Worth page auto-saves one
        per day) — current/future months are projected from today's real figures. See{' '}
        <Link to="/net-worth">the Net Worth page</Link> for the full breakdown.
      </p>
    </CollapsibleCard>
  );
}

function ActivityList({ activities }: { activities: BudgetActivity[] }) {
  type Col = 'date' | 'module' | 'source' | 'category' | 'amount' | 'status';
  const sortValue = (a: BudgetActivity, col: Col): number | string => {
    switch (col) {
      case 'module': return a.module;
      case 'source': return a.sourceLabel;
      case 'category': return a.category ?? '';
      case 'amount': return a.amount;
      case 'status': return a.executed ? 1 : 0;
      default: return a.date;
    }
  };
  const { sorted, Th } = useSortableRows(activities, sortValue, 'date', 'desc');
  const moduleLabel: Record<BudgetModule, string> = { cash: 'Cash', bank: 'Banking', rentals: 'Rentals' };

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>All planned financial activity</h3>} style={{ marginBottom: 16 }}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <Th col="date">Date</Th><Th col="module">Account</Th><Th col="source">Account/Property</Th>
              <th>Description</th><Th col="category">Category</Th><Th col="amount">Amount</Th><Th col="status">Status</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={`${a.module}:${a.id}`}>
                <td>{a.date}</td>
                <td>{moduleLabel[a.module]}</td>
                <td>{a.sourceLabel}</td>
                <td>{a.description}</td>
                <td>{a.category || '—'}</td>
                <td className={a.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(a.amount, a.currencyCode)}</td>
                <td className="footer-note">{a.executed ? 'Actual' : 'Planned'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

interface AddPlanFabProps {
  addPlannedCash: (e: PlannedCashEntry) => void;
  cashDefaultCurrency: string;
  bankAccounts: BankAccount[];
  addPlannedBank: (e: PlannedBankTransaction) => void;
  rentalProperties: Property[];
  addPlannedRentals: (e: PlannedRentalEntry) => void;
}

/** "Directly plan from within itself and linking it a financial source" —
 * picking a module here writes a real entry into THAT module's own
 * existing Planned* store via its already-tested `addEntry`, exactly as
 * if the user had gone to that module's own Planning tab and added it
 * there — this form is purely a shortcut, not a new data path. */
function AddPlanFab(props: AddPlanFabProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabButton label="Add a plan" onClick={() => setOpen(true)}><PlusIcon /></FabButton>
      {open && (
        <Modal title="Add a plan" onClose={() => setOpen(false)}>
          <AddPlanForm {...props} onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddPlanForm({ addPlannedCash, cashDefaultCurrency, bankAccounts, addPlannedBank, rentalProperties, addPlannedRentals, onSaved }: AddPlanFabProps & { onSaved: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const [module, setModule] = useState<BudgetModule>('cash');
  const [accountId, setAccountId] = useState(bankAccounts[0]?.id ?? '');
  const [propertyId, setPropertyId] = useState(rentalProperties[0]?.id ?? '');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const categoryOptions = type === 'income' ? PREDEFINED_INCOME_CATEGORIES : PREDEFINED_EXPENSE_CATEGORIES;

  const submit = async () => {
    if (!amount || amount <= 0) return toast('Enter an amount.');
    if (module === 'bank' && !accountId) return toast('Add a bank account first (Banking page).');
    if (module === 'rentals' && !propertyId) return toast('Add a property first (Rentals page).');
    if (!(await ensureSignedIn('Sign in to save plans.'))) return;

    if (module === 'cash') {
      addPlannedCash({ id: crypto.randomUUID(), date, type: type === 'income' ? 'IN' : 'OUT', amount, currencyCode: cashDefaultCurrency, category: category.trim() || undefined, note: note.trim() || undefined });
    } else if (module === 'bank') {
      addPlannedBank({ id: crypto.randomUUID(), accountId, date, description: note.trim() || category.trim() || 'Planned', amount: type === 'income' ? amount : -amount, category: category.trim() || undefined });
    } else {
      addPlannedRentals({ id: crypto.randomUUID(), propertyId, date, type: type === 'income' ? 'RENT_INCOME' : 'EXPENSE', amount, category: category.trim() || undefined, note: note.trim() || undefined });
    }
    toast('Plan added.');
    onSaved();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Financial source" width={160} required>
          <Select value={module} onChange={(e) => setModule(e.target.value as BudgetModule)}>
            <option value="cash">Cash</option>
            <option value="bank">Bank account</option>
            <option value="rentals">Rental property</option>
          </Select>
        </Field>
        {module === 'bank' && (
          bankAccounts.length ? (
            <Field label="Account" width={180} required>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
              </Select>
            </Field>
          ) : (
            <p className="footer-note">No bank accounts yet — add one on the Banking page first.</p>
          )
        )}
        {module === 'rentals' && (
          rentalProperties.length ? (
            <Field label="Property" width={180} required>
              <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                {rentalProperties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currencyCode})</option>)}
              </Select>
            </Field>
          ) : (
            <p className="footer-note">No properties yet — add one on the Rentals page first.</p>
          )
        )}
        <Field label="Type" width={120} required>
          <Select value={type} onChange={(e) => { setType(e.target.value as 'income' | 'expense'); setCategory(''); }}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>
        </Field>
        <Field label="Date" required>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Amount" width={120} required>
          <TextInput type="number" step="0.01" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
        <Field label="Category (optional)" width={160}>
          <TextInput list="budget-category-datalist" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Groceries" />
        </Field>
        <Field label="Note (optional)" width={180}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <datalist id="budget-category-datalist">
        {categoryOptions.map((c) => <option key={c} value={c} />)}
      </datalist>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add plan
      </button>
      <p className="footer-note" style={{ marginTop: 8 }}><span style={{ color: 'var(--loss)' }}>*</span> Required. Everything else on this form is optional.</p>
    </div>
  );
}
