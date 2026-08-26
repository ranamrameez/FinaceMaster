import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Card, CollapsibleCard } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Tooltip } from '../../../components/Tooltip';
import { toast } from '../../../components/Toast';
import { ChartCard } from '../../qse/components/ChartCard';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useSortableRows } from '../../../hooks/useSortableRows';
import {
  collectBudgetActivities,
  monthlyIncomeExpense,
  threeMonthWindow,
  PREDEFINED_EXPENSE_CATEGORIES,
  PREDEFINED_INCOME_CATEGORIES,
  type BudgetActivity,
  type BudgetModule,
} from '../../../lib/calc/budgetPlanner';
import { dlBarV } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar } from '../../../lib/cssVar';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../../store/plannedCashWorkbookStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../../../store/plannedRentalsWorkbookStore';
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

  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const activities = useMemo(
    () => collectBudgetActivities({ cashEntries, plannedCash, bankAccounts, bankTransactions, plannedBank, rentalProperties, rentalEntries, plannedRentals }),
    [cashEntries, plannedCash, bankAccounts, bankTransactions, plannedBank, rentalProperties, rentalEntries, plannedRentals],
  );

  const months = useMemo(() => threeMonthWindow(), []);
  const monthly = useMemo(() => monthlyIncomeExpense(activities, months), [activities, months]);
  const currencies = useMemo(() => [...new Set(activities.map((a) => a.currencyCode))].sort(), [activities]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

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
          <div style={{ marginTop: 12, marginBottom: 16 }}>
          <ChartCard title={`Projected income vs. expense — ${monthLabel(months[0])} to ${monthLabel(months[2])}`}>
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
              <Th col="date">Date</Th><Th col="module">Module</Th><Th col="source">Account/Property</Th>
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
