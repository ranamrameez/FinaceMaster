import type { User } from 'firebase/auth';
import { useMemo, useRef, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, CollapsibleCard, MoneyValue } from '../../../components/Card';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { useSortableRows } from '../../../hooks/useSortableRows';
import {
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
import type { Subscription, SubscriptionsWorkbook } from '../../../types/subscriptionsWorkbook';
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

function AddSubscriptionForm() {
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
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Field label="Name" width={160}>
          <TextInput value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Netflix" />
        </Field>
        <Field label="Amount" width={110}>
          <TextInput type="number" step="0.01" value={s.amount || ''} onChange={(e) => setS({ ...s, amount: Number(e.target.value) })} />
        </Field>
        <Field label="Currency" width={100}>
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
          <Field label="Every N days" width={110}>
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
    </Card>
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
      {codes.map((code, i) => (
        <div key={code} className="stat-card card" style={hueStyle(HUES[i % HUES.length])}>
          <div className="label">Monthly recurring spend ({code})</div>
          <MoneyValue n={totals[code]} currency={code} className="value pill-sell" />
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

function SubscriptionDetail({ sub, onBack }: { sub: Subscription; onBack: () => void }) {
  const updateEntry = useSubscriptionsWorkbookStore((s) => s.updateEntry);
  const deleteEntry = useSubscriptionsWorkbookStore((s) => s.deleteEntry);
  const ensureSignedIn = useEnsureSignedIn();
  const [editing, setEditing] = useState(false);
  const [editRow, setEditRow] = useState<Subscription>(sub);

  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const plannedBankEntries = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const addPlannedBankEntries = usePlannedBankWorkbookStore((s) => s.addEntries);
  const deletePlannedBankEntry = usePlannedBankWorkbookStore((s) => s.deleteEntry);
  const plannedCashEntries = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const addPlannedCashEntries = usePlannedCashWorkbookStore((s) => s.addEntries);
  const deletePlannedCashEntry = usePlannedCashWorkbookStore((s) => s.deleteEntry);

  const [linkModule, setLinkModule] = useState<'bank' | 'cash'>(sub.paidVia?.module ?? 'bank');
  const [linkAccountId, setLinkAccountId] = useState(sub.paidVia?.module === 'bank' ? sub.paidVia.ref || accounts[0]?.id || '' : accounts[0]?.id || '');

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
              <TextInput value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} />
              <TextInput type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} />
              <Select value={editRow.currencyCode} onChange={(e) => setEditRow({ ...editRow, currencyCode: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
              <Select value={editRow.billingCycle} onChange={(e) => setEditRow({ ...editRow, billingCycle: e.target.value as Subscription['billingCycle'] })}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom (days)</option>
              </Select>
              {editRow.billingCycle === 'custom' && (
                <TextInput type="number" value={editRow.customDays ?? ''} onChange={(e) => setEditRow({ ...editRow, customDays: Number(e.target.value) })} placeholder="Every N days" />
              )}
              <TextInput type="date" value={editRow.startDate} onChange={(e) => setEditRow({ ...editRow, startDate: e.target.value })} />
              <TextInput value={editRow.category ?? ''} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} placeholder="Category" />
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>
              <button className="btn secondary small" onClick={() => setEditing(false)}>Cancel</button>
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
              <button className="btn secondary small" onClick={() => { setEditRow(sub); setEditing(true); }}>Edit</button>
              <button className="btn secondary small" onClick={toggleActive}>{sub.active ? 'Cancel' : 'Reactivate'}</button>
              <button
                className="btn secondary small"
                onClick={async () => {
                  if (await confirmDialog('This cannot be undone.', `Delete subscription "${sub.name}"?`)) { deleteEntry(sub.id); onBack(); }
                }}
              >
                <TrashIcon size={12} />Delete
              </button>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 8, marginTop: 12 }}>
          <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Monthly equivalent</div><MoneyValue n={monthlyEquivalent(sub)} currency={sub.currencyCode} /></div>
          <div className="stat-card card" style={hueStyle(HUES[2])}><div className="label">Yearly equivalent</div><MoneyValue n={monthlyEquivalent(sub) * 12} currency={sub.currencyCode} /></div>
          <div className="stat-card card" style={hueStyle(HUES[0])}><div className="label">Next renewal</div><div className="value" style={{ fontSize: 14 }}>{sub.active ? nextBillingDate(sub) : '—'}</div></div>
          <div className="stat-card card" style={hueStyle(HUES[7])}><div className="label">Status</div><div className={`value ${sub.active ? 'pill-buy' : 'pill-sell'}`} style={{ fontSize: 14 }}>{sub.active ? 'Active' : 'Cancelled'}</div></div>
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
            accounts.length ? (
              <Field label="Bank account">
                <Select value={linkAccountId} onChange={(e) => setLinkAccountId(e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
                </Select>
              </Field>
            ) : (
              <p className="footer-note">No bank accounts yet — add one on the Banking page first.</p>
            )
          )}
          <button className="btn" onClick={generatePlans} disabled={linkModule === 'bank' && !accounts.length}>
            {linkedLabel ? 'Re-link / regenerate plans' : 'Generate renewal plans'}
          </button>
        </div>
      </Card>

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

function AccountSection({
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const subs = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
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
        <div className="card" style={{ marginTop: 8, borderLeft: '3px solid var(--warn, orange)' }}>
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
        </div>
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
  syncStatus,
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
                  <AddSubscriptionForm />
                  <SubscriptionList onSelect={setSelected} />
                </div>
              ),
            },
            { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
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
      )}
    </div>
  );
}
