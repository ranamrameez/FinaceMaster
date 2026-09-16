import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CollapsibleCard } from '../../../components/Card';
import { TickerLogo } from '../../../components/TickerLogo';
import { PSX_TICKER_DATALIST_ID } from '../../../components/PSXTickerDatalist';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { CheckIcon, CollapseIcon, EditIcon, ExpandIcon, InfoIcon, PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { Notice } from '../../../components/Notice';
import { Modal } from '../../../components/Modal';
import { StatSourceBadge } from '../../../components/StatSourceBadge';
import { usePageFabActions } from '../../../hooks/usePageFabActions';
import { Field, TextInput } from '../../../components/ui/Field';
import { FeeModeControl, feeModeFor } from '../../../components/ui/FeeModeControl';
import { IconButton } from '../../../components/ui/IconButton';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { analyzeTradePlanByTicker, whatIfExit, type TradePlanTickerSummary } from '../../../lib/calc/tradePlanAnalysis';
import { breakEvenPrice } from '../../../lib/calc/fees';
import { getMarketPrice } from '../../../lib/calc/priceHistory';
import { feeScenarios, makePSXFeeCalculator } from '../../../lib/calc/psxFees';
import { computeFIFOPositions } from '../../../lib/calc/fifoPositions';
import { computeAveragingScenario } from '../../../lib/calc/riskAnalysis';
import {
  computeLotAdvice,
  findMissedOpportunity,
  perShareCommission,
  sellableShareSummary,
  type LotAdvice,
} from '../../../lib/calc/partialTradeStrategy';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useAuthState } from '../../../lib/firebase/useAuthState';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { Transaction, TradePlan, TradePlanLeg } from '../../../types/workbook';
import { usePSXDerived } from '../hooks/usePSXDerived';
import { usePSXStockData } from '../hooks/usePSXStockData';
import { gridAutoStyle } from '../../../lib/gridStyle';

const today = () => new Date().toISOString().slice(0, 10);

/** User-reported (2026-09-16): "a duplicate entry was added as OGDC" — see
 * the identical helper/comment in QSE's TradeStrategyPage.tsx. */
function isKnownTicker(ticker: string, tickerNames: Record<string, string>, transactions: Transaction[]): boolean {
  return ticker in tickerNames || transactions.some((t) => t.ticker === ticker);
}

/** Section 1 — "Buy/Sell & Avg Down," one calculator instead of two
 * strategies on two different pages (user's own confirmed merge:
 * "Unify as tabs on one page" — this uses a toggle, matching the cleanest
 * of the design-reference mockups, `trade_risk_workstation_manual_entry_
 * optimized/screen.png`, rather than tabs). Base fields (Buy price/
 * Shares/optional Target sell price) always model THIS hypothetical trade
 * alone; the "Average down" toggle (only enabled once the typed ticker is
 * a real held position) switches to blending it with the real position
 * instead — reuses `riskAnalysis.ts`'s already-tested
 * `computeAveragingScenario`, fed `add = shares * price` so its own
 * capital-driven `floor(add/currentPrice)` recovers exactly the shares
 * count this form's own user typed, rather than re-deriving the same
 * averaging formula a second time. */
function BuySellAvgDownCalculator() {
  const { workbook, calcFee, rows } = usePSXDerived();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;

  const [ticker, setTicker] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [shares, setShares] = useState('');
  const [targetSell, setTargetSell] = useState('');
  const [avgDown, setAvgDown] = useState(false);

  const held = rows.find((r) => r.ticker === ticker.trim().toUpperCase());
  const canAvgDown = !!held && held.shares > 0;

  const price = Number(buyPrice) || 0;
  const shareCount = Number(shares) || 0;
  const target = Number(targetSell) || 0;

  // User's own ask: "show the buy & sell commission/1 share if traded at
  // current price for a quick decision if the user should dive in the
  // dip" — independent of the rest of this form, as soon as a price is
  // typed.
  const perShare = price > 0 ? perShareCommission(price, calcFee) : null;

  const simpleCost = shareCount * price;
  const simpleFee = shareCount > 0 && price > 0 ? calcFee(simpleCost, true, { shares: shareCount }) : 0;
  const simpleBreakEven =
    shareCount > 0 && price > 0 ? breakEvenPrice(simpleCost + simpleFee, shareCount, feePct, tick, calcFee) : 0;
  const simpleTargetPL =
    shareCount > 0 && target > 0 ? whatIfExit(shareCount, (simpleCost + simpleFee) / shareCount, target, calcFee).pl : null;

  const scenario =
    avgDown && canAvgDown && shareCount > 0 && price > 0
      ? computeAveragingScenario(
          shareCount * price,
          price,
          held!.shares,
          held!.invested / held!.shares,
          target || price,
          feePct,
          tick,
          calcFee,
        )
      : null;

  return (
    <div className="card" style={{ padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Buy/Sell &amp; Avg Down</h3>
      <div className="row gap-sm mb-sm">
        <Field label="Ticker" width={140}>
          <TextInput value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} list={PSX_TICKER_DATALIST_ID} placeholder="e.g. OGDC" />
        </Field>
        <Field label="Buy price" width={110}>
          <TextInput type="number" step="0.01" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
        </Field>
        <Field label="Shares" width={100}>
          <TextInput type="number" value={shares} onChange={(e) => setShares(e.target.value)} />
        </Field>
        <Field label="Target sell price (optional)" width={150}>
          <TextInput type="number" step="0.01" value={targetSell} onChange={(e) => setTargetSell(e.target.value)} />
        </Field>
        <Field label=" " width={130}>
          <Tooltip text={canAvgDown ? 'Blend this purchase with what you already hold, instead of modeling it alone.' : 'Averaging down needs an existing position in this ticker.'}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30 }}>
              <input type="checkbox" checked={avgDown} disabled={!canAvgDown} onChange={(e) => setAvgDown(e.target.checked)} />
              Average down
            </label>
          </Tooltip>
        </Field>
      </div>

      {perShare && (
        <p className="text-muted mb-sm">
          Commission per share @ {fmtPrice(price)}: Buy {fmtMoney(perShare.buy, currency)} · Sell {fmtMoney(perShare.sell, currency)}
        </p>
      )}

      {avgDown && (
        <Notice tone="warning" className="mb-sm">
          Averaging down increases your exposure to a losing position — it lowers your break-even, but only by
          committing more capital to a stock that's currently down. <Link to="/legal">Read more</Link>
        </Notice>
      )}

      {!avgDown && shareCount > 0 && price > 0 && (
        <div className="grid-auto" style={gridAutoStyle(160, 8)}>
          <div className="card stat-card"><div className="label">Cost</div><div className="value">{fmtMoney(simpleCost + simpleFee, currency)}</div></div>
          <div className="card stat-card"><div className="label">Break-even</div><div className="value">{fmtPrice(simpleBreakEven)}</div></div>
          {simpleTargetPL !== null && (
            <div className="card stat-card">
              <div className="label">P/L @ target</div>
              <div className={`value ${simpleTargetPL >= 0 ? 'pill-positive' : 'pill-negative'}`}>{fmtMoney(simpleTargetPL, currency)}</div>
            </div>
          )}
        </div>
      )}

      {avgDown && scenario && (
        <div className="grid-auto" style={gridAutoStyle(160, 8)}>
          <div className="card stat-card"><div className="label">New shares</div><div className="value">{fmt(scenario.newShares, 0)} ({fmt(scenario.newShares - scenario.extraShares, 0)} + {fmt(scenario.extraShares, 0)})</div></div>
          <div className="card stat-card"><div className="label">New avg cost</div><div className="value">{fmtPrice(scenario.newAvg)}</div></div>
          <div className="card stat-card"><div className="label">New break-even</div><div className="value">{fmtPrice(scenario.breakEven)}</div></div>
          <div className="card stat-card"><div className="label">Recovery needed</div><div className="value">{scenario.recoveryNeededPct.toFixed(2)}%</div></div>
          <div className="card stat-card">
            <div className="label">Net @ target</div>
            <div className={`value ${scenario.netAtTarget >= 0 ? 'pill-positive' : 'pill-negative'}`}>{fmtMoney(scenario.netAtTarget, currency)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Partial Trade Strategy — the user's own framing, verbatim: "hold the
 * expensive, sell the cheaper [lots] who fulfil their BE." Deliberately
 * NOT gated behind having a plan (see `TradeStrategyPage`'s standalone
 * use below) — it also renders inside a `PlanCard` for that plan's own
 * ticker, satisfying the "one integrated tool" decision (Trade Planner +
 * Partial Trade are the same section, not siblings). Only renders once a
 * ticker has 2+ open lots and a known current price — a single-lot
 * position is trivially all-or-nothing, nothing to advise on. */
function PartialTradeAdvisor({ ticker, onSellLot }: { ticker: string; onSellLot: (lot: LotAdvice) => void }) {
  const { workbook, calcFee, rows } = usePSXDerived();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;

  // 'lowestCostFirst' (2026-09-13): this page's own advice is meant to
  // concentrate the remaining position in the worst-performing lots —
  // oldest-first FIFO only does that by coincidence, and got it backwards
  // for a real reported case (see `LotMatchOrder`'s own doc comment). PSX's
  // real opt-in `costBasisMethod: 'fifo'` cost-basis display (usePSXDerived)
  // is a completely separate call site, untouched by this.
  const { lotsByTicker } = useMemo(() => computeFIFOPositions(workbook.transactions, calcFee, 'lowestCostFirst'), [workbook.transactions, calcFee]);
  const lots = lotsByTicker[ticker.toUpperCase()] || [];
  const row = rows.find((r) => r.ticker === ticker.toUpperCase());
  const currentPrice = row?.marketPrice || 0;

  // User-reported (2026-09-16): a plan's ticker with zero matching
  // transactions at all (e.g. a mismatched/mistyped ticker string) used to
  // render nothing here, with no explanation — see the identical comment
  // in QSE's TradeStrategyPage.tsx.
  const hasAnyTx = workbook.transactions.some((t) => t.ticker === ticker.toUpperCase());
  if (!hasAnyTx) {
    return (
      <Notice tone="warning" className="mb-sm">
        No transactions found for {ticker.toUpperCase()} yet — check the ticker is spelled exactly like your real
        trades (e.g. a stray space or different casing would cause this).
      </Notice>
    );
  }

  // User-reported (2026-09-13): "IQCD has no view in Partial Trade now
  // while shares 13, still exist." This guard used to require 2+ lots —
  // see the identical comment in QSE's TradeStrategyPage.tsx for why a
  // single remaining lot (which the 2026-09-13 FIFO-matching fix can now
  // legitimately produce) must still show its own status, not a blank
  // page.
  if (!lots.length || currentPrice <= 0) return null;

  const advice = computeLotAdvice(lots, calcFee, currentPrice, feePct, tick);
  const { sellable, total } = sellableShareSummary(advice);
  const missed = findMissedOpportunity(workbook.priceHistory[ticker.toUpperCase()] || [], lots, calcFee);

  return (
    <div style={{ marginBottom: 16 }}>
      {lots.length > 1 && (
        <Notice tone="warning" className="mb-sm">
          Partial Trade Strategy concentrates your remaining position in your worst-performing lots — you keep
          holding whatever doesn't sell. <Link to="/legal">Read more</Link>
        </Notice>
      )}
      {sellable > 0 ? (
        <p className="mb-sm">
          <span className="pill-positive">{fmt(sellable, 0)} of {fmt(total, 0)} shares</span> of {ticker.toUpperCase()} are already profitable at the current price ({fmtPrice(currentPrice)}).
        </p>
      ) : (
        <p className="text-muted mb-sm">No lot of {ticker.toUpperCase()} is profitable at the current price ({fmtPrice(currentPrice)}) yet.</p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Buy date</th><th>Buy price</th><th>Shares</th><th>Cost/share</th><th>Break-even</th><th>Unrealized P/L</th><th>Suggestion</th><th></th></tr>
          </thead>
          <tbody>
            {advice.map((a, i) => (
              <tr key={i}>
                <td>{a.buyDate}</td>
                <td>{fmtPrice(a.buyPrice)}</td>
                <td>{fmt(a.remainingShares, 0)}</td>
                <td>{fmtPrice(a.costPerShare)}</td>
                <td>{fmtPrice(a.breakEven)}</td>
                <td className={a.unrealizedPL >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(a.unrealizedPL, currency)}</td>
                <td><span className={a.suggestion === 'sell' ? 'pill-positive' : 'text-muted'}>{a.suggestion === 'sell' ? 'Sell' : 'Hold'}</span></td>
                <td>{a.suggestion === 'sell' && <button className="btn secondary small" onClick={() => onSellLot(a)}>Sell this lot</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {missed && (
        <Notice tone="info" className="mt-sm">
          <div>In the last 30 days, price reached {fmtPrice(missed.peakPrice)} on {missed.peakDate}:</div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {missed.lots.map((l, i) => (
              <li key={i}>Lot bought {l.buyDate} @ {fmtPrice(l.buyPrice)} would have profited {fmtMoney(l.wouldHaveProfited, currency)}</li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}

/** "What if I exited at price X" — the sandbox part of the trade planner:
 * given a hypothetical exit price, what would selling `shares` (at
 * `avgCost` cost basis) actually net after fees. */
function WhatIfExitCalculator({
  tickerAnalysis,
  calcFee,
  currency,
  currentPrices,
}: {
  tickerAnalysis: TradePlanTickerSummary[];
  calcFee: (amount: number, isBuy: boolean, context?: { shares?: number }) => number;
  currency: string;
  currentPrices: Record<string, number>;
}) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  return (
    <div style={{ marginTop: 10 }}>
      <div className="text-muted" style={{ marginBottom: 4 }}>
        What if? Test a hypothetical exit price per ticker — defaults to the current price above.
      </div>
      {tickerAnalysis.map((t) => {
        const price = prices[t.ticker] ?? currentPrices[t.ticker] ?? 0;
        const fullShares = t.effectiveShares + t.plannedSold;
        const remaining = whatIfExit(t.effectiveShares, t.avgCost, price, calcFee);
        const full = whatIfExit(fullShares, t.avgCost, price, calcFee);
        return (
          <div key={t.ticker} className="row" style={{ gap: 8, alignItems: 'flex-end', marginBottom: 6 }}>
            <Field label={`${t.ticker} exit price`} width={110}>
              <TextInput
                type="number"
                step="0.01"
                value={price || ''}
                onChange={(e) => setPrices((p) => ({ ...p, [t.ticker]: Number(e.target.value) }))}
              />
            </Field>
            {price > 0 && (
              <div className="text-muted">
                Remaining ({fmt(t.effectiveShares, 0)} sh): {fmtMoney(remaining.proceeds, currency)} proceeds ·{' '}
                <span className={remaining.pl >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(remaining.pl, currency)}</span> P/L
                {t.plannedSold > 0 && (
                  <>
                    {' '}· Full position, ignoring planned sells ({fmt(fullShares, 0)} sh):{' '}
                    {fmtMoney(full.proceeds, currency)} proceeds ·{' '}
                    <span className={full.pl >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(full.pl, currency)}</span> P/L
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

/** "Add plan" FAB + popup — user-reported (2026-09-11): "Adding new plan
 * is still a card rather than popup," the same Main/Often/Rare pattern
 * every other module's "add a new entity" flow already uses (Done items
 * 166/170/196). */
function NewPlanFab() {
  const addTradePlan = usePSXWorkbookStore((s) => s.addTradePlan);
  const transactions = usePSXWorkbookStore((s) => s.workbook.transactions);
  const { tickerNames } = usePSXStockData();
  const ensureSignedIn = useEnsureSignedIn();
  const [open, setOpen] = useState(false);
  // Registers into the same grouped FabPanel CalculatorLauncher already
  // renders on every Stock Exchanges route (Trade calculator/Buy-sell
  // stock) instead of a second independent position:fixed button fighting
  // it for the same corner — the exact bug class Done item 239 already
  // fixed once for this same corner.
  usePageFabActions('psx-trade-plan', useMemo(() => [{ label: 'Add plan', icon: <PlusIcon size={18} />, onClick: () => setOpen(true) }], []));
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [ticker, setTicker] = useState('');
  const [legs, setLegs] = useState<Omit<TradePlanLeg, 'ticker'>[]>([{ date: today(), action: 'BUY', shares: 0, price: 0 }]);

  const update = (i: number, patch: Partial<TradePlanLeg>) =>
    setLegs((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const reset = () => {
    setName('');
    setNotes('');
    setTicker('');
    setLegs([{ date: today(), action: 'BUY', shares: 0, price: 0 }]);
  };

  const save = async () => {
    const valid = legs.filter((l) => l.shares > 0 && l.price > 0);
    if (!name.trim()) return toast('Give this plan a name.');
    if (!ticker.trim()) return toast('Pick a ticker for this plan.');
    if (!valid.length) return toast('Add at least one complete leg (shares, price).');
    const tickerUpper = ticker.trim().toUpperCase();
    if (!isKnownTicker(tickerUpper, tickerNames, transactions)) {
      return toast(`"${tickerUpper}" isn't a recognized ticker — pick one from the suggestion list.`);
    }
    if (!(await ensureSignedIn('Sign in to save trade plans.'))) return;
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
    reset();
    setOpen(false);
  };

  return (
    <>
      {open && (
        <Modal title="New trade plan" onClose={() => { reset(); setOpen(false); }}>
          <div className="row gap-sm mb-sm">
            <Field label="Plan name" width={220}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 OGDC rotation" />
            </Field>
            <Field label="Notes (optional)" width={280}>
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Ticker" width={140} title="Every leg in this plan is for this one ticker — a plan is scoped to a single stock, though a stock can have several plans.">
              <TextInput value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} list={PSX_TICKER_DATALIST_ID} placeholder="e.g. QGTS" />
            </Field>
          </div>
          {legs.map((l, i) => (
            <div key={i} className="row gap-sm mb-sm">
              <input type="date" value={l.date} onChange={(e) => update(i, { date: e.target.value })} />
              <select value={l.action} onChange={(e) => update(i, { action: e.target.value as 'BUY' | 'SELL' })}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
              <input type="number" placeholder="Shares" value={l.shares || ''} onChange={(e) => update(i, { shares: Number(e.target.value) })} className="w-90" />
              <input type="number" step="0.01" placeholder="Price" value={l.price || ''} onChange={(e) => update(i, { price: Number(e.target.value) })} className="w-90" />
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
        </Modal>
      )}
    </>
  );
}

/** "Broker Style" view (2026-09-16 trust-restoration) — PSX's mirror of
 * QSE's own version, same reasoning: a real, always-in-sync-with-Dashboard
 * snapshot of this ticker's OFFICIAL position, so it can sit directly next
 * to Strategic Trades' advisory numbers for comparison. `positions` here
 * already reflects whichever `costBasisMethod` (weighted-average or FIFO)
 * this workbook is set to — same source Dashboard/Portfolio/PositionDetail
 * read — so this never disagrees with those pages. */
function BrokerStyleView({ ticker }: { ticker: string }) {
  const { workbook, calcFee, positions } = usePSXDerived();
  const currency = workbook.settings.currency;
  const position = positions.find((p) => p.ticker === ticker);
  const shares = position?.shares || 0;

  if (!position || shares <= 0) {
    return (
      <p className="text-muted mb-sm">
        No open shares of {ticker} right now — there's nothing for a broker statement to show until you hold some.
      </p>
    );
  }

  const avgCost = position.invested / shares;
  const be = breakEvenPrice(position.invested, shares, workbook.settings.feePct, workbook.settings.tick, calcFee);
  const mp = getMarketPrice(ticker, workbook.marketPrices, workbook.transactions);
  const value = shares * mp;
  const sellFee = mp > 0 ? calcFee(value, false) : 0;
  const profit = mp > 0 ? value - sellFee - position.invested : NaN;

  return (
    <div className="grid-auto" style={gridAutoStyle(150, 8)}>
      <div className="card stat-card"><div className="label">Shares held</div><div className="value">{fmt(shares, 0)}</div></div>
      <div className="card stat-card"><div className="label">Avg cost</div><div className="value">{fmtPrice(avgCost)}</div></div>
      <div className="card stat-card"><div className="label">Break-even</div><div className="value">{fmtPrice(be)}</div></div>
      <div className="card stat-card"><div className="label">Current price</div><div className="value">{mp > 0 ? fmtPrice(mp) : '—'}</div></div>
      {Number.isFinite(profit) && (
        <div className="card stat-card">
          <div className="label">Unrealized P/L</div>
          <div className={`value ${profit >= 0 ? 'pill-positive' : 'pill-negative'}`}>{fmtMoney(profit, currency)}</div>
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: TradePlan }) {
  const updateTradePlan = usePSXWorkbookStore((s) => s.updateTradePlan);
  const deleteTradePlan = usePSXWorkbookStore((s) => s.deleteTradePlan);
  const executeTradePlanLeg = usePSXWorkbookStore((s) => s.executeTradePlanLeg);
  const setMarketPrice = usePSXWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const { workbook, calcFee, rows } = usePSXDerived();
  const { tickerNames } = usePSXStockData();
  const currency = workbook.settings.currency;

  // Phase 3 delete-guard: a plan for a ticker you still hold shares of
  // can't be deleted outright — it's the home for that ticker's own
  // Partial Trade advice and any not-yet-executed "Sell this lot" legs.
  // "Clear plan" (remove every leg) stays available regardless. Also the
  // ticker passed to `analyzeTradePlanByTicker` as `extraTicker` so a
  // freshly auto-created, still-empty plan shows its own current-status
  // stats right away instead of only once a leg exists.
  const guardTicker = plan.defaultTicker || plan.legs[0]?.ticker || '';
  const hasOpenShares = (rows.find((r) => r.ticker === guardTicker)?.shares || 0) > 0;

  // Fee estimates for legs still pending need to know about this plan's
  // OTHER pending legs (and any real same-day transaction) to apply PSX's
  // same-day commission-netting rule correctly.
  const pendingLegTxs: Transaction[] = plan.legs
    .filter((l) => !l.executed)
    .map((l) => ({
      date: l.date || today(),
      ticker: l.ticker,
      action: l.action,
      shares: l.shares,
      price: l.price,
      manualSameDay: l.manualSameDay,
      feeOverride: l.feeOverride,
    }));
  const planFeeCalc = makePSXFeeCalculator(workbook.settings, [...workbook.transactions, ...pendingLegTxs]);
  const calcLegFee = (leg: TradePlanLeg) =>
    planFeeCalc(leg.shares * leg.price, leg.action === 'BUY', {
      shares: leg.shares,
      tx: {
        date: leg.date || today(),
        ticker: leg.ticker,
        action: leg.action,
        shares: leg.shares,
        price: leg.price,
        manualSameDay: leg.manualSameDay,
        feeOverride: leg.feeOverride,
      },
    });
  const resolveExecutedTx = (leg: TradePlanLeg): Transaction | null =>
    leg.executedTransactionId ? (workbook.transactions.find((t) => t.id === leg.executedTransactionId) ?? null) : null;
  const legFee = (leg: TradePlanLeg): number => {
    if (leg.executed) {
      const tx = resolveExecutedTx(leg);
      if (tx) return calcFee(tx.shares * tx.price, tx.action === 'BUY', { shares: tx.shares, tx });
    }
    return calcLegFee(leg);
  };
  const legFeeScenarios = (leg: TradePlanLeg) => feeScenarios(leg.shares * leg.price, leg.action === 'BUY', leg.shares, workbook.settings);

  const updateTransaction = usePSXWorkbookStore((s) => s.updateTransaction);
  const [linkingLegIndex, setLinkingLegIndex] = useState<number | null>(null);
  const [linkChoice, setLinkChoice] = useState('');
  const candidateTxsFor = (ticker: string): Transaction[] => workbook.transactions.filter((t) => t.ticker === ticker && t.id);
  const confirmLink = (i: number) => {
    if (!linkChoice) return;
    updateTradePlan(plan.id, { legs: plan.legs.map((l, idx) => (idx === i ? { ...l, executedTransactionId: linkChoice } : l)) });
    toast('Linked to that transaction — its live data will show here from now on.');
    setLinkingLegIndex(null);
    setLinkChoice('');
  };

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

  const tickerAnalysis = analyzeTradePlanByTicker(plan.legs, rows, calcFee, workbook.settings.feePct, workbook.settings.tick, calcLegFee, guardTicker || undefined);
  type AnalysisCol = 'ticker' | 'avgCost' | 'breakEven' | 'effectiveShares' | 'realizedPL';
  const analysisSortValue = (t: (typeof tickerAnalysis)[number], col: AnalysisCol): number | string =>
    col === 'ticker' ? t.ticker : t[col];
  const { sorted: sortedTickerAnalysis, Th: AnalysisTh } = useSortableRows(tickerAnalysis, analysisSortValue, 'ticker', 'asc');

  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(plan.name);
  const [notes, setNotes] = useState(plan.notes || '');
  const [planTicker, setPlanTicker] = useState(plan.defaultTicker || plan.legs[0]?.ticker || '');
  const [editLegIndex, setEditLegIndex] = useState<number | null>(null);
  const [editLeg, setEditLeg] = useState<TradePlanLeg | null>(null);
  const [addingLeg, setAddingLeg] = useState<Omit<TradePlanLeg, 'ticker'> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Trust-restoration (2026-09-16) — see the identical state in QSE's
  // TradeStrategyPage.tsx for the full reasoning.
  const [statsView, setStatsView] = useState<'broker' | 'strategic'>('broker');

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
    if (!isKnownTicker(tickerUpper, tickerNames, workbook.transactions)) {
      return toast(`"${tickerUpper}" isn't a recognized ticker — pick one from the suggestion list.`);
    }
    updateTradePlan(plan.id, {
      name: name.trim() || plan.name,
      notes: notes.trim() || undefined,
      defaultTicker: tickerUpper,
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

  const titleBlock: ReactNode = editingMeta ? (
    <div className="row" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()}>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
      <TextInput value={planTicker} onChange={(e) => setPlanTicker(e.target.value.toUpperCase())} list={PSX_TICKER_DATALIST_ID} placeholder="Ticker" className="w-100" />
      <button className="btn secondary small" onClick={saveMeta}><SaveIcon size={12} />Save</button>
      <button className="btn secondary small" onClick={() => setEditingMeta(false)}>Cancel</button>
    </div>
  ) : (
    <div>
      <strong>{plan.name}</strong>{' '}
      {(plan.defaultTicker || plan.legs[0]?.ticker) && (
        <span className="pill pill-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <TickerLogo ticker={plan.defaultTicker || plan.legs[0]?.ticker || ''} exchange="psx" size="sm" />
          {plan.defaultTicker || plan.legs[0]?.ticker}
        </span>
      )}{' '}
      <span className="text-muted">{plan.createdAt} · {doneCount}/{plan.legs.length} executed</span>
      {plan.notes && <p className="text-muted" style={{ margin: '4px 0 0' }}>{plan.notes}</p>}
    </div>
  );

  const actionButtons = (onFullScreenClick: () => void, isFullscreen: boolean): ReactNode => (
    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
      <IconButton
        label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        icon={isFullscreen ? <CollapseIcon size={13} /> : <ExpandIcon size={13} />}
        align="right"
        onClick={onFullScreenClick}
      />
      {!editingMeta && (
        <IconButton
          label="Edit"
          icon={<EditIcon size={13} />}
          align="right"
          onClick={() => {
            setName(plan.name);
            setNotes(plan.notes || '');
            setPlanTicker(plan.defaultTicker || plan.legs[0]?.ticker || '');
            setEditingMeta(true);
          }}
        />
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
        disabled={hasOpenShares}
        title={hasOpenShares ? `This ticker still has open shares — close the position first.` : undefined}
        onClick={async () => {
          const ok = await confirmDialog('This deletes the plan itself, not any transactions already logged from it.', `Delete plan "${plan.name}"?`);
          if (ok) deleteTradePlan(plan.id);
        }}
      >
        <TrashIcon size={12} />Delete plan
      </button>
    </div>
  );

  // Summary-first (user-reported, screenshot-confirmed): the per-lot
  // Partial Trade advice and the plan's own per-ticker blended analysis
  // now render BEFORE the (potentially long, horizontally-scrolling) legs
  // table, not buried underneath it.
  const addLotToPlan = (lot: LotAdvice) => {
    const row = rows.find((r) => r.ticker === guardTicker);
    const price = row?.marketPrice || lot.breakEven;
    updateTradePlan(plan.id, {
      legs: [...plan.legs, { date: today(), action: 'SELL', ticker: guardTicker, shares: lot.remainingShares, price, targetLotBuyId: lot.buyId }],
    });
    toast(`Added SELL ${fmt(lot.remainingShares, 0)} ${guardTicker} @ ${fmtPrice(price)} to this plan.`);
  };

  const bodyContent = (
    <>
      <div className="row gap-sm mb-sm" style={{ alignItems: 'center' }}>
        <span className="text-muted">Compare:</span>
        <button type="button" className={`chip${statsView === 'broker' ? ' active' : ''}`} onClick={() => setStatsView('broker')}>
          {statsView === 'broker' && <CheckIcon size={11} />}Broker Style
        </button>
        <button type="button" className={`chip${statsView === 'strategic' ? ' active' : ''}`} onClick={() => setStatsView('strategic')}>
          {statsView === 'strategic' && <CheckIcon size={11} />}Strategic Trades
        </button>
        <StatSourceBadge source={statsView === 'broker' ? 'official' : 'advisory'} />
      </div>

      {statsView === 'broker' && guardTicker && (
        <div style={{ marginBottom: 16 }}>
          <div className="text-muted" style={{ marginBottom: 4 }}>
            Exactly what your broker/statement would show for {guardTicker} right now — unaffected by anything
            in this plan or Strategic Trades below.
          </div>
          <BrokerStyleView ticker={guardTicker} />
        </div>
      )}

      {statsView === 'strategic' && (
        <>

      {guardTicker && <PartialTradeAdvisor ticker={guardTicker} onSellLot={addLotToPlan} />}

      {tickerAnalysis.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="text-muted" style={{ marginBottom: 4 }}>
            Per-ticker plan analysis — average cost blends this plan's pending buys with any shares you already
            hold; already-executed legs are shown separately and never double-counted into it.
          </div>
          <div className="grid-auto" style={{ ...gridAutoStyle(200, 8), marginBottom: 12 }}>
            {sortedTickerAnalysis.map((t, idx) => {
              const row = rows.find((r) => r.ticker === t.ticker);
              return (
                <div key={t.ticker} className="card stat-card" style={hueStyle(HUES[idx % HUES.length])}>
                  <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TickerLogo ticker={t.ticker} exchange="psx" size="sm" />
                    {t.ticker}
                  </div>
                  <div className="value" style={{ fontSize: 15 }}>{t.avgCost > 0 ? `Avg ${fmtPrice(t.avgCost)}` : 'No avg cost'}</div>
                  <div className="sub">
                    BE {t.breakEven > 0 ? fmtPrice(t.breakEven) : '—'} · {fmt(row?.shares || 0, 0)} sh held now
                    {t.plannedSold > 0 && (
                      <> · <span className={t.realizedPL >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(t.realizedPL, currency)} P/L</span></>
                    )}
                  </div>
                  <div className="sub" onClick={(e) => e.stopPropagation()}>
                    Current price:{' '}
                    <input
                      key={row?.marketPrice}
                      type="number"
                      step="0.001"
                      className="price-input w-96"
                      defaultValue={row?.marketPrice || ''}
                      placeholder="—"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const target = e.target as HTMLInputElement;
                          const val = parseFloat(target.value) || 0;
                          if (val > 0 && (await ensureSignedIn('Sign in to save price updates.'))) {
                            setMarketPrice(t.ticker, val);
                            toast(`${t.ticker} price saved: ${fmtPrice(val)}`);
                          }
                          target.blur();
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
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
                    <td style={{ display: 'flex', alignItems: 'center', gap: 4 }}><TickerLogo ticker={t.ticker} exchange="psx" size="sm" />{t.ticker}</td>
                    <td className="text-muted">
                      {t.executedBought > 0 && <>+{fmt(t.executedBought, 0)} buy </>}
                      {t.executedSold > 0 && <>-{fmt(t.executedSold, 0)} sell</>}
                      {!t.executedBought && !t.executedSold && '—'}
                    </td>
                    <td className="text-muted">
                      {t.plannedBought > 0 && <>+{fmt(t.plannedBought, 0)} buy </>}
                      {t.plannedSold > 0 && <>-{fmt(t.plannedSold, 0)} sell</>}
                      {!t.plannedBought && !t.plannedSold && '—'}
                    </td>
                    <td>{t.avgCost > 0 ? fmtPrice(t.avgCost) : '—'}</td>
                    <td>{t.breakEven > 0 ? fmtPrice(t.breakEven) : '—'}</td>
                    <td>{fmt(t.effectiveShares, 0)}</td>
                    <td className={t.plannedSold > 0 ? (t.realizedPL >= 0 ? 'pill-positive' : 'pill-negative') : ''}>
                      {t.plannedSold > 0 ? fmtMoney(t.realizedPL, currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <WhatIfExitCalculator
            tickerAnalysis={tickerAnalysis}
            calcFee={calcFee}
            currency={currency}
            currentPrices={Object.fromEntries(rows.map((r) => [r.ticker, r.marketPrice]))}
          />
        </div>
      )}
        </>
      )}

      <div className="table-scroll">
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
                  <td><input type="date" value={editLeg.date} onChange={(e) => setEditLeg({ ...editLeg, date: e.target.value })} className="w-130" /></td>
                  <td>{editLeg.ticker}</td>
                  <td>
                    <select value={editLeg.action} onChange={(e) => setEditLeg({ ...editLeg, action: e.target.value as 'BUY' | 'SELL' })}>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </td>
                  <td><input type="number" value={editLeg.shares} onChange={(e) => setEditLeg({ ...editLeg, shares: Number(e.target.value) })} className="w-70" /></td>
                  <td><input type="number" step="0.01" value={editLeg.price} onChange={(e) => setEditLeg({ ...editLeg, price: Number(e.target.value) })} className="w-80" /></td>
                  <td>{fmtMoney(editLeg.shares * editLeg.price, currency)}</td>
                  <td>
                    <FeeModeControl
                      mode={feeModeFor(editLeg)}
                      onModeChange={(mode) => {
                        if (mode === 'auto') setEditLeg({ ...editLeg, manualSameDay: undefined, feeOverride: undefined });
                        else if (mode === 'semi') setEditLeg({ ...editLeg, manualSameDay: editLeg.manualSameDay ?? false, feeOverride: undefined });
                        else setEditLeg({ ...editLeg, manualSameDay: undefined, feeOverride: editLeg.feeOverride ?? 0 });
                      }}
                      manualSameDay={!!editLeg.manualSameDay}
                      onManualSameDayChange={(v) => setEditLeg({ ...editLeg, manualSameDay: v })}
                      feeOverride={editLeg.feeOverride}
                      onFeeOverrideChange={(v) => setEditLeg({ ...editLeg, feeOverride: v })}
                      tradeAmount={editLeg.shares * editLeg.price}
                    />
                  </td>
                  <td></td>
                  <td>
                    <button className="btn secondary small" onClick={saveLeg}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => setEditLegIndex(null)}>Cancel</button>
                  </td>
                </tr>
              );

              if (editingTxLegIndex === i && editTxRow) return (
                <tr key={i}>
                  <td><input type="date" value={editTxRow.date} onChange={(e) => setEditTxRow({ ...editTxRow, date: e.target.value })} className="w-130" /></td>
                  <td>{editTxRow.ticker}</td>
                  <td>
                    <select value={editTxRow.action} onChange={(e) => setEditTxRow({ ...editTxRow, action: e.target.value as 'BUY' | 'SELL' })}>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </td>
                  <td><input type="number" value={editTxRow.shares} onChange={(e) => setEditTxRow({ ...editTxRow, shares: Number(e.target.value) })} className="w-70" /></td>
                  <td><input type="number" step="0.01" value={editTxRow.price} onChange={(e) => setEditTxRow({ ...editTxRow, price: Number(e.target.value) })} className="w-80" /></td>
                  <td>{fmtMoney(editTxRow.shares * editTxRow.price, currency)}</td>
                  <td>{fmtMoney(calcFee(editTxRow.shares * editTxRow.price, editTxRow.action === 'BUY', { shares: editTxRow.shares, tx: editTxRow }), currency)}</td>
                  <td><span className="pill-positive">Executed</span></td>
                  <td>
                    <button className="btn secondary small" onClick={saveEditTx}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => { setEditingTxLegIndex(null); setEditTxRow(null); }}>Cancel</button>
                  </td>
                </tr>
              );

              const linkedTx = leg.executed ? resolveExecutedTx(leg) : null;
              const display = linkedTx ?? leg;
              const stale = leg.executed && !linkedTx;
              const scenarios = !leg.executed ? legFeeScenarios(leg) : null;
              return (
                <Fragment key={i}>
                  <tr style={leg.executed ? { borderLeft: '3px solid var(--profit)' } : { borderLeft: '3px solid transparent' }}>
                    <td>{display.date}{stale && (
                      <Tooltip text="No linked transaction found — showing the plan's original snapshot from when this was marked done. Use Link below to fix this.">
                        <span style={{ cursor: 'pointer', color: 'var(--warn)' }}> ⚠</span>
                      </Tooltip>
                    )}</td>
                    <td className="flex-center-gap4">
                      <TickerLogo ticker={display.ticker} exchange="psx" size="sm" />
                      {display.ticker}
                    </td>
                    <td className={display.action === 'BUY' ? 'pill-buy' : 'pill-sell'}>{display.action}</td>
                    <td>{fmt(display.shares, 0)}</td>
                    <td>{fmtPrice(display.price)}</td>
                    <td>{fmtMoney(display.shares * display.price, currency)}</td>
                    <td>
                      {fmtMoney(legFee(leg), currency)}
                      {scenarios && (
                        <Tooltip
                          text={`Full ${fmtMoney(scenarios.full, currency)} · Same-day netted ${fmtMoney(scenarios.netted, currency)} — shown regardless of what else is in this plan; a lone leg is priced at full commission unless it actually pairs with an opposite same-day trade.`}
                        >
                          <span className="text-muted clickable" style={{ marginLeft: 4 }}><InfoIcon size={11} /></span>
                        </Tooltip>
                      )}
                    </td>
                    <td>
                      {leg.executed ? (
                        linkedTx ? (
                          <Tooltip text="Synced with its transaction — edit it below or from the Transactions page.">
                            <span className="pill-positive clickable">Executed</span>
                          </Tooltip>
                        ) : (
                          <span className="pill-negative">Executed (unlinked)</span>
                        )
                      ) : (
                        <span className="text-muted">Planned</span>
                      )}
                    </td>
                    <td>
                      {!leg.executed && (
                        <>
                          <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEditLeg(i)} />{' '}
                          <button className="btn secondary small" onClick={() => markDone(i)}><CheckIcon size={12} />Mark done</button>{' '}
                          <button className="btn secondary small" onClick={() => removeLeg(i)}><TrashIcon size={12} />Remove</button>
                        </>
                      )}
                      {leg.executed && linkedTx && (
                        <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEditTx(i, linkedTx)} />
                      )}
                      {stale && (
                        <button className="btn secondary small" onClick={() => setLinkingLegIndex(linkingLegIndex === i ? null : i)}>Link…</button>
                      )}
                    </td>
                  </tr>
                  {linkingLegIndex === i && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <Notice tone="warning" style={{ margin: '4px 0' }}>
                          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                            <span>Pick the transaction this leg actually corresponds to:</span>
                            <select value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
                              <option value="">— Select a transaction —</option>
                              {candidateTxsFor(leg.ticker).map((t) => (
                                <option key={t.id} value={t.id}>{t.date} · {t.action} {fmt(t.shares, 0)} @ {fmtPrice(t.price)}</option>
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
              <tr><td colSpan={9} className="text-muted">No legs left in this plan.</td></tr>
            )}
            {addingLeg && (
              <tr>
                <td><input type="date" value={addingLeg.date} onChange={(e) => setAddingLeg({ ...addingLeg, date: e.target.value })} className="w-130" /></td>
                <td>{plan.defaultTicker || planTicker}</td>
                <td>
                  <select value={addingLeg.action} onChange={(e) => setAddingLeg({ ...addingLeg, action: e.target.value as 'BUY' | 'SELL' })}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </td>
                <td><input type="number" placeholder="Shares" value={addingLeg.shares || ''} onChange={(e) => setAddingLeg({ ...addingLeg, shares: Number(e.target.value) })} className="w-70" /></td>
                <td><input type="number" step="0.01" placeholder="Price" value={addingLeg.price || ''} onChange={(e) => setAddingLeg({ ...addingLeg, price: Number(e.target.value) })} className="w-80" /></td>
                <td>{fmtMoney(addingLeg.shares * addingLeg.price, currency)}</td>
                <td>
                  <FeeModeControl
                    mode={feeModeFor(addingLeg)}
                    onModeChange={(mode) => {
                      if (mode === 'auto') setAddingLeg({ ...addingLeg, manualSameDay: undefined, feeOverride: undefined });
                      else if (mode === 'semi') setAddingLeg({ ...addingLeg, manualSameDay: addingLeg.manualSameDay ?? false, feeOverride: undefined });
                      else setAddingLeg({ ...addingLeg, manualSameDay: undefined, feeOverride: addingLeg.feeOverride ?? 0 });
                    }}
                    manualSameDay={!!addingLeg.manualSameDay}
                    onManualSameDayChange={(v) => setAddingLeg({ ...addingLeg, manualSameDay: v })}
                    feeOverride={addingLeg.feeOverride}
                    onFeeOverrideChange={(v) => setAddingLeg({ ...addingLeg, feeOverride: v })}
                    tradeAmount={addingLeg.shares * addingLeg.price}
                  />
                </td>
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
        <button className="btn secondary small mt-sm" onClick={() => setAddingLeg({ date: today(), action: 'BUY', shares: 0, price: 0 })}>
          <PlusIcon size={12} />Add leg
        </button>
      )}

      <p className="text-muted mt-sm">
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
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            {titleBlock}
            {actionButtons(() => setFullscreen(false), true)}
          </div>
          {bodyContent}
        </div>
      ) : (
        <CollapsibleCard title={titleBlock} headerExtra={actionButtons(() => setFullscreen(true), false)} defaultOpen={false} style={{ marginBottom: 28, padding: 12 }}>
          {bodyContent}
        </CollapsibleCard>
      )}
    </>
  );
}

export function TradeStrategyPage() {
  const tradePlans = usePSXWorkbookStore((s) => s.workbook.tradePlans);
  const addTradePlan = usePSXWorkbookStore((s) => s.addTradePlan);
  const sorted = [...tradePlans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const alertsEnabled = usePSXWorkbookStore((s) => !!s.workbook.settings.partialTradeAlertsEnabled);
  const updateSettings = usePSXWorkbookStore((s) => s.updateSettings);
  const { rows } = usePSXDerived();
  const { user } = useAuthState();

  // Phase 3: every open position always has its own plan to host that
  // ticker's Partial Trade advice and any "Sell this lot" legs — no need to
  // create one by hand first (the old standalone "Partial Trade" section,
  // reachable without a plan, is gone — this makes it redundant). Never
  // fires signed out: browsing stays free, this never prompts a sign-in
  // modal on its own. Idempotent — only creates a plan genuinely missing.
  useEffect(() => {
    if (!user) return;
    const openTickers = rows.filter((r) => r.shares > 0).map((r) => r.ticker);
    for (const ticker of openTickers) {
      const hasPlan = tradePlans.some((p) => (p.defaultTicker || p.legs[0]?.ticker) === ticker);
      if (!hasPlan) {
        addTradePlan({ id: crypto.randomUUID(), name: `${ticker} Plan`, createdAt: today(), legs: [], defaultTicker: ticker });
      }
    }
  }, [user, rows, tradePlans, addTradePlan]);

  return (
    <div>
      <h1 className="pagetitle">PSX Trade Strategy</h1>
      <p className="text-muted mb-12">
        Buy/Sell &amp; Avg Down, and Trade Planner &amp; Partial Trade — sketch out trades ahead of time, or get
        advice on lots you already hold. Every open position gets its own plan automatically.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }} title="A popup on app load listing every ticker with a Partial Trade opportunity, across both exchanges — off by default since this is an opt-in, riskier strategy.">
        <input type="checkbox" checked={alertsEnabled} onChange={(e) => updateSettings({ partialTradeAlertsEnabled: e.target.checked })} />
        Show Partial Trade Alerts popup on app load
      </label>

      <BuySellAvgDownCalculator />

      <h2 style={{ marginTop: 20, marginBottom: 8, fontSize: 16 }}>Trade Planner</h2>
      <NewPlanFab />
      {sorted.length ? sorted.map((p) => <PlanCard key={p.id} plan={p} />) : <p className="text-muted">No trade plans yet.</p>}
    </div>
  );
}
