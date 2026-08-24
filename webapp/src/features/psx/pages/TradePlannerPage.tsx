import { Fragment, useState, type ReactNode } from 'react';
import { CollapsibleCard } from '../../../components/Card';
import { PSX_TICKER_DATALIST_ID } from '../../../components/PSXTickerDatalist';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { CheckIcon, PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { Field, TextInput } from '../../../components/ui/Field';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { Notice } from '../../../components/Notice';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { analyzeTradePlanByTicker, whatIfExit, type TradePlanTickerSummary } from '../../../lib/calc/tradePlanAnalysis';
import { feeScenarios, makePSXFeeCalculator } from '../../../lib/calc/psxFees';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { Transaction, TradePlan, TradePlanLeg } from '../../../types/workbook';
import { usePSXDerived } from '../hooks/usePSXDerived';

const today = () => new Date().toISOString().slice(0, 10);

function NewPlanForm() {
  const addTradePlan = usePSXWorkbookStore((s) => s.addTradePlan);
  const ensureSignedIn = useEnsureSignedIn();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  // User-reported: a plan is really meant for one ticker — "1 ticker may
  // have plans but not vice versa." Simplified from an optional
  // "default ticker" (a soft convenience that legs could still override)
  // into a required, plan-level Ticker: every leg belongs to it, and the
  // per-leg ticker input is gone entirely — one less field to fill in per
  // row, and no way to end up with a mixed-ticker plan going forward.
  const [ticker, setTicker] = useState('');

  const [legs, setLegs] = useState<Omit<TradePlanLeg, 'ticker'>[]>([{ date: today(), action: 'BUY', shares: 0, price: 0 }]);

  const update = (i: number, patch: Partial<TradePlanLeg>) =>
    setLegs((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const valid = legs.filter((l) => l.shares > 0 && l.price > 0);
    if (!name.trim()) return toast('Give this plan a name.');
    if (!ticker.trim()) return toast('Pick a ticker for this plan.');
    if (!valid.length) return toast('Add at least one complete leg (shares, price).');
    if (!(await ensureSignedIn('Sign in to save trade plans.'))) return;
    const tickerUpper = ticker.trim().toUpperCase();
    const plan: TradePlan = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: today(),
      notes: notes.trim() || undefined,
      legs: valid.map((l) => ({ ...l, ticker: tickerUpper })),
      defaultTicker: tickerUpper,
    };
    addTradePlan(plan);
    toast(`Saved plan "${plan.name}" with ${valid.length} leg${valid.length > 1 ? 's' : ''}.`);
    setName('');
    setNotes('');
    setTicker('');
    setLegs([{ date: today(), action: 'BUY', shares: 0, price: 0 }]);
  };

  return (
    <div className="card" style={{ padding: 12, marginBottom: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Field label="Plan name" width={220}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 OGDC rotation" />
        </Field>
        <Field label="Notes (optional)" width={320}>
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Ticker" width={160} title="Every leg in this plan is for this one ticker — a plan is scoped to a single stock, though a stock can have several plans.">
          <TextInput
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            list={PSX_TICKER_DATALIST_ID}
            placeholder="e.g. QGTS"
          />
        </Field>
      </div>
      {legs.map((l, i) => (
        <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input type="date" value={l.date} onChange={(e) => update(i, { date: e.target.value })} />
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
        <button className="btn secondary" onClick={() => setLegs((rs) => [...rs, { date: today(), action: 'BUY', shares: 0, price: 0 }])}>
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

  // Fee estimates for legs still pending need to know about this plan's
  // OTHER pending legs (and any real same-day transaction) to apply PSX's
  // same-day commission-netting rule correctly — the plain `calcFee` above
  // only sees real, already-logged transactions, so a plan with e.g. a
  // same-day BUY and SELL of the same ticker would otherwise charge full
  // commission on both legs instead of netting the smaller side (README
  // item 5). Built once per render from every not-yet-executed leg in this
  // plan, layered on top of the real transaction list.
  const pendingLegTxs: Transaction[] = plan.legs
    .filter((l) => !l.executed)
    .map((l) => ({ date: l.date || today(), ticker: l.ticker, action: l.action, shares: l.shares, price: l.price }));
  const planFeeCalc = makePSXFeeCalculator(workbook.settings, [...workbook.transactions, ...pendingLegTxs]);
  const calcLegFee = (leg: TradePlanLeg) =>
    planFeeCalc(leg.shares * leg.price, leg.action === 'BUY', {
      shares: leg.shares,
      tx: { date: leg.date || today(), ticker: leg.ticker, action: leg.action, shares: leg.shares, price: leg.price },
    });
  // An executed leg already created a real Transaction — its fee should
  // come from that transaction's own live data (and the real calcFee,
  // which already sees every real same-day transaction), resolved by the
  // stable link `executeTradePlanLeg` stores. Falls back to the leg's own
  // frozen snapshot when there's no link yet (legs executed before this
  // link existed) or the linked transaction was deleted.
  const resolveExecutedTx = (leg: TradePlanLeg): Transaction | null =>
    leg.executedTransactionId ? (workbook.transactions.find((t) => t.id === leg.executedTransactionId) ?? null) : null;
  const legFee = (leg: TradePlanLeg): number => {
    if (leg.executed) {
      const tx = resolveExecutedTx(leg);
      if (tx) return calcFee(tx.shares * tx.price, tx.action === 'BUY', { shares: tx.shares, tx });
    }
    return calcLegFee(leg);
  };
  // README item 53: a pending leg was always priced under one guessed
  // scenario — full commission unless another leg already in *this* plan
  // happened to pair with it same-day — hiding the cheaper same-day-netted
  // price exactly when seeing it could change how the user times the trade.
  // Shown alongside (not instead of) `legFee`'s automatic best-guess.
  const legFeeScenarios = (leg: TradePlanLeg) => feeScenarios(leg.shares * leg.price, leg.action === 'BUY', leg.shares, workbook.settings);

  // Item 52 (user-reported bug): an executed leg's displayed values already
  // resolve from its LIVE linked transaction (see `resolveExecutedTx`
  // above) — but a leg executed before that link existed (or whose link
  // target got deleted) has nothing to resolve, and silently falls back to
  // its own frozen snapshot with only a small "*" marker as a clue. Rather
  // than guess a fuzzy match automatically (risking linking the WRONG
  // transaction), let the user pick the right one themselves.
  const updateTransaction = usePSXWorkbookStore((s) => s.updateTransaction);
  const [linkingLegIndex, setLinkingLegIndex] = useState<number | null>(null);
  const [linkChoice, setLinkChoice] = useState('');
  const candidateTxsFor = (ticker: string): Transaction[] =>
    workbook.transactions.filter((t) => t.ticker === ticker && t.id);
  const confirmLink = (i: number) => {
    if (!linkChoice) return;
    updateTradePlan(plan.id, { legs: plan.legs.map((l, idx) => (idx === i ? { ...l, executedTransactionId: linkChoice } : l)) });
    toast('Linked to that transaction — its live data will show here from now on.');
    setLinkingLegIndex(null);
    setLinkChoice('');
  };

  // Item 52's other ask: editing the linked transaction shouldn't require
  // leaving the Trade Planner at all. `updateTransaction` is index-based
  // (a QSE/PSX-wide convention — see CLAUDE.md), so look up the transaction's
  // current array position by its stable id right before saving, rather than
  // capturing an index up front that could go stale if the list changes
  // while this row is being edited.
  const [editingTxLegIndex, setEditingTxLegIndex] = useState<number | null>(null);
  const [editTxRow, setEditTxRow] = useState<Transaction | null>(null);
  const startEditTx = (i: number, tx: Transaction) => {
    setEditingTxLegIndex(i);
    setEditTxRow({ ...tx });
  };
  const saveEditTx = () => {
    if (editingTxLegIndex === null || !editTxRow) return;
    const idx = workbook.transactions.findIndex((t) => t.id === editTxRow.id);
    if (idx < 0) {
      toast('Could not find that transaction — it may have been deleted.');
      return;
    }
    updateTransaction(idx, editTxRow);
    toast('Transaction updated.');
    setEditingTxLegIndex(null);
    setEditTxRow(null);
  };

  const tickerAnalysis = analyzeTradePlanByTicker(plan.legs, rows, calcFee, workbook.settings.feePct, workbook.settings.tick, calcLegFee);
  type AnalysisCol = 'ticker' | 'avgCost' | 'breakEven' | 'effectiveShares' | 'realizedPL';
  const analysisSortValue = (t: (typeof tickerAnalysis)[number], col: AnalysisCol): number | string =>
    col === 'ticker' ? t.ticker : t[col];
  const { sorted: sortedTickerAnalysis, Th: AnalysisTh } = useSortableRows(tickerAnalysis, analysisSortValue, 'ticker', 'asc');

  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(plan.name);
  const [notes, setNotes] = useState(plan.notes || '');
  // Plan-level ticker (user-reported: a plan is meant for a single ticker
  // — "1 ticker may have plans but not vice versa"). Legacy plans without
  // one (or, rarer, an old plan whose legs actually had mixed tickers
  // before this constraint existed) fall back to the first leg's ticker
  // so the field always shows something sensible to fix rather than a
  // blank required field.
  const [planTicker, setPlanTicker] = useState(plan.defaultTicker || plan.legs[0]?.ticker || '');
  const [editLegIndex, setEditLegIndex] = useState<number | null>(null);
  const [editLeg, setEditLeg] = useState<TradePlanLeg | null>(null);
  const [addingLeg, setAddingLeg] = useState<Omit<TradePlanLeg, 'ticker'> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const addLeg = () => {
    if (!addingLeg || !addingLeg.shares || !addingLeg.price) {
      return toast('Fill in shares and price first.');
    }
    updateTradePlan(plan.id, { legs: [...plan.legs, { ...addingLeg, ticker: plan.defaultTicker || planTicker }] });
    toast('Leg added to plan.');
    setAddingLeg(null);
  };

  const saveMeta = () => {
    const tickerUpper = planTicker.trim().toUpperCase();
    if (!tickerUpper) return toast('This plan needs a ticker.');
    updateTradePlan(plan.id, {
      name: name.trim() || plan.name,
      notes: notes.trim() || undefined,
      defaultTicker: tickerUpper,
      // Changing the plan's ticker re-tickers every still-pending leg too —
      // a plan can only ever have one ticker now, so there's no valid state
      // where they'd disagree. Executed legs are left alone: they already
      // created their own real Transaction with its own ticker, and
      // rewriting the leg's snapshot afterward wouldn't change that.
      legs: plan.legs.map((l) => (l.executed ? l : { ...l, ticker: tickerUpper })),
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

  // For an executed leg, "current" values come from its linked transaction
  // (live) rather than the leg's own frozen-at-execution snapshot — kept
  // consistent everywhere a leg's shares/price feed into a total or a sort,
  // not just the row display, so nothing derived here goes stale relative
  // to an edit made in the Transactions page.
  const resolvedLegValues = (leg: TradePlanLeg): { date: string; ticker: string; action: 'BUY' | 'SELL'; shares: number; price: number } => {
    const tx = leg.executed ? resolveExecutedTx(leg) : null;
    if (tx) return tx;
    return { date: leg.date || today(), ticker: leg.ticker, action: leg.action, shares: leg.shares, price: leg.price };
  };

  const doneCount = plan.legs.filter((l) => l.executed).length;
  const totalBuy = plan.legs.reduce((s, l) => {
    const v = resolvedLegValues(l);
    return s + (v.action === 'BUY' ? v.shares * v.price : 0);
  }, 0);
  const totalSell = plan.legs.reduce((s, l) => {
    const v = resolvedLegValues(l);
    return s + (v.action === 'SELL' ? v.shares * v.price : 0);
  }, 0);

  // Sorting reorders *display* only — every action (edit/remove/mark done)
  // still addresses the leg by its original array index (`originalIndex`),
  // never the sorted position, the same pattern already used by QSE/PSX's
  // per-stock transaction tables.
  type LegRow = { leg: TradePlanLeg; originalIndex: number };
  const legRows: LegRow[] = plan.legs.map((leg, originalIndex) => ({ leg, originalIndex }));
  type LegCol = 'date' | 'ticker' | 'action' | 'shares' | 'price' | 'amount' | 'fee' | 'status';
  const legSortValue = (r: LegRow, col: LegCol): number | string => {
    const v = resolvedLegValues(r.leg);
    switch (col) {
      case 'ticker': return v.ticker;
      case 'action': return v.action;
      case 'shares': return v.shares;
      case 'price': return v.price;
      case 'amount': return v.shares * v.price;
      case 'fee': return legFee(r.leg);
      case 'status': return r.leg.executed ? 1 : 0;
      default: return v.date || '';
    }
  };
  const { sorted: sortedLegRows, Th: LegTh } = useSortableRows(legRows, legSortValue, 'date', 'asc');

  // The card's header (name/meta or the rename form) doubles as the
  // accordion trigger when not in full-screen mode — user-reported: a
  // separate "Expand"/"Collapse" button next to a header that visually
  // looked clickable but wasn't good UX. Wrapping the rename form in
  // its own stopPropagation guards against a Save/Cancel click also
  // toggling the accordion (harmless no-op in the full-screen branch below,
  // which has no accordion to stop propagation from).
  const titleBlock: ReactNode = editingMeta ? (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
      <TextInput
        value={planTicker}
        onChange={(e) => setPlanTicker(e.target.value.toUpperCase())}
        list={PSX_TICKER_DATALIST_ID}
        placeholder="Ticker"
        style={{ width: 100 }}
      />
      <button className="btn secondary small" onClick={saveMeta}><SaveIcon size={12} />Save</button>
      <button className="btn secondary small" onClick={() => setEditingMeta(false)}>Cancel</button>
    </div>
  ) : (
    <div>
      <strong>{plan.name}</strong>{' '}
      {(plan.defaultTicker || plan.legs[0]?.ticker) && (
        <span className="pill pill-info">{plan.defaultTicker || plan.legs[0]?.ticker}</span>
      )}{' '}
      <span className="footer-note">
        {plan.createdAt} · {doneCount}/{plan.legs.length} executed
      </span>
      {plan.notes && <p className="footer-note" style={{ margin: '4px 0 0' }}>{plan.notes}</p>}
    </div>
  );

  // Right-aligned action buttons — user-reported: buttons used to sit in
  // their own row that could wrap awkwardly next to the title instead of
  // staying pinned to the right edge. `CollapsibleCard`'s `headerExtra`
  // slot already handles that alignment (and already stops propagation so
  // these clicks never also toggle the accordion); `justifyContent:
  // 'flex-end'` keeps the buttons right-aligned even if they wrap.
  const actionButtons = (onFullScreenClick: () => void, fullScreenLabel: string): ReactNode => (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <button className="btn secondary small" onClick={onFullScreenClick}>{fullScreenLabel}</button>
      {!editingMeta && (
        <button
          className="btn secondary small"
          onClick={() => {
            setName(plan.name);
            setNotes(plan.notes || '');
            setPlanTicker(plan.defaultTicker || plan.legs[0]?.ticker || '');
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
  );

  const bodyContent = (
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
            {sortedLegRows.map(({ leg, originalIndex: i }) => {
              if (editLegIndex === i && editLeg) return (
                <tr key={i}>
                  <td><input type="date" value={editLeg.date} onChange={(e) => setEditLeg({ ...editLeg, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td>{editLeg.ticker}</td>
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
              );

              // Editing the LINKED transaction directly (item 52: "should be
              // editable from here") — right-here inline, no trip to the
              // Transactions page required.
              if (editingTxLegIndex === i && editTxRow) return (
                <tr key={i}>
                  <td><input type="date" value={editTxRow.date} onChange={(e) => setEditTxRow({ ...editTxRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td>{editTxRow.ticker}</td>
                  <td>
                    <select value={editTxRow.action} onChange={(e) => setEditTxRow({ ...editTxRow, action: e.target.value as 'BUY' | 'SELL' })}>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </td>
                  <td><input type="number" value={editTxRow.shares} onChange={(e) => setEditTxRow({ ...editTxRow, shares: Number(e.target.value) })} style={{ width: 70 }} /></td>
                  <td><input type="number" step="0.01" value={editTxRow.price} onChange={(e) => setEditTxRow({ ...editTxRow, price: Number(e.target.value) })} style={{ width: 80 }} /></td>
                  <td>{fmtMoney(editTxRow.shares * editTxRow.price, currency)}</td>
                  <td>{fmtMoney(calcFee(editTxRow.shares * editTxRow.price, editTxRow.action === 'BUY', { shares: editTxRow.shares, tx: editTxRow }), currency)}</td>
                  <td><span className="pill-buy">Executed</span></td>
                  <td>
                    <button className="btn secondary small" onClick={saveEditTx}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => { setEditingTxLegIndex(null); setEditTxRow(null); }}>Cancel</button>
                  </td>
                </tr>
              );

              // For an executed leg, show the LINKED transaction's live
              // data (date/shares/price) so an edit made afterward in the
              // Transactions page or per-stock page is reflected here too,
              // instead of the leg's own frozen-at-execution snapshot
              // going stale (README bug report: "plan and transactions
              // are not synced"). Falls back to the leg's own snapshot
              // when there's no link (executed before this fix existed)
              // or the linked transaction was deleted — that's now a
              // visible, fixable state (see the "Link…" row below) rather
              // than a barely-noticeable asterisk.
              const linkedTx = leg.executed ? resolveExecutedTx(leg) : null;
              const display = linkedTx ?? leg;
              const stale = leg.executed && !linkedTx;
              const scenarios = !leg.executed ? legFeeScenarios(leg) : null;
              return (
                <Fragment key={i}>
                  <tr>
                    <td>{display.date}{stale && (
                      <Tooltip text="No linked transaction found — showing the plan's original snapshot from when this was marked done. Use Link below to fix this.">
                        <span style={{ cursor: 'pointer', color: 'var(--warn)' }}> ⚠</span>
                      </Tooltip>
                    )}</td>
                    <td>{display.ticker}</td>
                    <td className={display.action === 'BUY' ? 'pill-buy' : 'pill-sell'}>{display.action}</td>
                    <td>{fmt(display.shares, 0)}</td>
                    <td>{fmtPrice(display.price)}</td>
                    <td>{fmtMoney(display.shares * display.price, currency)}</td>
                    <td>
                      {fmtMoney(legFee(leg), currency)}
                      {scenarios && (
                        <Tooltip text="Shown regardless of what else is in this plan — a lone leg is priced at full commission unless it actually pairs with an opposite same-day trade.">
                          <div className="footer-note" style={{ cursor: 'pointer' }}>
                            Full {fmtMoney(scenarios.full, currency)} · Same-day netted {fmtMoney(scenarios.netted, currency)}
                          </div>
                        </Tooltip>
                      )}
                    </td>
                    <td>
                      {leg.executed ? (
                        linkedTx ? (
                          <Tooltip text="Synced with its transaction — edit it below or from the Transactions page.">
                            <span className="pill-buy" style={{ cursor: 'pointer' }}>Executed</span>
                          </Tooltip>
                        ) : (
                          <span className="pill-sell">Executed (unlinked)</span>
                        )
                      ) : (
                        <span className="footer-note">Planned</span>
                      )}
                    </td>
                    <td>
                      {!leg.executed && (
                        <>
                          <button className="btn secondary small" onClick={() => startEditLeg(i)}>Edit</button>{' '}
                          <button className="btn secondary small" onClick={() => markDone(i)}><CheckIcon size={12} />Mark done</button>{' '}
                          <button className="btn secondary small" onClick={() => removeLeg(i)}><TrashIcon size={12} />Remove</button>
                        </>
                      )}
                      {leg.executed && linkedTx && (
                        <button className="btn secondary small" onClick={() => startEditTx(i, linkedTx)}>Edit</button>
                      )}
                      {stale && (
                        <button className="btn secondary small" onClick={() => setLinkingLegIndex(linkingLegIndex === i ? null : i)}>
                          Link…
                        </button>
                      )}
                    </td>
                  </tr>
                  {linkingLegIndex === i && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <Notice tone="warning" style={{ margin: '4px 0' }}>
                          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>Pick the transaction this leg actually corresponds to:</span>
                            <select value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
                              <option value="">— Select a transaction —</option>
                              {candidateTxsFor(leg.ticker).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.date} · {t.action} {fmt(t.shares, 0)} @ {fmtPrice(t.price)}
                                </option>
                              ))}
                            </select>
                            <button className="btn secondary small" disabled={!linkChoice} onClick={() => confirmLink(i)}>Confirm link</button>
                            <button className="btn secondary small" onClick={() => { setLinkingLegIndex(null); setLinkChoice(''); }}>Cancel</button>
                          </div>
                        </Notice>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!plan.legs.length && (
              <tr><td colSpan={9} className="footer-note">No legs left in this plan.</td></tr>
            )}
            {addingLeg && (
              <tr>
                <td><input type="date" value={addingLeg.date} onChange={(e) => setAddingLeg({ ...addingLeg, date: e.target.value })} style={{ width: 130 }} /></td>
                <td>{plan.defaultTicker || planTicker}</td>
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
        <button className="btn secondary small" style={{ marginTop: 8 }} onClick={() => setAddingLeg({ date: today(), action: 'BUY', shares: 0, price: 0 })}>
          <PlusIcon size={12} />Add leg
        </button>
      )}

      {tickerAnalysis.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="footer-note" style={{ marginBottom: 4 }}>
            Per-ticker plan analysis — average cost blends this plan's pending buys with any shares you already
            hold; already-executed legs are shown separately and never double-counted into it.
          </div>
          {/* User-reported (item 53): this summary was easy to miss, buried
           * below the heavier leg-editing table above. A row of colored
           * cards — one per ticker, key figures only — gives an at-a-glance
           * read before the detailed table underneath. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 8, marginBottom: 12 }}>
            {sortedTickerAnalysis.map((t, idx) => (
              <div key={t.ticker} className="card stat-card" style={hueStyle(HUES[idx % HUES.length])}>
                <div className="label">{t.ticker}</div>
                <div className="value" style={{ fontSize: 15 }}>
                  {t.avgCost > 0 ? `Avg ${fmtPrice(t.avgCost)}` : 'No avg cost'}
                </div>
                <div className="sub">
                  BE {t.breakEven > 0 ? fmtPrice(t.breakEven) : '—'} · {fmt(t.effectiveShares, 0)} sh after plan
                  {t.plannedSold > 0 && (
                    <> · <span className={t.realizedPL >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(t.realizedPL, currency)} P/L</span></>
                  )}
                </div>
              </div>
            ))}
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
  );

  return (
    <>
      {fullscreen && <div className="modal-overlay show" style={{ zIndex: 999 }} />}
      {fullscreen ? (
        <div className="card" style={{ position: 'fixed', inset: 12, zIndex: 1000, overflow: 'auto', padding: 16, boxShadow: '0 8px 40px rgba(0,0,0,.4)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            {titleBlock}
            {actionButtons(() => setFullscreen(false), 'Exit full screen')}
          </div>
          {bodyContent}
        </div>
      ) : (
        <CollapsibleCard
          title={titleBlock}
          headerExtra={actionButtons(() => setFullscreen(true), 'Full screen')}
          defaultOpen={false}
          style={{ marginBottom: 28, padding: 12 }}
        >
          {bodyContent}
        </CollapsibleCard>
      )}
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
