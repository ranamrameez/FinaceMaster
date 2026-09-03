import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Notice';
import { Tooltip } from '../../../components/Tooltip';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { FabButton } from '../../../components/ui/Fab';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import {
  alertTriggerMs,
  generateRenewalOccurrences,
  monthlyEquivalent,
  nextBillingDate,
  spendByCategory,
  totalMonthlySpendByCurrency,
  upcomingRenewals,
} from '../../../lib/calc/subscriptionsModule';
import { dlBarV, dlDoughnut } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { firebaseReady } from '../../../lib/firebase/client';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { createEmptySubscriptionsWorkbook } from '../../../store/defaultSubscriptionsWorkbook';
import { usePlannedBankWorkbookStore } from '../../../store/plannedBankWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../../store/plannedCashWorkbookStore';
import { useSubscriptionsWorkbookStore } from '../../../store/subscriptionsWorkbookStore';
import type { Subscription, SubscriptionAlert, SubscriptionsWorkbook } from '../../../types/subscriptionsWorkbook';
import type { PlannedBankTransaction } from '../../../types/plannedBank';
import type { PlannedCashEntry } from '../../../types/plannedCash';
import { ChartCard } from '../../qse/components/ChartCard';

const today = () => new Date().toISOString().slice(0, 10);

const CYCLE_LABEL: Record<Subscription['billingCycle'], string> = {
  monthly: '/mo',
  yearly: '/yr',
  weekly: '/wk',
  custom: '/cycle',
};

function emptySubscription(defaultCurrency: string): Subscription {
  return { id: '', name: '', amount: 0, currencyCode: defaultCurrency, billingCycle: 'monthly', startDate: today(), active: true };
}

/* ============================== Add subscription ============================== */

/** Floating "add a subscription" button (user feedback 2026-08-27: adding
 * an entity isn't a routine task, use FABs — same pattern already
 * established for EMI/Banking/Cash/Bank Planning, README Done items
 * 166/170). */
function AddSubscriptionFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabButton label="Add a subscription" onClick={() => setOpen(true)}><PlusIcon /></FabButton>
      {open && (
        <Modal title="Add a subscription" onClose={() => setOpen(false)}>
          <AddSubscriptionForm onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddSubscriptionForm({ onSaved }: { onSaved?: () => void } = {}) {
  const addEntry = useSubscriptionsWorkbookStore((s) => s.addEntry);
  const defaultCurrency = useSubscriptionsWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const [lastCurrency, setLastCurrency] = useLastCurrency('subscriptions', defaultCurrency);
  const ensureSignedIn = useEnsureSignedIn();
  const [s, setS] = useState<Subscription>(() => emptySubscription(lastCurrency));

  const submit = async () => {
    if (!s.name.trim()) return toast('Enter a subscription name.');
    if (!s.amount || s.amount <= 0) return toast('Enter an amount.');
    if (s.billingCycle === 'custom' && (!s.customDays || s.customDays <= 0)) return toast('Enter the custom cycle length in days.');
    if (!(await ensureSignedIn('Sign in to save subscriptions.'))) return;
    addEntry({ ...s, id: crypto.randomUUID(), name: s.name.trim(), category: s.category?.trim() || undefined });
    toast(`Subscription "${s.name.trim()}" added.`);
    setS(emptySubscription(s.currencyCode));
    onSaved?.();
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Name" width={160} required>
          <TextInput value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Netflix" />
        </Field>
        <Field label="Amount" width={110} required>
          <TextInput type="number" step="0.01" value={s.amount || ''} onChange={(e) => setS({ ...s, amount: Number(e.target.value) })} />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={s.currencyCode} onChange={(e) => { setS({ ...s, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Billing cycle" width={140}>
          <Select value={s.billingCycle} onChange={(e) => setS({ ...s, billingCycle: e.target.value as Subscription['billingCycle'] })}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom (days)</option>
          </Select>
        </Field>
        {s.billingCycle === 'custom' && (
          <Field label="Every N days" width={110} required>
            <TextInput type="number" value={s.customDays ?? ''} onChange={(e) => setS({ ...s, customDays: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Start date">
          <TextInput type="date" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} />
        </Field>
        <Field label="Category (optional)" width={150}>
          <TextInput list="subscriptions-category-datalist" value={s.category ?? ''} onChange={(e) => setS({ ...s, category: e.target.value })} placeholder="e.g. Streaming" />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add subscription
      </button>
    </div>
  );
}

/* ============================== Overall summary ============================== */

function OverallSummary() {
  const subs = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  const totals = totalMonthlySpendByCurrency(subs);
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 8, marginBottom: 16 }}>
      {codes.map((code) => (
        <div key={code} className="stat-card card" style={hueStyle('var(--loss)')}>
          <div className="label">Monthly recurring spend ({code})</div>
          <MoneyValue n={totals[code]} currency={code} />
          <div className="sub">{fmtMoney(totals[code] * 12, code)} / year</div>
        </div>
      ))}
    </div>
  );
}

/* ============================== List ============================== */

function SubscriptionList({ onSelect }: { onSelect: (sub: Subscription) => void }) {
  const subs = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  const knownCategories = useMemo(() => [...new Set(subs.map((s) => s.category).filter((c): c is string => !!c))].sort(), [subs]);

  type Row = { sub: Subscription; monthly: number; next: string };
  const rows: Row[] = subs.map((s) => ({ sub: s, monthly: monthlyEquivalent(s), next: s.active ? nextBillingDate(s) : '' }));
  type Col = 'name' | 'amount' | 'monthly' | 'category' | 'next' | 'status';
  const sortValue = (r: Row, col: Col): number | string => {
    switch (col) {
      case 'amount': return r.sub.amount;
      case 'monthly': return r.monthly;
      case 'category': return r.sub.category ?? '';
      case 'next': return r.next || 'zzzz';
      case 'status': return r.sub.active ? 0 : 1;
      default: return r.sub.name;
    }
  };
  const { sorted, Th } = useSortableRows(rows, sortValue, 'name', 'asc');

  return (
    <div className="table-scroll">
      <datalist id="subscriptions-category-datalist">
        {knownCategories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <table>
        <thead>
          <tr>
            <Th col="name">Name</Th><Th col="amount">Amount</Th><Th col="monthly">Monthly equiv.</Th>
            <Th col="category">Category</Th><Th col="next">Next renewal</Th><Th col="status">Status</Th><th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ sub: s, monthly, next }) => (
            <tr key={s.id} onClick={() => onSelect(s)} style={{ cursor: 'pointer' }}>
              <td>{s.name}</td>
              <td>{fmtMoney(s.amount, s.currencyCode)}{CYCLE_LABEL[s.billingCycle]}</td>
              <td>{fmtMoney(monthly, s.currencyCode)}</td>
              <td>{s.category || '—'}</td>
              <td>{next || '—'}</td>
              <td className={s.active ? 'pill-buy' : 'pill-sell'}>{s.active ? 'Active' : 'Cancelled'}</td>
              <td><button className="btn secondary small" onClick={(e) => { e.stopPropagation(); onSelect(s); }}>Open</button></td>
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={7} className="footer-note">No subscriptions yet — add one above.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ============================== Detail ============================== */

const SUGGESTED_LEAD_DAYS = [3, 2, 1];

/** User-requested (2026-08-26): renewal/expiry alerts, either a suggested
 * lead time (3/2/1 days before the next occurrence, re-anchored each
 * cycle automatically — see `alertTriggerMs`) or a one-off custom date
 * and time, for something that doesn't follow a regular billing cycle at
 * all (e.g. "remind me on this exact date my SIM expires"). Due alerts
 * surface via `SubscriptionAlertsPopup` (App-root, auto-hiding) and the
 * Net Worth page's own upcoming-renewals notice. */
function AlertsSection({ sub }: { sub: Subscription }) {
  const updateEntry = useSubscriptionsWorkbookStore((s) => s.updateEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [customAt, setCustomAt] = useState('');
  const alerts = sub.alerts ?? [];

  const addAlert = async (patch: Pick<SubscriptionAlert, 'daysBefore' | 'customAt'>) => {
    if (!(await ensureSignedIn('Sign in to save alerts.'))) return;
    updateEntry(sub.id, { alerts: [...alerts, { id: crypto.randomUUID(), ...patch }] });
    toast('Alert added.');
  };

  const removeAlert = async (id: string) => {
    if (!(await ensureSignedIn('Sign in to update alerts.'))) return;
    updateEntry(sub.id, { alerts: alerts.filter((a) => a.id !== id) });
  };

  const describe = (a: SubscriptionAlert) => {
    if (a.daysBefore != null) return `${a.daysBefore} day${a.daysBefore === 1 ? '' : 's'} before renewal`;
    if (a.customAt) return `On ${new Date(a.customAt).toLocaleString()}`;
    return 'Alert';
  };

  return (
    <CollapsibleCard title={<h3 style={{ margin: 0 }}>Renewal / expiry alerts</h3>} style={{ marginBottom: 16 }}>
      <p className="footer-note" style={{ marginTop: 0 }}>
        Get reminded before this renews or expires — pick a suggested lead time, or set an exact date and time.
      </p>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {SUGGESTED_LEAD_DAYS.map((d) => {
          const already = alerts.some((a) => a.daysBefore === d);
          return (
            <button
              key={d}
              className={already ? 'chip active' : 'chip'}
              disabled={already}
              onClick={() => addAlert({ daysBefore: d })}
            >
              {d} day{d === 1 ? '' : 's'} before
            </button>
          );
        })}
        <TextInput type="datetime-local" value={customAt} onChange={(e) => setCustomAt(e.target.value)} style={{ width: 200 }} />
        <button
          className="btn secondary small"
          onClick={async () => {
            if (!customAt) return toast('Pick a date and time first.');
            await addAlert({ customAt });
            setCustomAt('');
          }}
        >
          <PlusIcon size={12} />Add custom alert
        </button>
      </div>
      {alerts.length > 0 ? (
        <div className="table-scroll">
          <table>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>{describe(a)}</td>
                  <td className="footer-note">
                    {sub.active ? new Date(alertTriggerMs(sub, a) ?? 0).toLocaleString() : 'Subscription cancelled'}
                  </td>
                  <td><IconButton label="Remove" icon={<TrashIcon size={13} />} align="right" onClick={() => removeAlert(a.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="footer-note" style={{ marginBottom: 0 }}>No alerts configured yet.</p>
      )}
    </CollapsibleCard>
  );
}

function SubscriptionDetail({ sub, onBack }: { sub: Subscription; onBack: () => void }) {
  const updateEntry = useSubscriptionsWorkbookStore((s) => s.updateEntry);
  const deleteEntry = useSubscriptionsWorkbookStore((s) => s.deleteEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [editing, setEditing] = useState(false);
  const [editRow, setEditRow] = useState<Subscription>(sub);

  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  // Archived accounts stay findable (so an already-linked archived account
  // still shows its real name, not "a removed account") but are hidden from
  // the "pick where to generate NEW plans" picker below — same rule as
  // `AccountsList`'s own filter; see `BankAccount.isActive`'s doc comment.
  const activeAccounts = accounts.filter((a) => a.isActive !== false);
  const plannedBankEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const addPlannedBankEntries = usePlannedBankWorkbookStore((s) => s.addEntries);
  const deletePlannedBankEntry = usePlannedBankWorkbookStore((s) => s.deleteEntry);
  const plannedCashEntries = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const addPlannedCashEntries = usePlannedCashWorkbookStore((s) => s.addEntries);
  const deletePlannedCashEntry = usePlannedCashWorkbookStore((s) => s.deleteEntry);

  const [linkModule, setLinkModule] = useState<'bank' | 'cash'>(sub.paidVia?.module ?? 'bank');
  const [linkAccountId, setLinkAccountId] = useState(sub.paidVia?.module === 'bank' ? sub.paidVia.ref || activeAccounts[0]?.id || '' : activeAccounts[0]?.id || '');

  const occurrences = generateRenewalOccurrences(sub);
  const linkedLabel = sub.paidVia
    ? sub.paidVia.module === 'cash'
      ? 'Cash'
      : accounts.find((a) => a.id === sub.paidVia?.ref)?.name || 'a removed account'
    : null;

  const saveEdit = () => {
    updateEntry(sub.id, editRow);
    toast('Subscription updated.');
    setEditing(false);
  };

  const toggleActive = async () => {
    if (!(await ensureSignedIn('Sign in to update this subscription.'))) return;
    updateEntry(sub.id, sub.active ? { active: false, cancelledDate: today() } : { active: true, cancelledDate: undefined });
    toast(sub.active ? 'Subscription cancelled.' : 'Subscription reactivated.');
  };

  const generatePlans = async () => {
    if (!(await ensureSignedIn('Sign in to generate renewal plans.'))) return;
    if (!occurrences.length) return toast('No upcoming occurrences to plan.');
    const relinking = !!sub.paidVia;
    if (relinking) {
      const ok = await confirmDialog(
        'This replaces this subscription\'s not-yet-done planned renewals with fresh ones. Already-completed plans are untouched.',
        'Regenerate renewal plans?',
      );
      if (!ok) return;
      plannedBankEntries.filter((p) => p.sourceSubscriptionId === sub.id && !p.executed).forEach((p) => deletePlannedBankEntry(p.id));
      plannedCashEntries.filter((p) => p.sourceSubscriptionId === sub.id && !p.executed).forEach((p) => deletePlannedCashEntry(p.id));
    }
    if (linkModule === 'bank') {
      const account = accounts.find((a) => a.id === linkAccountId);
      if (!account) return toast('Pick a bank account first.');
      const newPlans: PlannedBankTransaction[] = occurrences.map((o) => ({
        id: crypto.randomUUID(), accountId: account.id, date: o.date,
        description: `Subscription: ${sub.name}`, amount: -o.amount, executed: false, sourceSubscriptionId: sub.id,
      }));
      addPlannedBankEntries(newPlans);
      updateEntry(sub.id, { paidVia: { module: 'bank', ref: account.id } });
      toast(`${newPlans.length} planned renewal${newPlans.length > 1 ? 's' : ''} added to ${account.name}'s Planning tab.`);
    } else {
      const newPlans: PlannedCashEntry[] = occurrences.map((o) => ({
        id: crypto.randomUUID(), date: o.date, type: 'OUT', amount: o.amount, currencyCode: sub.currencyCode,
        category: sub.category, note: `Subscription: ${sub.name}`, executed: false, sourceSubscriptionId: sub.id,
      }));
      addPlannedCashEntries(newPlans);
      updateEntry(sub.id, { paidVia: { module: 'cash' } });
      toast(`${newPlans.length} planned renewal${newPlans.length > 1 ? 's' : ''} added to Cash's Planning tab.`);
    }
  };

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All subscriptions</button>
      <Card style={{ marginBottom: 16 }}>
        {editing ? (
          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Field label="Name">
                <TextInput value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} />
              </Field>
              <Field label="Amount">
                <TextInput type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} />
              </Field>
              <Field label="Currency">
                <Select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
              </Field>
              <Field label="Billing cycle">
                <Select value={editRow.billingCycle} onChange={(e) => setEditRow({ ...editRow, billingCycle: e.target.value as Subscription['billingCycle'] })}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom (days)</option>
                </Select>
              </Field>
              {editRow.billingCycle === 'custom' && (
                <Field label="Every N days">
                  <TextInput type="number" value={editRow.customDays ?? ''} onChange={(e) => setEditRow({ ...editRow, customDays: Number(e.target.value) })} />
                </Field>
              )}
              <Field label="Start date">
                <TextInput type="date" value={editRow.startDate} onChange={(e) => setEditRow({ ...editRow, startDate: e.target.value })} />
              </Field>
              <Field label="Category (optional)">
                <TextInput value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} />
              </Field>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />
              <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditing(false)} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{sub.name}</div>
              <div className="footer-note">
                {fmtMoney(sub.amount, sub.currencyCode)}{CYCLE_LABEL[sub.billingCycle]} · {sub.category || 'Uncategorized'} · since {sub.startDate}
                {!sub.active && sub.cancelledDate && ` · cancelled ${sub.cancelledDate}`}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => { setEditRow(sub); setEditing(true); }} />
              <button className="btn secondary small" onClick={toggleActive}>{sub.active ? 'Cancel' : 'Reactivate'}</button>
              <IconButton
                label="Delete"
                icon={<TrashIcon size={13} />}
                align="right"
                onClick={async () => {
                  if (await confirmDialog('This cannot be undone.', `Delete subscription "${sub.name}"?`)) { deleteEntry(sub.id); onBack(); }
                }}
              />
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card" style={hueStyle(HUES[3])}>
            <Tooltip text="What this costs per month on average — converted from its real billing cycle (weekly, yearly, etc.) so you can compare it to other subscriptions.">
              <div className="label" style={{ cursor: 'pointer' }}>Monthly equivalent</div>
            </Tooltip>
            <MoneyValue n={monthlyEquivalent(sub)} currency={sub.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(HUES[2])}>
            <Tooltip text="The monthly equivalent multiplied by 12 — what this subscription costs you over a full year.">
              <div className="label" style={{ cursor: 'pointer' }}>Yearly equivalent</div>
            </Tooltip>
            <MoneyValue n={monthlyEquivalent(sub) * 12} currency={sub.currencyCode} />
          </div>
          <div className="stat-card card" style={hueStyle(HUES[0])}><div className="label">Next renewal</div><div className="value" style={{ fontSize: 14 }}>{sub.active ? nextBillingDate(sub) : '—'}</div></div>
          <div className="stat-card card" style={hueStyle(sub.active ? 'var(--profit)' : 'var(--loss)')}><div className="label">Status</div><div className="value" style={{ fontSize: 14 }}>{sub.active ? 'Active' : 'Cancelled'}</div></div>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px' }}>Link to a paying account</h4>
        {linkedLabel ? (
          <p className="footer-note" style={{ marginBottom: 8 }}>
            Paid via <strong>{linkedLabel}</strong> — upcoming renewals are planned in its Planning tab.
          </p>
        ) : (
          <p className="footer-note" style={{ marginBottom: 8 }}>
            Not linked yet. Linking generates a planned (not-yet-done) entry for every renewal in the next 12
            months in the chosen account's Planning tab.
          </p>
        )}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Pays via">
            <Select value={linkModule} onChange={(e) => setLinkModule(e.target.value as 'bank' | 'cash')}>
              <option value="bank">Bank account</option>
              <option value="cash">Cash</option>
            </Select>
          </Field>
          {linkModule === 'bank' && (
            activeAccounts.length ? (
              <Field label="Bank account">
                <Select value={linkAccountId} onChange={(e) => setLinkAccountId(e.target.value)}>
                  {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
                </Select>
              </Field>
            ) : (
              <p className="footer-note">No active bank accounts — add or unarchive one on the Banking page first.</p>
            )
          )}
          <button className="btn" onClick={generatePlans} disabled={linkModule === 'bank' && !activeAccounts.length}>
            {linkedLabel ? 'Re-link / regenerate plans' : 'Generate renewal plans'}
          </button>
        </div>
      </Card>

      <AlertsSection sub={sub} />

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Upcoming occurrences (next 12 months)</h3>}>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date</th><th>Amount</th></tr></thead>
            <tbody>
              {occurrences.map((o, i) => (
                <tr key={i}><td>{o.date}</td><td>{fmtMoney(o.amount, sub.currencyCode)}</td></tr>
              ))}
              {!occurrences.length && <tr><td colSpan={2} className="footer-note">No upcoming occurrences (subscription is cancelled).</td></tr>}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
    </div>
  );
}

/* ============================== Analytics ============================== */

function AnalyticsTab() {
  const subs = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const currencies = useMemo(() => [...new Set(subs.map((s) => s.currencyCode))].sort(), [subs]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

  const byCategory = useMemo(() => spendByCategory(subs, effectiveCurrency), [subs, effectiveCurrency]);
  const categories = Object.keys(byCategory);
  const renewals = useMemo(() => upcomingRenewals(subs, 30), [subs]);

  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const byAccount = useMemo(() => {
    const out: Record<string, number> = {};
    subs.filter((s) => s.active && s.currencyCode === effectiveCurrency).forEach((s) => {
      const label = !s.paidVia ? 'Not linked' : s.paidVia.module === 'cash' ? 'Cash' : accounts.find((a) => a.id === s.paidVia?.ref)?.name || 'Removed account';
      out[label] = (out[label] || 0) + monthlyEquivalent(s);
    });
    return out;
  }, [subs, effectiveCurrency, accounts]);
  const accountLabels = Object.keys(byAccount);

  if (!subs.length) {
    return <p className="footer-note">Add a subscription first to see charts here.</p>;
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
        <ChartCard title="Spend by category (monthly equivalent)" empty={!categories.length}>
          <Doughnut
            data={{
              labels: categories,
              datasets: [{ data: categories.map((c) => byCategory[c]), backgroundColor: categories.map((c) => tickerColor(c)) }],
            }}
            options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
        <ChartCard title="Spend by paying account (monthly equivalent)" empty={!accountLabels.length}>
          <Bar
            data={{
              labels: accountLabels,
              datasets: [{ data: accountLabels.map((a) => byAccount[a]), backgroundColor: cssVar('--profit') || '#3ecf8e' }],
            }}
            options={{ indexAxis: 'y', plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
        <ChartCard title="Upcoming renewals (next 30 days)" empty={!renewals.length}>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Name</th><th>Amount</th></tr></thead>
              <tbody>
                {renewals.map((r) => (
                  <tr key={r.subscription.id}>
                    <td>{r.date}</td>
                    <td>{r.subscription.name}</td>
                    <td>{fmtMoney(r.subscription.amount, r.subscription.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

/* ============================== Settings ============================== */

// User-reported (2026-08-27, then again 2026-08-28): duplicated the global
// /account hub's own Sync status section — dropped the status text/heading
// here, same fix already applied app-wide (see BankPage.tsx's own
// AccountSection for the fullest write-up of this fix).
function AccountSection({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const subs = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
          <p style={{ marginTop: 0 }}>No data found in the cloud for this account's Subscriptions workbook. This won't upload automatically.</p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
                `Upload ${subs.length} local subscription(s) to the cloud?`,
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
            Upload local data to cloud ({subs.length} subscriptions)
          </button>
        </Notice>
      )}
    </Card>
  );
}

function DataManagement() {
  const workbook = useSubscriptionsWorkbookStore((s) => s.workbook);
  const setWorkbook = useSubscriptionsWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<SubscriptionsWorkbook>;
        setWorkbook({ ...createEmptySubscriptionsWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all subscriptions data?');
    if (!ok) return;
    setWorkbook(createEmptySubscriptionsWorkbook());
    toast('All subscriptions data cleared.');
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

export function SubscriptionsPage({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Subscription | null>(null);
  const subs = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  const liveSelected = selected ? subs.find((s) => s.id === selected.id) ?? null : null;

  return (
    <div>
      <h1 className="pagetitle">Subscriptions</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Recurring payments — streaming, gym, software, memberships — tracked independently and optionally
        linked to whichever Bank account or Cash actually pays them.
      </p>
      {liveSelected ? (
        <SubscriptionDetail sub={liveSelected} onBack={() => setSelected(null)} />
      ) : (
        <Tabs
          tabs={[
            {
              key: 'subscriptions',
              label: 'Subscriptions',
              content: (
                <div>
                  <OverallSummary />
                  <SubscriptionList onSelect={setSelected} />
                  <AddSubscriptionFab />
                </div>
              ),
            },
            { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
            {
              key: 'settings',
              label: 'Settings',
              content: (
                <div>
                  <p className="footer-note" style={{ marginTop: 0 }}>
                    Sign-in, profile, appearance, and a whole-app backup live on the{' '}
                    <Link to="/account">Account page →</Link>. What's below is specific to Subscriptions.
                  </p>
                  <AccountSection cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
                  <DataManagement />
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
