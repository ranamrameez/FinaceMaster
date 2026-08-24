import { useState } from 'react';
import { PSX_TICKER_DATALIST_ID } from '../../../components/PSXTickerDatalist';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { CheckIcon, PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, TextInput } from '../../../components/ui/Field';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { analyzeTradePlanByTicker, whatIfExit, type TradePlanTickerSummary } from '../../../lib/calc/tradePlanAnalysis';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { TradePlan, TradePlanLeg } from '../../../types/workbook';
import { usePSXDerived } from '../hooks/usePSXDerived';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLeg(defaultTicker = ''): TradePlanLeg {
  return { date: today(), ticker: defaultTicker, action: 'BUY', shares: 0, price: 0 };
}

function NewPlanForm() {
  const addTradePlan = usePSXWorkbookStore((s) => s.addTradePlan);
  const ensureSignedIn = useEnsureSignedIn();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [defaultTicker, setDefaultTicker] = useState('');
  const [legs, setLegs] = useState<TradePlanLeg[]>([emptyLeg()]);

  const update = (i: number, patch: Partial<TradePlanLeg>) =>
    setLegs((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Most plans revolve around one ticker — set it once here and every leg
  // (the initial one, and any added after) pre-fills with it. Only backfills
  // a leg whose ticker is still blank, so a leg the user already typed a
  // different ticker into is never silently overwritten.
  const setDefaultTickerAndBackfill = (value: string) => {
    setDefaultTicker(value);
    setLegs((rs) => rs.map((r) => (r.ticker ? r : { ...r, ticker: value })));
  };

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
      defaultTicker: defaultTicker.trim() ? defaultTicker.trim().toUpperCase() : undefined,
    };
    addTradePlan(plan);
    toast(`Saved plan "${plan.name}" with ${valid.length} leg${valid.length > 1 ? 's' : ''}.`);
    setName('');
    setNotes('');
    setDefaultTicker('');
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
        <Field label="Default ticker (optional)" width={160}>
          <TextInput
            value={defaultTicker}
            onChange={(e) => setDefaultTickerAndBackfill(e.target.value.toUpperCase())}
            list={PSX_TICKER_DATALIST_ID}
            placeholder="e.g. QGTS"
          />
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
        <button className="btn secondary" onClick={() => setLegs((rs) => [...rs, emptyLeg(defaultTicker)])}>
          <PlusIcon />Add leg
        </button>
        <button className="btn" onClick={save}>
          <SaveIcon />Save plan
        </button>
      </div>
    </div>
  );
}

/** "Trade planner plan is like a trade sandbox for testing different trade
 * combos for profitable exit" (user request) — a per-ticker hypothetical
 * exit-price tester. Two scenarios, since "planned" and "everything"
 * answer different questions: exiting just what's left after this plan's
 * own pending sells (`effectiveShares`), vs. exiting the whole position —
 * real holding plus this plan's pending buys — as if the plan's own
 * pending sells never happened, useful for comparing "follow my plan" vs.
 * "close everything at a different price instead." */
function WhatIfExitCalculator({
  tickerAnalysis,
  calcFee,
  currency,
}: {
  tickerAnalysis: TradePlanTickerSummary[];
  calcFee: (amount: number, isBuy: boolean, context?: { shares?: number }) => number;
  currency: string;
}) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  return (
    <div style={{ marginTop: 10 }}>
      <div className="footer-note" style={{ marginBottom: 4 }}>
        What if? Test a hypothetical exit price per ticker.
      </div>
      {tickerAnalysis.map((t) => {
        const price = prices[t.ticker] || 0;
        const fullShares = t.effectiveShares + t.plannedSold;
        const remaining = whatIfExit(t.effectiveShares, t.avgCost, price, calcFee);
        const full = whatIfExit(fullShares, t.avgCost, price, calcFee);
        return (
          <div key={t.ticker} className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 6 }}>
            <Field label={`${t.ticker} exit price`} width={110}>
              <TextInput
                type="number"
                step="0.01"
                value={price || ''}
                onChange={(e) => setPrices((p) => ({ ...p, [t.ticker]: Number(e.target.value) }))}
              />
            </Field>
            {price > 0 && (
              <div className="footer-note">
                Remaining ({fmt(t.effectiveShares, 0)} sh): {fmtMoney(remaining.proceeds, currency)} proceeds ·{' '}
                <span className={remaining.pl >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(remaining.pl, currency)}</span> P/L
                {t.plannedSold > 0 && (
                  <>
                    {' '}· Full position, ignoring planned sells ({fmt(fullShares, 0)} sh):{' '}
                    {fmtMoney(full.proceeds, currency)} proceeds ·{' '}
                    <span className={full.pl >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(full.pl, currency)}</span> P/L
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanCard({ plan }: { plan: TradePlan }) {
  const updateTradePlan = usePSXWorkbookStore((s) => s.updateTradePlan);
  const deleteTradePlan = usePSXWorkbookStore((s) => s.deleteTradePlan);
  const executeTradePlanLeg = usePSXWorkbookStore((s) => s.executeTradePlanLeg);
  const ensureSignedIn = useEnsureSignedIn();
  const { workbook, calcFee, rows } = usePSXDerived();
  const currency = workbook.settings.currency;
  const tickerAnalysis = analyzeTradePlanByTicker(plan.legs, rows, calcFee, workbook.settings.feePct, workbook.settings.tick);
  type AnalysisCol = 'ticker' | 'avgCost' | 'breakEven' | 'effectiveShares' | 'realizedPL';
  const analysisSortValue = (t: (typeof tickerAnalysis)[number], col: AnalysisCol): number | string =>
    col === 'ticker' ? t.ticker : t[col];
  const { sorted: sortedTickerAnalysis, Th: AnalysisTh } = useSortableRows(tickerAnalysis, analysisSortValue, 'ticker', 'asc');

  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(plan.name);
  const [notes, setNotes] = useState(plan.notes || '');
  const [defaultTicker, setDefaultTicker] = useState(plan.defaultTicker || '');
  const [editLegIndex, setEditLegIndex] = useState<number | null>(null);
  const [editLeg, setEditLeg] = useState<TradePlanLeg | null>(null);
  const [addingLeg, setAddingLeg] = useState<TradePlanLeg | null>(null);
  // Collapsed by default — user request: once you have a handful of saved
  // plans, having every one of them fully expanded on load is overwhelming;
  // expand the ones you're actually working on.
  const [collapsed, setCollapsed] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const addLeg = () => {
    if (!addingLeg || !addingLeg.ticker || !addingLeg.shares || !addingLeg.price) {
      return toast('Fill in ticker, shares, and price first.');
    }
    updateTradePlan(plan.id, { legs: [...plan.legs, { ...addingLeg, ticker: addingLeg.ticker.toUpperCase() }] });
    toast('Leg added to plan.');
    setAddingLeg(null);
  };

  const saveMeta = () => {
    updateTradePlan(plan.id, {
      name: name.trim() || plan.name,
      notes: notes.trim() || undefined,
      defaultTicker: defaultTicker.trim() ? defaultTicker.trim().toUpperCase() : undefined,
    });
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

  // Sorting reorders *display* only — every action (edit/remove/mark done)
  // still addresses the leg by its original array index (`originalIndex`),
  // never the sorted position, the same pattern already used by QSE/PSX's
  // per-stock transaction tables.
  type LegRow = { leg: TradePlanLeg; originalIndex: number };
  const legRows: LegRow[] = plan.legs.map((leg, originalIndex) => ({ leg, originalIndex }));
  type LegCol = 'date' | 'ticker' | 'action' | 'shares' | 'price' | 'amount' | 'fee' | 'status';
  const legSortValue = (r: LegRow, col: LegCol): number | string => {
    switch (col) {
      case 'ticker': return r.leg.ticker;
      case 'action': return r.leg.action;
      case 'shares': return r.leg.shares;
      case 'price': return r.leg.price;
      case 'amount': return r.leg.shares * r.leg.price;
      case 'fee': return calcFee(r.leg.shares * r.leg.price, r.leg.action === 'BUY', { shares: r.leg.shares });
      case 'status': return r.leg.executed ? 1 : 0;
      default: return r.leg.date || '';
    }
  };
  const { sorted: sortedLegRows, Th: LegTh } = useSortableRows(legRows, legSortValue, 'date', 'asc');

  return (
    <>
      {fullscreen && <div className="modal-overlay show" style={{ zIndex: 999 }} />}
      <div
        className="card"
        style={
          fullscreen
            ? { position: 'fixed', inset: 12, zIndex: 1000, overflow: 'auto', padding: 16, boxShadow: '0 8px 40px rgba(0,0,0,.4)' }
            : { marginBottom: 28, padding: 12 }
        }
      >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        {editingMeta ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
            <TextInput
              value={defaultTicker}
              onChange={(e) => setDefaultTicker(e.target.value.toUpperCase())}
              list={PSX_TICKER_DATALIST_ID}
              placeholder="Default ticker"
              style={{ width: 130 }}
            />
            <button className="btn secondary small" onClick={saveMeta}><SaveIcon size={12} />Save</button>
            <button className="btn secondary small" onClick={() => setEditingMeta(false)}>Cancel</button>
          </div>
        ) : (
          <div>
            <strong>{plan.name}</strong>{' '}
            <span className="footer-note">
              {plan.createdAt} · {doneCount}/{plan.legs.length} executed
              {plan.defaultTicker && <> · default ticker {plan.defaultTicker}</>}
            </span>
            {plan.notes && <p className="footer-note" style={{ margin: '4px 0 0' }}>{plan.notes}</p>}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          {!fullscreen && (
            <button className="btn secondary small" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          )}
          <button
            className="btn secondary small"
            onClick={() => {
              setFullscreen((f) => !f);
              if (!fullscreen) setCollapsed(false);
            }}
          >
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
          {!editingMeta && (
            <button
              className="btn secondary small"
              onClick={() => {
                setName(plan.name);
                setNotes(plan.notes || '');
                setDefaultTicker(plan.defaultTicker || '');
                setEditingMeta(true);
              }}
            >
              Edit
            </button>
          )}
          {plan.legs.length > 0 && (
            <button
              className="btn secondary small"
              title="Removes every leg from this plan so you can start fresh — keeps the plan's name, notes, and default ticker. Does not touch any transactions already logged from marking a leg done."
              onClick={async () => {
                const ok = await confirmDialog(
                  'This removes every leg from the plan for a fresh start — the plan itself, its name/notes, and any transactions already logged from marking a leg done are untouched.',
                  `Clear all legs from "${plan.name}"?`,
                );
                if (ok) updateTradePlan(plan.id, { legs: [] });
              }}
            >
              Clear plan
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

      {(!collapsed || fullscreen) && (
      <>
      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <LegTh col="date">Date</LegTh><LegTh col="ticker">Ticker</LegTh><LegTh col="action">Action</LegTh>
              <LegTh col="shares">Shares</LegTh><LegTh col="price">Price</LegTh><LegTh col="amount">Amount</LegTh>
              <LegTh col="fee">Est. fee</LegTh><LegTh col="status">Status</LegTh><th></th>
            </tr>
          </thead>
          <tbody>
            {sortedLegRows.map(({ leg, originalIndex: i }) =>
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
            {addingLeg && (
              <tr>
                <td><input type="date" value={addingLeg.date} onChange={(e) => setAddingLeg({ ...addingLeg, date: e.target.value })} style={{ width: 130 }} /></td>
                <td>
                  <input
                    value={addingLeg.ticker}
                    onChange={(e) => setAddingLeg({ ...addingLeg, ticker: e.target.value.toUpperCase() })}
                    list={PSX_TICKER_DATALIST_ID}
                    style={{ width: 70 }}
                  />
                </td>
                <td>
                  <select value={addingLeg.action} onChange={(e) => setAddingLeg({ ...addingLeg, action: e.target.value as 'BUY' | 'SELL' })}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </td>
                <td><input type="number" placeholder="Shares" value={addingLeg.shares || ''} onChange={(e) => setAddingLeg({ ...addingLeg, shares: Number(e.target.value) })} style={{ width: 70 }} /></td>
                <td><input type="number" step="0.01" placeholder="Price" value={addingLeg.price || ''} onChange={(e) => setAddingLeg({ ...addingLeg, price: Number(e.target.value) })} style={{ width: 80 }} /></td>
                <td>{fmtMoney(addingLeg.shares * addingLeg.price, currency)}</td>
                <td></td>
                <td></td>
                <td>
                  <button className="btn secondary small" onClick={addLeg}><SaveIcon size={12} />Add</button>{' '}
                  <button className="btn secondary small" onClick={() => setAddingLeg(null)}>Cancel</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!addingLeg && (
        <button className="btn secondary small" style={{ marginTop: 8 }} onClick={() => setAddingLeg(emptyLeg(plan.defaultTicker))}>
          <PlusIcon size={12} />Add leg
        </button>
      )}

      {tickerAnalysis.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="footer-note" style={{ marginBottom: 4 }}>
            Per-ticker plan analysis — average cost blends this plan's pending buys with any shares you already
            hold; already-executed legs are shown separately and never double-counted into it.
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <AnalysisTh col="ticker">Ticker</AnalysisTh><th>Already executed</th><th>Still planned</th>
                  <AnalysisTh col="avgCost">Avg cost</AnalysisTh><AnalysisTh col="breakEven">Break-even</AnalysisTh>
                  <AnalysisTh col="effectiveShares">Shares after plan</AnalysisTh>
                  <AnalysisTh col="realizedPL">Planned P/L (from pending sells)</AnalysisTh>
                </tr>
              </thead>
              <tbody>
                {sortedTickerAnalysis.map((t) => (
                  <tr key={t.ticker}>
                    <td>{t.ticker}</td>
                    <td className="footer-note">
                      {t.executedBought > 0 && <>+{fmt(t.executedBought, 0)} buy </>}
                      {t.executedSold > 0 && <>-{fmt(t.executedSold, 0)} sell</>}
                      {!t.executedBought && !t.executedSold && '—'}
                    </td>
                    <td className="footer-note">
                      {t.plannedBought > 0 && <>+{fmt(t.plannedBought, 0)} buy </>}
                      {t.plannedSold > 0 && <>-{fmt(t.plannedSold, 0)} sell</>}
                      {!t.plannedBought && !t.plannedSold && '—'}
                    </td>
                    <td>{t.avgCost > 0 ? fmtPrice(t.avgCost) : '—'}</td>
                    <td>{t.breakEven > 0 ? fmtPrice(t.breakEven) : '—'}</td>
                    <td>{fmt(t.effectiveShares, 0)}</td>
                    <td className={t.plannedSold > 0 ? (t.realizedPL >= 0 ? 'pill-buy' : 'pill-sell') : ''}>
                      {t.plannedSold > 0 ? fmtMoney(t.realizedPL, currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <WhatIfExitCalculator tickerAnalysis={tickerAnalysis} calcFee={calcFee} currency={currency} />
        </div>
      )}

      <p className="footer-note" style={{ marginTop: 8 }}>
        Planned buys {fmtMoney(totalBuy, currency)} · Planned sells {fmtMoney(totalSell, currency)}
        {tickerAnalysis.some((t) => t.plannedSold > 0) && (
          <> · Total planned P/L {fmtMoney(tickerAnalysis.reduce((s, t) => s + t.realizedPL, 0), currency)}</>
        )}
      </p>
      </>
      )}
      </div>
    </>
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
