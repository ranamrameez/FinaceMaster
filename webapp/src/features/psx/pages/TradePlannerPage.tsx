import { useState } from 'react';
import { PSX_TICKER_DATALIST_ID } from '../../../components/PSXTickerDatalist';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { CheckIcon, PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, TextInput } from '../../../components/ui/Field';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { TradePlan, TradePlanLeg } from '../../../types/workbook';
import { usePSXDerived } from '../hooks/usePSXDerived';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLeg(): TradePlanLeg {
  return { date: today(), ticker: '', action: 'BUY', shares: 0, price: 0 };
}

function NewPlanForm() {
  const addTradePlan = usePSXWorkbookStore((s) => s.addTradePlan);
  const ensureSignedIn = useEnsureSignedIn();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [legs, setLegs] = useState<TradePlanLeg[]>([emptyLeg()]);

  const update = (i: number, patch: Partial<TradePlanLeg>) =>
    setLegs((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const valid = legs.filter((l) => l.ticker && l.shares > 0 && l.price > 0);
    if (!name.trim()) return toast('Give this plan a name.');
    if (!valid.length) return toast('Add at least one complete leg (ticker, shares, price).');
    if (!(await ensureSignedIn('Sign in to save trade plans.'))) return;
    const plan: TradePlan = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: today(),
      notes: notes.trim() || undefined,
      legs: valid.map((l) => ({ ...l, ticker: l.ticker.toUpperCase() })),
    };
    addTradePlan(plan);
    toast(`Saved plan "${plan.name}" with ${valid.length} leg${valid.length > 1 ? 's' : ''}.`);
    setName('');
    setNotes('');
    setLegs([emptyLeg()]);
  };

  return (
    <div className="card" style={{ padding: 12, marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Field label="Plan name" width={220}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 bank rotation" />
        </Field>
        <Field label="Notes (optional)" width={320}>
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {legs.map((l, i) => (
        <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input type="date" value={l.date} onChange={(e) => update(i, { date: e.target.value })} />
          <input
            placeholder="Ticker"
            value={l.ticker}
            onChange={(e) => update(i, { ticker: e.target.value.toUpperCase() })}
            list={PSX_TICKER_DATALIST_ID}
            style={{ width: 80 }}
          />
          <select value={l.action} onChange={(e) => update(i, { action: e.target.value as 'BUY' | 'SELL' })}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <input
            type="number"
            placeholder="Shares"
            value={l.shares || ''}
            onChange={(e) => update(i, { shares: Number(e.target.value) })}
            style={{ width: 90 }}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price"
            value={l.price || ''}
            onChange={(e) => update(i, { price: Number(e.target.value) })}
            style={{ width: 90 }}
          />
          <button className="btn secondary small" onClick={() => setLegs((rs) => rs.filter((_, idx) => idx !== i))}>
            <TrashIcon size={12} />Remove
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn secondary" onClick={() => setLegs((rs) => [...rs, emptyLeg()])}>
          <PlusIcon />Add leg
        </button>
        <button className="btn" onClick={save}>
          <SaveIcon />Save plan
        </button>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: TradePlan }) {
  const updateTradePlan = usePSXWorkbookStore((s) => s.updateTradePlan);
  const deleteTradePlan = usePSXWorkbookStore((s) => s.deleteTradePlan);
  const executeTradePlanLeg = usePSXWorkbookStore((s) => s.executeTradePlanLeg);
  const ensureSignedIn = useEnsureSignedIn();
  const { workbook, calcFee } = usePSXDerived();
  const currency = workbook.settings.currency;

  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(plan.name);
  const [notes, setNotes] = useState(plan.notes || '');
  const [editLegIndex, setEditLegIndex] = useState<number | null>(null);
  const [editLeg, setEditLeg] = useState<TradePlanLeg | null>(null);

  const saveMeta = () => {
    updateTradePlan(plan.id, { name: name.trim() || plan.name, notes: notes.trim() || undefined });
    setEditingMeta(false);
  };

  const startEditLeg = (i: number) => {
    setEditLegIndex(i);
    setEditLeg({ ...plan.legs[i] });
  };
  const saveLeg = () => {
    if (editLegIndex === null || !editLeg) return;
    updateTradePlan(plan.id, { legs: plan.legs.map((l, i) => (i === editLegIndex ? editLeg : l)) });
    setEditLegIndex(null);
    setEditLeg(null);
  };
  const removeLeg = async (i: number) => {
    const leg = plan.legs[i];
    const ok = await confirmDialog(
      'This only removes it from the plan, not from your transaction history.',
      `Remove ${leg.action} ${leg.shares} ${leg.ticker} from this plan?`,
    );
    if (!ok) return;
    updateTradePlan(plan.id, { legs: plan.legs.filter((_, idx) => idx !== i) });
  };
  const markDone = async (i: number) => {
    const leg = plan.legs[i];
    const ok = await confirmDialog(
      `Add ${leg.action} ${fmt(leg.shares, 0)} ${leg.ticker} @ ${fmtPrice(leg.price)} to your transaction history? This can't be undone from here.`,
      'Mark leg as done?',
    );
    if (!ok) return;
    if (!(await ensureSignedIn('Sign in to record this transaction.'))) return;
    executeTradePlanLeg(plan.id, i);
    toast('Logged to transaction history.');
  };

  const doneCount = plan.legs.filter((l) => l.executed).length;
  const totalBuy = plan.legs.reduce((s, l) => s + (l.action === 'BUY' ? l.shares * l.price : 0), 0);
  const totalSell = plan.legs.reduce((s, l) => s + (l.action === 'SELL' ? l.shares * l.price : 0), 0);

  return (
    <div className="card" style={{ marginBottom: 16, padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        {editingMeta ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
            <button className="btn secondary small" onClick={saveMeta}><SaveIcon size={12} />Save</button>
            <button className="btn secondary small" onClick={() => setEditingMeta(false)}>Cancel</button>
          </div>
        ) : (
          <div>
            <strong>{plan.name}</strong>{' '}
            <span className="footer-note">
              {plan.createdAt} · {doneCount}/{plan.legs.length} executed
            </span>
            {plan.notes && <p className="footer-note" style={{ margin: '4px 0 0' }}>{plan.notes}</p>}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          {!editingMeta && (
            <button
              className="btn secondary small"
              onClick={() => {
                setName(plan.name);
                setNotes(plan.notes || '');
                setEditingMeta(true);
              }}
            >
              Edit
            </button>
          )}
          <button
            className="btn secondary small"
            onClick={async () => {
              const ok = await confirmDialog(
                'This deletes the plan itself, not any transactions already logged from it.',
                `Delete plan "${plan.name}"?`,
              );
              if (ok) deleteTradePlan(plan.id);
            }}
          >
            <TrashIcon size={12} />Delete plan
          </button>
        </div>
      </div>

      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Ticker</th><th>Action</th><th>Shares</th><th>Price</th><th>Amount</th><th>Est. fee</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {plan.legs.map((leg, i) =>
              editLegIndex === i && editLeg ? (
                <tr key={i}>
                  <td><input type="date" value={editLeg.date} onChange={(e) => setEditLeg({ ...editLeg, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td><input value={editLeg.ticker} onChange={(e) => setEditLeg({ ...editLeg, ticker: e.target.value.toUpperCase() })} style={{ width: 70 }} /></td>
                  <td>
                    <select value={editLeg.action} onChange={(e) => setEditLeg({ ...editLeg, action: e.target.value as 'BUY' | 'SELL' })}>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </td>
                  <td><input type="number" value={editLeg.shares} onChange={(e) => setEditLeg({ ...editLeg, shares: Number(e.target.value) })} style={{ width: 70 }} /></td>
                  <td><input type="number" step="0.01" value={editLeg.price} onChange={(e) => setEditLeg({ ...editLeg, price: Number(e.target.value) })} style={{ width: 80 }} /></td>
                  <td>{fmtMoney(editLeg.shares * editLeg.price, currency)}</td>
                  <td></td>
                  <td></td>
                  <td>
                    <button className="btn secondary small" onClick={saveLeg}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => setEditLegIndex(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td>{leg.date}</td>
                  <td>{leg.ticker}</td>
                  <td className={leg.action === 'BUY' ? 'pill-buy' : 'pill-sell'}>{leg.action}</td>
                  <td>{fmt(leg.shares, 0)}</td>
                  <td>{fmtPrice(leg.price)}</td>
                  <td>{fmtMoney(leg.shares * leg.price, currency)}</td>
                  <td>{fmtMoney(calcFee(leg.shares * leg.price, leg.action === 'BUY', { shares: leg.shares }), currency)}</td>
                  <td>{leg.executed ? <span className="pill-buy">Executed</span> : <span className="footer-note">Planned</span>}</td>
                  <td>
                    {!leg.executed && (
                      <>
                        <button className="btn secondary small" onClick={() => startEditLeg(i)}>Edit</button>{' '}
                        <button className="btn secondary small" onClick={() => markDone(i)}><CheckIcon size={12} />Mark done</button>{' '}
                        <button className="btn secondary small" onClick={() => removeLeg(i)}><TrashIcon size={12} />Remove</button>
                      </>
                    )}
                  </td>
                </tr>
              ),
            )}
            {!plan.legs.length && (
              <tr><td colSpan={9} className="footer-note">No legs left in this plan.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="footer-note" style={{ marginTop: 8 }}>
        Planned buys {fmtMoney(totalBuy, currency)} · Planned sells {fmtMoney(totalSell, currency)}
      </p>
    </div>
  );
}

export function TradePlannerPage() {
  const tradePlans = usePSXWorkbookStore((s) => s.workbook.tradePlans);
  const sorted = [...tradePlans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <h1 className="pagetitle">PSX Trade Planner</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Sketch out multi-leg trades ahead of time, save as many plans as you like, and mark each leg done —
        once it's actually executed — to log it straight into your transaction history without re-entering it.
      </p>
      <NewPlanForm />
      <h2 style={{ marginTop: 8, marginBottom: 8, fontSize: 16 }}>Saved plans</h2>
      {sorted.length ? sorted.map((p) => <PlanCard key={p.id} plan={p} />) : <p className="footer-note">No trade plans yet.</p>}
    </div>
  );
}
