import { useMemo, useState } from 'react';
import { CollapsibleCard } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { FabButton } from '../../../components/ui/Fab';
import { PlusIcon } from '../../../components/icons';
import { UpcomingList } from '../../../components/UpcomingList';
import { useUpcomingItems } from '../../../hooks/useUpcomingItems';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { fmtMoney } from '../../../lib/format';
import {
  collectBudgetActivities,
  PREDEFINED_EXPENSE_CATEGORIES,
  PREDEFINED_INCOME_CATEGORIES,
  type BudgetActivity,
  type BudgetModule,
} from '../../../lib/calc/budgetPlanner';
import { useCategoryStore } from '../../../store/categoryStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../../store/plannedCashWorkbookStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../../../store/plannedRentalsWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import type { PlannedRentalEntry } from '../../../types/plannedRentals';
import type { Property } from '../../../types/rentalsWorkbook';
import { PlanningTab as CashPlanningTab } from '../../cash/pages/CashPage';
import { PlanningTab as BankPlanningTab } from '../../bank/pages/BankPage';

const today = () => new Date().toISOString().slice(0, 10);

/** Unifies what used to be two separate, overlapping pages — this file
 * (Cash/Banking's own "Planning" tabs, promoted here) and the standalone
 * Budget Planner page — into one. User-reported (2026-09-08): "Planning &
 * Budget Planner are two faces of a single feature, confusing, complex and
 * still incomplete." That was accurate: both pages let you add a Cash/Bank
 * plan, both showed planned Cash/Bank data, and neither was a strict
 * superset of the other (only THIS page's Cash/Bank "Add a plan" forms
 * support recurrence; only the old Budget Planner's combined table let you
 * see Cash+Bank+Rentals activity side by side, filterable). Merged rather
 * than picking one, per the user's own explicit choice.
 *
 * Layout, top to bottom: (1) Upcoming (next 30 days) — unchanged, every
 * module. (2) All planned financial activity — the old Budget Planner's
 * combined, filterable Cash/Bank/Rentals table, now the one place to
 * BROWSE everything at once. (3) Cash's own Planning tools (balance
 * projection + an editable, recurrence-capable plan list) — unchanged,
 * reused as-is. (4) Banking's own Planning tools — same. (5) Rentals — a
 * NEW lightweight "add a one-off plan" section: Rentals never had its own
 * per-page Planning tools (only per-property auto-generation, buried in
 * `PropertyDetailModal`), so the old Budget Planner's generic add-plan
 * form is kept, narrowed to Rentals only — its Cash/Bank options are
 * dropped since Cash's/Bank's own sections above are strictly more
 * capable (recurrence, edit, delete, mark-done) for those two modules. */
export function PlanningPage({
  cashPlannedSyncStatus,
  cashPlannedCloudEmpty,
  uploadCashPlannedLocalToCloud,
  bankPlannedSyncStatus,
  bankPlannedCloudEmpty,
  uploadBankPlannedLocalToCloud,
}: {
  cashPlannedSyncStatus: string;
  cashPlannedCloudEmpty: boolean;
  uploadCashPlannedLocalToCloud: () => Promise<void>;
  bankPlannedSyncStatus: string;
  bankPlannedCloudEmpty: boolean;
  uploadBankPlannedLocalToCloud: () => Promise<void>;
}) {
  const upcoming = useUpcomingItems(30);

  const cashEntries = useCashWorkbookStore((s) => s.workbook.entries);
  const plannedCash = usePlannedCashWorkbookStore((s) => s.workbook.entries);

  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const bankTransactions = useBankWorkbookStore((s) => s.workbook.transactions);
  const plannedBank = usePlannedBankWorkbookStore((s) => s.workbook.entries);

  const rentalProperties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const rentalEntries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const plannedRentals = usePlannedRentalsWorkbookStore((s) => s.workbook.entries);
  const addPlannedRentals = usePlannedRentalsWorkbookStore((s) => s.addEntry);

  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const categories = useCategoryStore((s) => s.workbook.categories);

  const activities = useMemo(
    () => collectBudgetActivities({ cashEntries, plannedCash, bankAccounts, bankTransactions, plannedBank, rentalProperties, rentalEntries, plannedRentals, categories, links }),
    [cashEntries, plannedCash, bankAccounts, bankTransactions, plannedBank, rentalProperties, rentalEntries, plannedRentals, categories, links],
  );

  return (
    <div>
      <h1 className="pagetitle">Planning</h1>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Everything expected to happen soon, across every module — a plan can repeat (e.g. a monthly salary or a
        recurring bill), so you only set it up once. Browse every planned Cash/Banking/Rentals activity below, or
        manage a specific module's own plans (add, edit, delete, mark done) further down.
      </p>
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Upcoming (next 30 days)</h3>} style={{ marginBottom: 16 }}>
        <UpcomingList items={upcoming} emptyText="Nothing expected in the next 30 days." />
      </CollapsibleCard>
      <ActivityList activities={activities} />
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Cash</h3>} style={{ marginBottom: 16 }}>
        <CashPlanningTab
          plannedSyncStatus={cashPlannedSyncStatus}
          plannedCloudEmpty={cashPlannedCloudEmpty}
          uploadPlannedLocalToCloud={uploadCashPlannedLocalToCloud}
        />
      </CollapsibleCard>
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Banking</h3>} style={{ marginBottom: 16 }}>
        <BankPlanningTab
          plannedSyncStatus={bankPlannedSyncStatus}
          plannedCloudEmpty={bankPlannedCloudEmpty}
          uploadPlannedLocalToCloud={uploadBankPlannedLocalToCloud}
        />
      </CollapsibleCard>
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Rentals</h3>}>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Rentals plans its own recurring rent per property (see a property's own "Details" view for lease-based
          projection and rent collection) — use this for a one-off plan that doesn't fit either of those, like a
          planned repair expense.
        </p>
        {/* Archived properties excluded from this "pick where a NEW plan
           goes" picker (2026-09-03) — same rule as everywhere else;
           `activities`/`ActivityList` above still read the FULL
           unfiltered list, so an archived property's own past activity
           still shows. */}
        <AddRentalPlanFab rentalProperties={rentalProperties.filter((p) => p.isActive !== false)} addPlannedRentals={addPlannedRentals} />
      </CollapsibleCard>
    </div>
  );
}

/** User-requested (2026-09-03): "add filters to other tables as well." */
function ActivityList({ activities }: { activities: BudgetActivity[] }) {
  const moduleLabel: Record<BudgetModule, string> = { cash: 'Cash', bank: 'Banking', rentals: 'Rentals' };
  const [moduleFilter, setModuleFilter] = useState<'all' | BudgetModule>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actual' | 'planned'>('all');

  const filtered = useMemo(
    () => activities.filter((a) => {
      if (moduleFilter !== 'all' && a.module !== moduleFilter) return false;
      if (statusFilter === 'actual' && !a.executed) return false;
      if (statusFilter === 'planned' && a.executed) return false;
      return true;
    }),
    [activities, moduleFilter, statusFilter],
  );

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
  const { sorted, Th } = useSortableRows(filtered, sortValue, 'date', 'desc');

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>All planned financial activity</h3>} style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <Field label="Account" width={130}>
          <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value as typeof moduleFilter)}>
            <option value="all">All</option>
            <option value="cash">Cash</option>
            <option value="bank">Banking</option>
            <option value="rentals">Rentals</option>
          </Select>
        </Field>
        <Field label="Status" width={130}>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All</option>
            <option value="actual">Actual</option>
            <option value="planned">Planned</option>
          </Select>
        </Field>
      </div>
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
                <td className={a.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(a.amount, a.currencyCode)}</td>
                <td className="text-muted">{a.executed ? 'Actual' : 'Planned'}</td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={7} className="text-muted">
                  {activities.length ? 'No activity matches these filters.' : 'No planned activity yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

/** Narrowed from the old Budget Planner's generic Cash/Bank/Rentals add-plan
 * form to Rentals only — Cash and Bank each have their own, strictly more
 * capable "Add a plan" (recurrence, in their own sections above), so
 * offering a second, less capable way to add a Cash/Bank plan on the same
 * page would recreate exactly the "two faces of one feature" confusion
 * this merge exists to fix. */
function AddRentalPlanFab({ rentalProperties, addPlannedRentals }: { rentalProperties: Property[]; addPlannedRentals: (e: PlannedRentalEntry) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabButton label="Add a rental plan" onClick={() => setOpen(true)}><PlusIcon /></FabButton>
      {open && (
        <Modal title="Add a rental plan" onClose={() => setOpen(false)}>
          <AddRentalPlanForm rentalProperties={rentalProperties} addPlannedRentals={addPlannedRentals} onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddRentalPlanForm({ rentalProperties, addPlannedRentals, onSaved }: { rentalProperties: Property[]; addPlannedRentals: (e: PlannedRentalEntry) => void; onSaved: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const [propertyId, setPropertyId] = useState(rentalProperties[0]?.id ?? '');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const categoryOptions = type === 'income' ? PREDEFINED_INCOME_CATEGORIES : PREDEFINED_EXPENSE_CATEGORIES;

  const submit = async () => {
    if (!amount || amount <= 0) return toast('Enter an amount.');
    if (!propertyId) return toast('Add a property first (Rentals page).');
    if (!(await ensureSignedIn('Sign in to save plans.'))) return;
    addPlannedRentals({ id: crypto.randomUUID(), propertyId, date, type: type === 'income' ? 'RENT_INCOME' : 'EXPENSE', amount, category: category.trim() || undefined, note: note.trim() || undefined });
    toast('Plan added.');
    onSaved();
  };

  if (!rentalProperties.length) {
    return <p className="text-muted">No properties yet — add one on the Rentals page first.</p>;
  }

  return (
    <div>
      <div className="row" style={{ gap: 8 }}>
        <Field label="Property" width={180} required>
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {rentalProperties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currencyCode})</option>)}
          </Select>
        </Field>
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
          <TextInput list="rental-plan-category-datalist" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Repairs" />
        </Field>
        <Field label="Note (optional)" width={180}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <datalist id="rental-plan-category-datalist">
        {categoryOptions.map((c) => <option key={c} value={c} />)}
      </datalist>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add plan
      </button>
      <p className="text-muted" style={{ marginTop: 8 }}><span style={{ color: 'var(--loss)' }}>*</span> Required. Everything else on this form is optional.</p>
    </div>
  );
}
