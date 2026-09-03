import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { ArchiveIcon, EditIcon, PlusIcon, RestoreIcon, SaveIcon, TransferIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { FabPanel } from '../../../components/ui/Fab';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { CategorySelect } from '../../../components/CategorySelect';
import { FinanceEditModal } from '../../../components/FinanceEditModal';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { categoryName, RENT_CATEGORY_ID, UNCATEGORIZED_ID } from '../../../lib/categories';
import { useCategoryStore } from '../../../store/categoryStore';
import { netIncomeByCurrency, netIncomeByProperty, propertyByCategory, propertyMonthlyRollup, propertyNetIncome } from '../../../lib/calc/rentalsModule';
import { generateLeaseRentPlans, nextPendingBalance, proposeRentCollection } from '../../../lib/calc/rentalPlanning';
import { parseCSV, toCSV } from '../../../lib/csv';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { confirmAndDeleteLinkable, warnIfLinked } from '../../../lib/linkCascade';
import { dlBarV, dlDoughnut } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { createEmptyRentalsWorkbook } from '../../../store/defaultRentalsWorkbook';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath } from '../../transfers/pages/TransferLinksPage';
import { usePlannedRentalsWorkbookStore } from '../../../store/plannedRentalsWorkbookStore';
import type { Property, RentalEntry, RentalsWorkbook } from '../../../types/rentalsWorkbook';
import { ChartCard } from '../../qse/components/ChartCard';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

function emptyProperty(defaultCurrency: string): Property {
  return { id: '', name: '', currencyCode: defaultCurrency, purchasePrice: undefined };
}

/* ============================== Properties ============================== */

function NetIncomeSummary() {
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const totals = netIncomeByCurrency(properties, entries);
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="stat-card card" style={hueStyle(totals[code] >= 0 ? 'var(--profit)' : 'var(--loss)')}>
          <div className="label">Net income ({code})</div>
          <MoneyValue n={totals[code]} currency={code} />
        </div>
      ))}
    </div>
  );
}

/** Floating "add a property" button (user feedback 2026-08-27: adding an
 * entity isn't a routine task, use FABs — same pattern already established
 * for EMI/Banking/Cash/Bank Planning, README Done items 166/170).
 *
 * User-reported (2026-08-28, real audit after "you're ignoring what's
 * asked for"): the Transfers FAB shipped on Bank's and EMI's LANDING pages
 * (both actions in one panel) but Rentals/Personal Loans/Funds only ever
 * got it on a specific record's own detail view — their landing page was
 * still "Add [entity]" alone, contradicting the original ask ("add it to
 * our FAB panel in the WHOLE app," a single button reachable everywhere).
 * Fixed by matching Bank's/EMI's own landing-FAB shape exactly: Transfers
 * with no `ref` pre-filled — `SideFields` inside the modal still lets the
 * user pick which property from its own dropdown, same "still choosable"
 * design the modal was always built for. */
function AddPropertyFab() {
  const [open, setOpen] = useState<'property' | 'transfer' | null>(null);
  return (
    <>
      <FabPanel
        actions={[
          { label: 'Add a property', icon: <PlusIcon />, onClick: () => setOpen('property') },
          { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
        ]}
      />
      {open === 'property' && (
        <Modal title="Add a property" onClose={() => setOpen(null)}>
          <AddPropertyForm onSaved={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'transfer' && <TransactionEntryModal defaultFinance={{ module: 'rentals' }} onClose={() => setOpen(null)} />}
    </>
  );
}

/** `initialCurrency`/`onSaved(id)` — see `AddAccountForm`'s own comment
 * (`features/bank/pages/BankPage.tsx`) for why: the shared "+" quick-add in
 * `SideFields` reuses this exact form from `TransactionEntryModal`. */
export function AddPropertyForm({ onSaved, initialCurrency }: { onSaved?: (id: string) => void; initialCurrency?: string } = {}) {
  const addProperty = useRentalsWorkbookStore((s) => s.addProperty);
  const [lastCurrency, setLastCurrency] = useLastCurrency('rentals', 'USD');
  const ensureSignedIn = useEnsureSignedIn();
  const [p, setP] = useState(() => emptyProperty(initialCurrency ?? lastCurrency));

  const submit = async () => {
    if (!p.name.trim()) return toast('Enter a property name.');
    if (!(await ensureSignedIn('Sign in to save rental properties.'))) return;
    const id = uid();
    addProperty({ ...p, id, name: p.name.trim() });
    toast(`Property "${p.name.trim()}" added.`);
    setP(emptyProperty(p.currencyCode));
    onSaved?.(id);
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Property name" width={180} required>
          <TextInput value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Apartment 4B" />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={p.currencyCode} onChange={(e) => { setP({ ...p, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Purchase price (optional)" width={160}>
          <TextInput type="number" step="0.01" value={p.purchasePrice ?? ''} onChange={(e) => setP({ ...p, purchasePrice: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add property
      </button>
    </div>
  );
}

function PropertiesList() {
  const allProperties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const updateProperty = useRentalsWorkbookStore((s) => s.updateProperty);
  const deleteProperty = useRentalsWorkbookStore((s) => s.deleteProperty);
  const ensureSignedIn = useEnsureSignedIn();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Property | null>(null);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(() => allProperties.filter((p) => p.isActive === false).length, [allProperties]);
  const properties = useMemo(() => (showArchived ? allProperties : allProperties.filter((p) => p.isActive !== false)), [allProperties, showArchived]);

  // User-requested (2026-09-03): "add isActive flag to all modules where
  // applicable" — same archive/restore pattern as `BankAccount.isActive`.
  const toggleArchived = async (p: Property) => {
    if (!(await ensureSignedIn(p.isActive === false ? 'Sign in to restore this property.' : 'Sign in to archive this property.'))) return;
    updateProperty(p.id, { isActive: p.isActive === false ? true : false });
    toast(p.isActive === false ? 'Property restored.' : 'Property archived.');
  };

  const startEdit = (p: Property) => { setEditId(p.id); setEditRow({ ...p }); };
  const saveEdit = () => {
    if (!editId || !editRow) return;
    updateProperty(editId, editRow);
    toast('Property updated.');
    setEditId(null);
    setEditRow(null);
  };

  type Col = 'name' | 'currency' | 'purchasePrice' | 'netIncome';
  const sortValue = (p: Property, col: Col): number | string => {
    switch (col) {
      case 'currency': return p.currencyCode;
      case 'purchasePrice': return p.purchasePrice ?? 0;
      case 'netIncome': return propertyNetIncome(p, entries);
      default: return p.name;
    }
  };
  const { sorted, Th } = useSortableRows(properties, sortValue, 'name', 'asc');

  return (
    <div>
      {archivedCount > 0 && (
        <button className="btn secondary small" style={{ marginBottom: 8 }} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
        </button>
      )}
      <div className="table-scroll">
      <table>
        <thead><tr><Th col="name">Name</Th><Th col="currency">Currency</Th><Th col="purchasePrice">Purchase price</Th><Th col="netIncome">Net income (all time)</Th><th></th></tr></thead>
        <tbody>
          {sorted.map((p) =>
            editId === p.id && editRow ? (
              <tr key={p.id}>
                <td><input value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} /></td>
                <td>
                  <select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </td>
                <td><input type="number" step="0.01" value={editRow.purchasePrice ?? ''} onChange={(e) => setEditRow({ ...editRow, purchasePrice: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 110 }} /></td>
                <td></td>
                <td>
                  <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                  <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                </td>
              </tr>
            ) : (
              <tr key={p.id} onClick={() => setDetailProperty(p)} style={{ cursor: 'pointer' }}>
                <td>
                  {p.name}
                  {p.isActive === false && <span className="pill-warn" style={{ fontSize: 10, marginLeft: 6 }}>Archived</span>}
                </td>
                <td>{p.currencyCode}</td>
                <td>{p.purchasePrice ? fmtMoney(p.purchasePrice, p.currencyCode) : '—'}</td>
                <td className={propertyNetIncome(p, entries) >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(propertyNetIncome(p, entries), p.currencyCode)}</td>
                <td>
                  <button className="btn secondary small" onClick={(e) => { e.stopPropagation(); setDetailProperty(p); }}>Details</button>{' '}
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={(e) => { e.stopPropagation(); startEdit(p); }} />{' '}
                  <IconButton
                    label={p.isActive === false ? 'Restore' : 'Archive'}
                    icon={p.isActive === false ? <RestoreIcon size={13} /> : <ArchiveIcon size={13} />}
                    align="right"
                    onClick={(e) => { e.stopPropagation(); toggleArchived(p); }}
                  />{' '}
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon size={13} />}
                    align="right"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirmDialog('This deletes the property and all its income/expense entries.', `Delete property "${p.name}"?`)) deleteProperty(p.id);
                    }}
                  />
                </td>
              </tr>
            ),
          )}
          {!sorted.length && (
            <tr>
              <td colSpan={5} className="footer-note">
                {allProperties.length ? 'Every property is archived — click "Show archived" above to see them.' : 'No properties yet — add one above.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {detailProperty && <PropertyDetailModal property={detailProperty} onClose={() => setDetailProperty(null)} />}
      </div>
    </div>
  );
}

/** README items 38/13: lease/tenant/security-deposit info per property,
 * plus a one-click "Generate projected rent" that creates a Planning-
 * feature plan (via `usePlannedRentalsWorkbookStore`) for every rent cycle
 * from the lease's own details — see `lib/calc/rentalPlanning.ts` for the
 * pure date-math this button calls. */
function PropertyDetailModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const updateProperty = useRentalsWorkbookStore((s) => s.updateProperty);
  const addRentalEntry = useRentalsWorkbookStore((s) => s.addEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [lease, setLease] = useState<Property>(property);

  const plannedEntries = usePlannedRentalsWorkbookStore((s) => s.workbook.entries);
  const addPlannedEntries = usePlannedRentalsWorkbookStore((s) => s.addEntries);
  const deletePlannedEntry = usePlannedRentalsWorkbookStore((s) => s.deleteEntry);
  const updatePlannedEntry = usePlannedRentalsWorkbookStore((s) => s.updateEntry);
  const propertyPlans = plannedEntries
    .filter((p) => p.propertyId === property.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  // README item 61: semi-automated rent collection — a separate, simpler
  // mechanism from the bulk lease-plan generator above. `proposal` is
  // recomputed from the committed `property` (not the unsaved `lease`
  // draft) every render, so it always reflects what's actually saved.
  // `collectDate`/`collectAmount` are the user's editable draft for THIS
  // one proposal — reset whenever the underlying due date changes, so
  // approving an old edited value against a newly-advanced proposal can't
  // happen by accident.
  const proposal = proposeRentCollection(property);
  const [collectDate, setCollectDate] = useState(proposal?.dueDate ?? '');
  const [collectAmount, setCollectAmount] = useState(proposal?.amount ?? 0);
  const lastProposalDueDate = useRef(proposal?.dueDate);
  if (proposal && lastProposalDueDate.current !== proposal.dueDate) {
    lastProposalDueDate.current = proposal.dueDate;
    setCollectDate(proposal.dueDate);
    setCollectAmount(proposal.amount);
  }

  const logCollection = async () => {
    if (!proposal) return;
    const ok = await confirmDialog(
      `Log ${fmtMoney(collectAmount, property.currencyCode)} rent income on ${collectDate}?`,
      'Approve this collection?',
    );
    if (!ok) return;
    if (!(await ensureSignedIn('Sign in to record this transaction.'))) return;
    addRentalEntry({ id: uid(), propertyId: property.id, date: collectDate, isDeposit: true, amount: collectAmount, categoryID: RENT_CATEGORY_ID });
    const pendingRentBalance = nextPendingBalance(proposal.amount, collectAmount);
    updateProperty(property.id, { lastCollectionDate: collectDate, pendingRentBalance });
    setLease((prev) => ({ ...prev, lastCollectionDate: collectDate, pendingRentBalance }));
    toast(pendingRentBalance > 0 ? `Logged — ${fmtMoney(pendingRentBalance, property.currencyCode)} still pending, carried to next cycle.` : 'Logged to the ledger.');
  };

  const saveLease = async () => {
    if (!(await ensureSignedIn('Sign in to save lease/tenant details.'))) return;
    updateProperty(property.id, lease);
    toast('Lease details saved.');
  };

  const generatePlans = async () => {
    if (!(await ensureSignedIn('Sign in to generate projected rent plans.'))) return;
    const generated = generateLeaseRentPlans(lease);
    if (!generated.length) return toast('Add monthly rent, a cycle day, and a lease start date first.');
    const existing = plannedEntries.filter((p) => p.sourceLeasePropertyId === property.id && !p.executed);
    if (existing.length) {
      const ok = await confirmDialog(
        'This replaces this property\'s not-yet-done projected plans with fresh ones. Already-completed plans are untouched.',
        'Regenerate projected rent?',
      );
      if (!ok) return;
      existing.forEach((p) => deletePlannedEntry(p.id));
    }
    addPlannedEntries(generated);
    toast(`${generated.length} projected rent plan${generated.length > 1 ? 's' : ''} added.`);
  };

  const markDone = async (planId: string) => {
    const plan = plannedEntries.find((p) => p.id === planId);
    if (!plan) return;
    const ok = await confirmDialog(`Add this ${fmtMoney(plan.amount, property.currencyCode)} rent income to the ledger?`, 'Mark as done?');
    if (!ok) return;
    if (!(await ensureSignedIn('Sign in to record this transaction.'))) return;
    addRentalEntry({ id: crypto.randomUUID(), propertyId: plan.propertyId, date: plan.date, isDeposit: plan.type === 'RENT_INCOME', amount: plan.amount, category: plan.category });
    updatePlannedEntry(planId, { executed: true });
    toast('Logged to the ledger.');
  };

  return (
    <Modal title={property.name} onClose={onClose}>
      <h4 style={{ margin: '0 0 8px' }}>Lease &amp; tenant details</h4>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Field label="Monthly rent">
          <TextInput type="number" step="0.01" value={lease.monthlyRent ?? ''} onChange={(e) => setLease({ ...lease, monthlyRent: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
        <Field label="Cycle start day (1-31)">
          <TextInput type="number" min={1} max={31} value={lease.cycleStartDay ?? ''} onChange={(e) => setLease({ ...lease, cycleStartDay: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
        <Field label="Lease start">
          <TextInput type="date" value={lease.leaseStartDate ?? ''} onChange={(e) => setLease({ ...lease, leaseStartDate: e.target.value || undefined })} />
        </Field>
        <Field label="Lease end (optional)">
          <TextInput type="date" value={lease.leaseEndDate ?? ''} onChange={(e) => setLease({ ...lease, leaseEndDate: e.target.value || undefined })} />
        </Field>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Field
          label="Collection cycle (optional)"
          title="Opts this property into the separate rent-collection proposal below — pick how often rent is actually collected."
        >
          <Select value={lease.collectionCycle ?? ''} onChange={(e) => setLease({ ...lease, collectionCycle: (e.target.value || undefined) as Property['collectionCycle'] })}>
            <option value="">— Not set —</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </Select>
        </Field>
        <Field
          label="Last collection date"
          title="When rent was last actually collected — the next proposal below is computed one cycle forward from this date (falls back to Lease start if left blank)."
        >
          <TextInput type="date" value={lease.lastCollectionDate ?? ''} onChange={(e) => setLease({ ...lease, lastCollectionDate: e.target.value || undefined })} />
        </Field>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Field label="Tenant name">
          <TextInput value={lease.tenantName ?? ''} onChange={(e) => setLease({ ...lease, tenantName: e.target.value })} />
        </Field>
        <Field label="Tenant contact">
          <TextInput value={lease.tenantContact ?? ''} onChange={(e) => setLease({ ...lease, tenantContact: e.target.value })} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          <input type="checkbox" checked={!!lease.utilitiesIncluded} onChange={(e) => setLease({ ...lease, utilitiesIncluded: e.target.checked })} />
          Utilities included in rent
        </label>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Field label="Security deposit">
          <TextInput type="number" step="0.01" value={lease.securityDeposit ?? ''} onChange={(e) => setLease({ ...lease, securityDeposit: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
        <Field label="Deposit type">
          <Select value={lease.securityDepositType ?? ''} onChange={(e) => setLease({ ...lease, securityDepositType: (e.target.value || undefined) as Property['securityDepositType'] })}>
            <option value="">—</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Deposit date">
          <TextInput type="date" value={lease.securityDepositDate ?? ''} onChange={(e) => setLease({ ...lease, securityDepositDate: e.target.value || undefined })} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          <input type="checkbox" checked={!!lease.securityDepositReturned} onChange={(e) => setLease({ ...lease, securityDepositReturned: e.target.checked })} />
          Deposit returned
        </label>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className="btn secondary" onClick={saveLease}><SaveIcon size={12} />Save lease details</button>
        <button className="btn" onClick={generatePlans}>Generate projected rent</button>
      </div>

      {property.collectionCycle && (
        <Card style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 6px' }}>Rent collection</h4>
          {proposal ? (
            <>
              <p className="footer-note" style={{ marginBottom: 8 }}>
                {proposal.isDue ? 'Due for collection' : 'Next collection'} — approve to log it, or adjust the date/amount first
                (e.g. a partial payment).
                {(property.pendingRentBalance ?? 0) > 0 && (
                  <> Includes {fmtMoney(property.pendingRentBalance!, property.currencyCode)} carried over from a previous
                  partial payment.</>
                )}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Collection date">
                  <TextInput type="date" value={collectDate} onChange={(e) => setCollectDate(e.target.value)} />
                </Field>
                <Field label="Amount" title="Pre-filled with the full expected amount — lower it to record a partial payment; the shortfall carries into the next proposal.">
                  <TextInput type="number" step="0.01" value={collectAmount} onChange={(e) => setCollectAmount(Number(e.target.value))} />
                </Field>
                <button className="btn" onClick={logCollection}>Approve &amp; log</button>
              </div>
            </>
          ) : (
            <p className="footer-note">Set a Last collection date (or a Lease start) above so the next due date can be computed.</p>
          )}
        </Card>
      )}

      <h4 style={{ margin: '0 0 6px' }}>Projected rent plans</h4>
      <div className="table-scroll" style={{ maxHeight: 260, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {propertyPlans.map((p) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{fmtMoney(p.amount, property.currencyCode)}</td>
                <td>{p.executed ? <span className="pill-buy">Done</span> : <span className="footer-note">Planned</span>}</td>
                <td>
                  {!p.executed && (
                    <>
                      <button className="btn secondary small" onClick={() => markDone(p.id)}>Mark done</button>{' '}
                      <button className="btn secondary small" onClick={() => deletePlannedEntry(p.id)}><TrashIcon size={12} />Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!propertyPlans.length && <tr><td colSpan={4} className="footer-note">No projected plans yet — fill in lease details above and click "Generate projected rent."</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function PropertiesTab() {
  return (
    <div>
      <NetIncomeSummary />
      <PropertiesList />
      <AddPropertyFab />
    </div>
  );
}

/* ============================== Entries ============================== */

/** Used by the Entries/Import tabs — "which property should this new entry
 * belong to." Archived properties are excluded (2026-09-03), same rule as
 * Banking's own `useAccountPicker`: hide from pickers for new activity,
 * never from a total (the property's own already-logged entries keep
 * counting toward Net Worth/summary totals unchanged either way). */
function usePropertyPicker() {
  const allProperties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const properties = useMemo(() => allProperties.filter((p) => p.isActive !== false), [allProperties]);
  const [propertyId, setPropertyId] = useState<string>(properties[0]?.id ?? '');
  const property = properties.find((p) => p.id === propertyId) ?? properties[0] ?? null;
  return { properties, property, propertyId: property?.id ?? '', setPropertyId };
}

/* ============================== Analytics ============================== */

/** MODULES_PLAN.md §11's Rentals sketch: net income by property (portfolio-
 * wide, currency-scoped) plus a category breakdown and monthly rollup for
 * one selected property — the latter two reuse `propertyByCategory`/
 * `propertyMonthlyRollup`, already computed for the plain tables in the
 * Entries tab (README item 23), just charted here instead. */
function AnalyticsTab() {
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const currencies = useMemo(() => [...new Set(properties.map((p) => p.currencyCode))].sort(), [properties]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '');
  const selectedProperty = properties.find((p) => p.id === propertyId) ?? properties[0] ?? null;

  const netByProperty = useMemo(
    () => netIncomeByProperty(properties, entries, effectiveCurrency),
    [properties, entries, effectiveCurrency],
  );
  const categoryList = useCategoryStore((s) => s.workbook.categories);
  const byCategory = useMemo(() => (selectedProperty ? propertyByCategory(selectedProperty, entries, categoryList) : {}), [selectedProperty, entries, categoryList]);
  const categories = Object.keys(byCategory);
  const rollup = useMemo(() => (selectedProperty ? propertyMonthlyRollup(selectedProperty, entries) : []), [selectedProperty, entries]);

  if (!properties.length) {
    return <p className="footer-note">Add a property first (Properties tab) to see charts here.</p>;
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {currencies.length > 1 && (
          <Field label="Currency" width={120}>
            <Select value={effectiveCurrency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Property" width={220}>
          <Select value={selectedProperty?.id ?? ''} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currencyCode})</option>)}
          </Select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
        <ChartCard title="Net income by property" empty={!netByProperty.length}>
          <Bar
            data={{
              labels: netByProperty.map((r) => r.name),
              datasets: [
                {
                  data: netByProperty.map((r) => r.net),
                  backgroundColor: netByProperty.map((r) => (r.net >= 0 ? cssVar('--profit') || '#3ecf8e' : cssVar('--loss') || '#e5484d')),
                },
              ],
            }}
            options={{ indexAxis: 'y', plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
        {selectedProperty && (
          <>
            <ChartCard title={`By category — ${selectedProperty.name}`} empty={!categories.length}>
              <Doughnut
                data={{
                  labels: categories,
                  datasets: [{ data: categories.map((c) => Math.abs(byCategory[c])), backgroundColor: categories.map((c) => tickerColor(c)) }],
                }}
                options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, selectedProperty.currencyCode)) } }}
              />
            </ChartCard>
            <ChartCard title={`Monthly rollup — ${selectedProperty.name}`} empty={!rollup.length}>
              <Bar
                data={{
                  labels: rollup.map((r) => r.month),
                  datasets: [
                    { label: 'Income', data: rollup.map((r) => r.income), backgroundColor: cssVar('--profit') || '#3ecf8e' },
                    { label: 'Expense', data: rollup.map((r) => r.expense), backgroundColor: cssVar('--loss') || '#e5484d' },
                  ],
                }}
                options={{ plugins: { datalabels: dlBarV((v) => fmtMoney(v, selectedProperty.currencyCode)) } }}
              />
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
}

/** User-requested (2026-08-28): the property's own "Transfers" FAB,
 * replacing the old always-visible add-entry card AND its own bank/cash-
 * only `LinkedEntryFields` shortcut — the shared `TransactionEntryModal`
 * supersedes both (it links to any module, not just Bank/Cash), defaulted
 * to THIS property. */
function EntriesFab({ propertyId, currencyCode }: { propertyId: string; currencyCode: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabPanel actions={[{ label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen(true) }]} />
      {open && <TransactionEntryModal defaultFinance={{ module: 'rentals', ref: propertyId, currencyCode }} onClose={() => setOpen(false)} />}
    </>
  );
}


/** Pending item 58's remainder: this export button used to sit inside
 * `EntriesList`'s own content, one level below where every other module's
 * equivalent export button lives (Done item 121's `headerExtra` rollout)
 * — `Tabs` had no per-tab `headerExtra` slot to hoist it into until now.
 * Lifted out into its own hook (mirrors QSE/PSX's `useTickerExport`) so
 * `RentalsPage` can build the header control at the `Tabs` call site,
 * scoped to whichever property is currently picked. */
function useEntriesExport(property: Property | null) {
  const allEntries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const entries = useMemo(() => (property ? allEntries.filter((e) => e.propertyId === property.id) : []), [allEntries, property]);

  const exportStatement = () => {
    if (!property) return;
    const rows = entries
      .filter((e) => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const header = ['Date', 'Type', 'Amount', 'Category', 'Note'];
    const body = rows.map((e) => [e.date, e.isDeposit ? 'Rent income' : 'Expense', e.isDeposit ? e.amount : -e.amount, categoryName(e.categoryID, categories), e.note ?? '']);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'now'}` : '';
    a.download = `${property.name.replace(/\s+/g, '_')}_statement${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Statement downloaded.');
  };

  return { fromDate, setFromDate, toDate, setToDate, exportStatement, hasRows: entries.length > 0 };
}

/** Popup edit form for one Rentals entry — replaces the old inline
 * table-row editing, same "editing done in a popup for UI consistency"
 * reasoning as `CashPage.tsx`'s `EditEntryModal`. */
function EditEntryModal({ entry, onClose }: { entry: RentalEntry; onClose: () => void }) {
  const updateEntry = useRentalsWorkbookStore((s) => s.updateEntry);
  const [draft, setDraft] = useState<RentalEntry>({ ...entry });

  const save = async () => {
    if (!(await warnIfLinked('rentals', entry.id))) return;
    updateEntry(entry.id, draft);
    toast('Entry updated.');
    onClose();
  };

  return (
    <FinanceEditModal titleText="Edit rental entry" onClose={onClose} onSave={save}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Date">
          <TextInput type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={draft.isDeposit ? 'RENT_INCOME' : 'EXPENSE'} onChange={(e) => setDraft({ ...draft, isDeposit: e.target.value === 'RENT_INCOME' })}>
            <option value="RENT_INCOME">Rent income</option>
            <option value="EXPENSE">Expense</option>
          </Select>
        </Field>
        <Field label="Amount" required>
          <TextInput type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
        </Field>
        <Field label="Category">
          <CategorySelect value={draft.categoryID ?? UNCATEGORIZED_ID} onChange={(categoryID) => setDraft({ ...draft, categoryID })} />
        </Field>
        <Field label="Note (optional)">
          <TextInput value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
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

/** User-requested (2026-09-03): "add filters to other tables as well" —
 * extends the Type/Category filter treatment Cash's statement tables got
 * (README Done item 224) here too. */
function EntriesList({ property }: { property: Property }) {
  const allEntries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const deleteEntry = useRentalsWorkbookStore((s) => s.deleteEntry);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const [editingEntry, setEditingEntry] = useState<RentalEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const allPropertyEntries = useMemo(() => allEntries.filter((e) => e.propertyId === property.id), [allEntries, property.id]);
  const categoryOptions = useMemo(
    () => [...new Set(allPropertyEntries.map((e) => categoryName(e.categoryID, categories)))].sort(),
    [allPropertyEntries, categories],
  );
  const entries = useMemo(
    () => allPropertyEntries.filter((e) => {
      if (typeFilter === 'in' && !e.isDeposit) return false;
      if (typeFilter === 'out' && e.isDeposit) return false;
      if (categoryFilter !== 'all' && categoryName(e.categoryID, categories) !== categoryFilter) return false;
      return true;
    }),
    [allPropertyEntries, typeFilter, categoryFilter, categories],
  );
  const linkByRecordId = useMemo(() => {
    const map = new Map<string, (typeof links)[number]>();
    for (const l of links) {
      if (l.from.module === 'rentals') map.set(l.fromRecordId, l);
      if (l.to.module === 'rentals') map.set(l.toRecordId, l);
    }
    return map;
  }, [links]);

  type Col = 'date' | 'type' | 'amount' | 'category';
  const sortValue = (e: RentalEntry, col: Col): number | string => {
    switch (col) {
      case 'type': return e.isDeposit ? 1 : 0;
      case 'amount': return e.amount;
      case 'category': return categoryName(e.categoryID, categories);
      default: return e.date;
    }
  };
  const { sorted, Th } = useSortableRows(entries, sortValue, 'date', 'desc');

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Field label="Type" width={130}>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
            <option value="all">All</option>
            <option value="in">Rent income</option>
            <option value="out">Expense</option>
          </Select>
        </Field>
        <Field label="Category" width={170}>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="date">Date</Th><Th col="type">Type</Th><Th col="amount">Amount</Th>
            <Th col="category">Category</Th><th>Note</th><th>Source</th><th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const link = linkByRecordId.get(e.id);
            const otherSide = link ? (link.from.module === 'rentals' && link.fromRecordId === e.id ? link.to : link.from) : undefined;
            return (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td className={e.isDeposit ? 'pill-buy' : 'pill-sell'}>{e.isDeposit ? 'Rent income' : 'Expense'}</td>
                <td className={e.isDeposit ? 'pill-buy' : 'pill-sell'}>{fmtMoney(e.isDeposit ? e.amount : -e.amount, property.currencyCode)}</td>
                <td>{e.isDeposit ? '—' : <span className="pill-info">{categoryName(e.categoryID, categories)}</span>}</td>
                <td className="cell-clip" title={e.note}>
                  {e.note}
                  {otherSide && (
                    <Link to={linkTargetPath(otherSide)} className="pill-info" style={{ marginLeft: 6, textDecoration: 'none' }} title="Linked — go to the other side">
                      🔗 Linked
                    </Link>
                  )}
                </td>
                <td className="footer-note cell-clip" title={e.source === 'statement-import' ? `Import${e.statementRef ? ` (${e.statementRef})` : ''}` : 'Manual'}>
                  {e.source === 'statement-import' ? `Import${e.statementRef ? ` (${e.statementRef})` : ''}` : 'Manual'}
                </td>
                <td>
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => setEditingEntry(e)} />{' '}
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon size={13} />}
                    align="right"
                    onClick={() => confirmAndDeleteLinkable('rentals', e.id, () => deleteEntry(e.id))}
                  />
                </td>
              </tr>
            );
          })}
          {!sorted.length && (
            <tr>
              <td colSpan={7} className="footer-note">
                {allPropertyEntries.length ? 'No entries match these filters.' : 'No entries for this property yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {editingEntry && <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />}
    </div>
  );
}

/** README item 25 / MODULES_PLAN.md §13: same browser-only "map these
 * columns" CSV import pattern as Banking/Cash — no new infra. A rental
 * entry's amount is unsigned with a separate `type`, so the mapped Amount
 * column's sign (after an optional flip) decides RENT_INCOME vs EXPENSE
 * and the stored amount is always the absolute value, same approach as
 * Cash's `ImportTab`. */
function ImportTab() {
  const { properties, property, propertyId, setPropertyId } = usePropertyPicker();
  const addEntries = useRentalsWorkbookStore((s) => s.addEntries);
  const ensureSignedIn = useEnsureSignedIn();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  const [categoryCol, setCategoryCol] = useState('');
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
      setAmountCol(head[1] ?? '');
      setCategoryCol('');
    };
    reader.readAsText(file);
  };

  const colIndex = (col: string) => headers.indexOf(col);
  const mapRow = (r: string[]) => {
    const rawAmount = Number(r[colIndex(amountCol)] ?? 0) * (flipSign ? -1 : 1);
    return {
      date: (r[colIndex(dateCol)] ?? '').trim(),
      isDeposit: rawAmount >= 0,
      amount: Math.abs(rawAmount),
      category: categoryCol ? (r[colIndex(categoryCol)] ?? '').trim() || undefined : undefined,
    };
  };
  const mappedPreview = rows.slice(0, 5).map(mapRow);

  const doImport = async () => {
    if (!property) return toast('Add and select a property first.');
    if (!dateCol || !amountCol) return toast('Map at least the date and amount columns.');
    if (!(await ensureSignedIn('Sign in to import entries.'))) return;
    const imported: RentalEntry[] = rows
      .map(mapRow)
      .filter((r) => r.date && !Number.isNaN(r.amount) && r.amount !== 0)
      .map((r) => ({
        id: uid(),
        propertyId: property.id,
        date: r.date,
        isDeposit: r.isDeposit,
        amount: r.amount,
        category: r.category,
        source: 'statement-import' as const,
        statementRef: fileName,
      }));
    if (!imported.length) return toast('No valid rows to import after mapping — check your column choices.');
    addEntries(imported);
    toast(`Imported ${imported.length} entr${imported.length === 1 ? 'y' : 'ies'} from ${fileName}.`);
    setHeaders([]);
    setRows([]);
    setFileName('');
  };

  if (!properties.length) {
    return <p className="footer-note">Add a property first (Properties tab) before importing entries.</p>;
  }

  return (
    <div>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Import a CSV export of rent/expense entries for one property. This is a simple "map these columns" tool —
        pick which column is which below. A positive amount is treated as rent income, negative as an expense
        (check "Flip sign" if your export does the opposite).
      </p>
      <Field label="Import into property" width={220}>
        <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currencyCode})</option>)}
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
            <Field label="Amount column" width={160}>
              <Select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <Field label="Category column (optional)" width={160}>
              <Select value={categoryCol} onChange={(e) => setCategoryCol(e.target.value)}>
                <option value="">None</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 20 }} title="Check this if your export uses positive numbers for expenses.">
              <input type="checkbox" checked={flipSign} onChange={(e) => setFlipSign(e.target.checked)} />
              Flip sign
            </label>
          </div>

          <h4>Preview (first 5 rows)</h4>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th></tr></thead>
              <tbody>
                {mappedPreview.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td className={r.isDeposit ? 'pill-buy' : 'pill-sell'}>{r.isDeposit ? 'Rent income' : 'Expense'}</td>
                    <td>{property ? fmtMoney(r.amount, property.currencyCode) : r.amount}</td>
                    <td>{r.category || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={doImport}>
            <PlusIcon />Import {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}
          </button>
        </Card>
      )}
    </div>
  );
}

function CategoryAndRollup({ property }: { property: Property }) {
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const categories = useCategoryStore((s) => s.workbook.categories);
  const byCategory = propertyByCategory(property, entries, categories);
  const rollup = useMemo(() => propertyMonthlyRollup(property, entries), [property, entries]);
  const cats = Object.keys(byCategory);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 16, marginBottom: 16 }}>
      {cats.length > 0 && (
        <CollapsibleCard title={<h3 style={{ margin: 0 }}>By category</h3>}>
          <div className="table-scroll">
            <table>
              <tbody>
                {cats.map((cat) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className={byCategory[cat] >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(byCategory[cat], property.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}
      {rollup.length > 0 && (
        <CollapsibleCard title={<h3 style={{ margin: 0 }}>Monthly rollup</h3>}>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Month</th><th>Income</th><th>Expense</th><th>Net</th></tr></thead>
              <tbody>
                {rollup.map((r) => (
                  <tr key={r.month}>
                    <td>{r.month}</td>
                    <td>{fmtMoney(r.income, property.currencyCode)}</td>
                    <td>{fmtMoney(r.expense, property.currencyCode)}</td>
                    <td className={r.net >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(r.net, property.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}

function EntriesTab({
  properties,
  property,
  propertyId,
  setPropertyId,
}: {
  properties: Property[];
  property: Property | null;
  propertyId: string;
  setPropertyId: (id: string) => void;
}) {
  if (!properties.length) {
    return <p className="footer-note">Add a property first (Properties tab) before logging income/expenses.</p>;
  }

  return (
    <div>
      <Field label="Property" width={220}>
        <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currencyCode})</option>)}
        </Select>
      </Field>
      {property && (
        <div style={{ marginTop: 12 }}>
          <CategoryAndRollup property={property} />
          <EntriesList property={property} />
          <EntriesFab propertyId={property.id} currencyCode={property.currencyCode} />
        </div>
      )}
    </div>
  );
}

/* ============================== Settings ============================== */

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
  const entries = useRentalsWorkbookStore((s) => s.workbook.entries);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
          <p style={{ marginTop: 0 }}>No data found in the cloud for this account's Rentals workbook. This won't upload automatically.</p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
                `Upload ${entries.length} local entr${entries.length === 1 ? 'y' : 'ies'} to the cloud?`,
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
            Upload local data to cloud ({entries.length} entries)
          </button>
        </Notice>
      )}
    </Card>
  );
}

function DataManagement() {
  const workbook = useRentalsWorkbookStore((s) => s.workbook);
  const setWorkbook = useRentalsWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentals-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<RentalsWorkbook>;
        setWorkbook({ ...createEmptyRentalsWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all rentals data?');
    if (!ok) return;
    setWorkbook(createEmptyRentalsWorkbook());
    toast('All rentals data cleared.');
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

export function RentalsPage({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const { properties, property, propertyId, setPropertyId } = usePropertyPicker();
  const { fromDate, setFromDate, toDate, setToDate, exportStatement, hasRows } = useEntriesExport(property);

  return (
    <div>
      <h1 className="pagetitle">Rentals</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Rental property income and expenses — recurring rent received and costs (maintenance, property tax,
        management fees) against one or more properties, not discrete buy/sell trades.
      </p>
      <Tabs
        tabs={[
          { key: 'properties', label: 'Properties', content: <PropertiesTab /> },
          {
            key: 'entries',
            label: 'Income & expenses',
            content: <EntriesTab properties={properties} property={property} propertyId={propertyId} setPropertyId={setPropertyId} />,
            headerExtra: hasRows ? (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="From (optional)">
                  <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </Field>
                <Field label="To (optional)">
                  <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </Field>
                <button className="btn secondary" onClick={exportStatement}>Export CSV</button>
              </div>
            ) : undefined,
          },
          { key: 'import', label: 'Import', content: <ImportTab /> },
          { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
          {
            key: 'settings',
            label: 'Settings',
            content: (
              <div>
                <p className="footer-note" style={{ marginTop: 0 }}>
                  Sign-in, profile, appearance, and a whole-app backup live on the{' '}
                  <Link to="/account">Account page →</Link>. What's below is specific to Rentals.
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
