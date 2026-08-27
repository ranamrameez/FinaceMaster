import { useEffect, useMemo, useState } from 'react';
import { breakEvenPrice, requiredSellPrice, roundTick } from '../../../lib/calc';
import { calcCGT, feeScenarios } from '../../../lib/calc/psxFees';
import type { FeeCalculator } from '../../../types/workbook';
import { PlusIcon, SaveIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, TextInput } from '../../../components/ui/Field';
import { Tooltip } from '../../../components/Tooltip';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { usePSXDerived } from '../hooks/usePSXDerived';
import { usePSXStockData } from '../hooks/usePSXStockData';
import { hueStyle } from '../../../lib/statCardHues';

type Mode = 'BUY' | 'SELL' | 'CYCLE';

/** Binary search for the BUY share count that brings the position's
 * weighted-average cost to a target value — same solver as QSE's, but
 * passes `shares` through to calcFee at every step since PSX's low-price
 * commission tier and CDC-per-share fee both depend on it. */
function solveSharesForTargetAvg(
  invested: number,
  shares: number,
  buyPrice: number,
  target: number,
  calcFee: (amount: number, isBuy: boolean, context?: { shares?: number }) => number,
): number | null {
  const avgAt = (n: number) => {
    const fee = calcFee(n * buyPrice, true, { shares: n });
    return (invested + n * buyPrice + fee) / (shares + n || 1);
  };
  const currentAvg = shares > 0 ? invested / shares : buyPrice;
  let lo = 0;
  let hi = Math.max(1e7, (shares + 1) * 10000);
  const loVal = currentAvg - target;
  const hiVal = avgAt(hi) - target;
  if (loVal === 0) return 0;
  if (loVal > 0 === hiVal > 0) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const midVal = avgAt(mid) - target;
    if (midVal > 0 === loVal > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function TradeCalculator({ initialTicker }: { initialTicker?: string } = {}) {
  const { workbook, positions, calcFee, summary } = usePSXDerived();
  const { tickerNames } = usePSXStockData();
  const addTransaction = usePSXWorkbookStore((s) => s.addTransaction);
  const setMarketPrice = usePSXWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;

  const [mode, setMode] = useState<Mode>('BUY');
  const [ticker, setTicker] = useState(initialTicker || '');
  const [targetTouched, setTargetTouched] = useState(false);

  const [sellShares, setSellShares] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [targetProfit, setTargetProfit] = useState(0);

  const [buyPrice, setBuyPrice] = useState(0);
  const [newShares, setNewShares] = useState(0);
  // See QSE's TradeCalculator.tsx for the full reasoning: the Amount field
  // needs its own local text state rather than always displaying
  // `buyAmount.toFixed(2)`, or the round-trip reformat-to-2-decimals on
  // every keystroke makes it impossible to type a multi-digit amount — a
  // real bug reported on mobile.
  const [amountInput, setAmountInput] = useState('');
  const [targetAvg, setTargetAvg] = useState(0);
  const [targetSell, setTargetSell] = useState(0);
  const [priceOverride, setPriceOverride] = useState('');

  const held = useMemo(() => positions.filter((p) => p.shares > 0).sort((a, b) => a.ticker.localeCompare(b.ticker)), [positions]);
  const others = useMemo(
    () => Object.keys(tickerNames).filter((t) => !held.some((p) => p.ticker === t)).sort(),
    [tickerNames, held],
  );

  useEffect(() => {
    if (!ticker && held.length) setTicker(held[0].ticker);
    else if (!ticker && others.length) setTicker(others[0]);
  }, [held, others, ticker]);

  const position = positions.find((p) => p.ticker === ticker && p.shares > 0);
  const shares = position?.shares || 0;
  const invested = position?.invested || 0;
  const avg = shares > 0 ? invested / shares : 0;
  const mp = workbook.marketPrices[ticker] || 0;
  const currentPrice = priceOverride !== '' ? Number(priceOverride) || 0 : mp;
  const be = shares > 0 ? breakEvenPrice(invested, shares, feePct, tick, calcFee) : 0;
  // README Done item 207: PositionDetail's same "same-day vs. other-day"
  // break-even scenario, applied here too since this calculator's own
  // "Break-even" card is the same current-position figure — `be` above
  // already IS the "other day / full commission" scenario (calcFee is
  // always called with no `tx` context, which makePSXFeeCalculator
  // resolves to the full fee). This second figure assumes the sell nets
  // against a same-day buy (government levies only).
  const nettedCalcFee: FeeCalculator = (amount, isBuy, context) =>
    feeScenarios(amount, isBuy, context?.shares ?? 0, workbook.settings).netted;
  const beSameDay = shares > 0 ? breakEvenPrice(invested, shares, feePct, tick, nettedCalcFee) : 0;
  const sellFeeNow = currentPrice > 0 ? calcFee(shares * currentPrice, false, { shares }) : 0;
  const worth = currentPrice > 0 ? shares * currentPrice - sellFeeNow : 0;
  const currentPL = currentPrice > 0 ? worth - invested : 0;
  const currentCGT = currentPL > 0 ? calcCGT(currentPL, workbook.settings) : 0;

  useEffect(() => {
    setPriceOverride('');
    setSellShares(shares);
    setSellPrice(mp);
    setBuyPrice(mp);
    setNewShares(0);
    setAmountInput('');
    setTargetProfit(0);
    setTargetAvg(0);
    setTargetSell(0);
    setTargetTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const buyAmount = newShares * buyPrice;
  const buyFee = buyPrice > 0 ? calcFee(buyAmount, true, { shares: newShares }) : 0;
  const additionalInvestment = buyAmount + buyFee;
  const totalShares = shares + newShares;
  const totalInvested = invested + additionalInvestment;
  const newAvg = totalShares > 0 ? totalInvested / totalShares : 0;
  const newBe = totalShares > 0 ? breakEvenPrice(totalInvested, totalShares, feePct, tick, calcFee) : 0;
  const bounceRequired = buyPrice > 0 ? ((newBe - buyPrice) / buyPrice) * 100 : 0;

  const cashBalance = summary.cashBalance;
  const affordableShares = useMemo(() => {
    if (buyPrice <= 0) return 0;
    let n = 0;
    while (true) {
      const cost = (n + 1) * buyPrice + calcFee((n + 1) * buyPrice, true, { shares: n + 1 });
      if (cost > cashBalance || n > 5_000_000) break;
      n++;
    }
    return n;
  }, [buyPrice, cashBalance, calcFee]);

  useEffect(() => {
    if (mode === 'CYCLE' && !targetTouched && newBe > 0) setTargetSell(newBe);
  }, [mode, targetTouched, newBe]);

  const sellCap = Math.min(sellShares, shares);
  const overCap = sellShares > shares;
  const sellGross = sellCap * sellPrice;
  const sellFee = sellPrice > 0 ? calcFee(sellGross, false, { shares: sellCap }) : 0;
  const sellNet = sellGross - sellFee;
  const sellCostBasis = avg * sellCap;
  const realized = sellNet - sellCostBasis;
  const sellCGT = realized > 0 ? calcCGT(realized, workbook.settings) : 0;
  const remainingShares = shares - sellCap;
  const remainingInvested = Math.max(0, invested - sellCostBasis);

  const cycleSellFee = targetSell > 0 ? calcFee(totalShares * targetSell, false, { shares: totalShares }) : 0;
  const cycleSellProceeds = totalShares * targetSell - cycleSellFee;
  const cycleNetPL = cycleSellProceeds - totalInvested;
  const cycleRoi = totalInvested > 0 ? (cycleNetPL / totalInvested) * 100 : 0;

  const solvedSharesForAvg =
    targetAvg > 0 && buyPrice > 0 ? solveSharesForTargetAvg(invested, shares, buyPrice, targetAvg, calcFee) : null;

  const solvedSellPriceForProfit =
    targetProfit !== 0 && sellCap > 0 ? requiredSellPrice(sellCostBasis, sellCap, targetProfit, feePct, tick, calcFee) : null;

  const addTrade = async () => {
    if (mode === 'SELL') {
      if (!ticker || sellCap <= 0 || sellPrice <= 0) return toast('Fill in shares and price.');
      if (!(await ensureSignedIn('Sign in to save this trade.'))) return;
      addTransaction({ date: new Date().toISOString().slice(0, 10), ticker, action: 'SELL', shares: sellCap, price: sellPrice });
      toast(`Logged SELL ${sellCap} ${ticker} @ ${fmtPrice(sellPrice)}`);
    } else {
      if (!ticker || newShares <= 0 || buyPrice <= 0) return toast('Fill in shares and price.');
      if (!(await ensureSignedIn('Sign in to save this trade.'))) return;
      addTransaction({ date: new Date().toISOString().slice(0, 10), ticker, action: 'BUY', shares: newShares, price: buyPrice });
      toast(
        mode === 'CYCLE'
          ? `Logged the BUY leg: ${newShares} ${ticker} @ ${fmtPrice(buyPrice)}. The planned sell is not auto-logged — add it when you actually sell.`
          : `Logged BUY ${newShares} ${ticker} @ ${fmtPrice(buyPrice)}`,
      );
      setNewShares(0);
      setAmountInput('');
    }
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode);
            setTargetTouched(false);
          }}
        >
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
          <option value="CYCLE">Cycle (buy then plan a sell)</option>
        </select>
        <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
          {held.length > 0 && (
            <optgroup label="Your positions">
              {held.map((p) => (
                <option key={p.ticker} value={p.ticker}>
                  {p.ticker} ({fmt(p.shares, 0)} shares)
                </option>
              ))}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="Other PSX tickers">
              {others.map((t) => (
                <option key={t} value={t}>
                  {t} (new position)
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {ticker && (
        <div className="row" style={{ gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
          <Field
            label="Current price"
            width={140}
            title="Prefilled from the last market price you saved for this ticker. Editing it here only affects this calculator's numbers below — it does NOT save a new market price. Use the Save button to actually update it."
          >
            <TextInput
              type="number"
              step="0.01"
              className="price-input"
              value={priceOverride !== '' ? priceOverride : mp > 0 ? String(mp) : ''}
              onChange={(e) => setPriceOverride(e.target.value)}
              style={{ borderColor: currentPrice > 0 ? undefined : 'var(--loss)' }}
            />
          </Field>
          {priceOverride !== '' && currentPrice > 0 && currentPrice !== mp && (
            <Tooltip text={`Save ${fmtPrice(currentPrice)} as this ticker's real market price (used everywhere else in the app, not just here).`}>
              <button
                className="btn secondary small"
                onClick={async () => {
                  if (!(await ensureSignedIn('Sign in to save price updates.'))) return;
                  setMarketPrice(ticker, currentPrice);
                  toast(`${ticker} market price saved: ${fmtPrice(currentPrice)}`);
                  setPriceOverride('');
                }}
              >
                <SaveIcon size={12} />Save as market price
              </button>
            </Tooltip>
          )}
          {position && (
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, flex: 1 }}>
              <div className="stat-card card"><div className="label">Avg cost</div><div className="value">{fmtPrice(avg)}</div></div>
              <div className="stat-card card" style={currentPrice > 0 ? hueStyle(currentPrice >= be ? 'var(--profit)' : 'var(--loss)') : undefined}>
                <Tooltip text="PSX nets commission when you buy and sell the same ticker on the same day — the smaller-quantity leg (ties go to the buy) pays no commission or SST, only government levies. 'Same-day' assumes this sell nets against a same-day buy; 'other day' assumes the full commission applies.">
                  <div className="label" style={{ cursor: 'pointer' }}>Break-even</div>
                </Tooltip>
                <div className="value">{fmtPrice(be)}</div>
                <div className="sub">other day · same-day {fmtPrice(beSameDay)}</div>
              </div>
              <div className="stat-card card"><div className="label">Worth now</div><div className="value">{fmtMoney(worth, currency)}</div></div>
              <div className="stat-card card" style={currentPrice > 0 ? hueStyle(currentPL >= 0 ? 'var(--profit)' : 'var(--loss)') : undefined}><div className="label">Current P/L</div><div className="value">{fmtMoney(currentPL, currency)}</div></div>
              {currentPL > 0 && <div className="stat-card card"><div className="label">Est. CGT if sold now</div><div className="value">{fmtMoney(currentCGT, currency)}</div></div>}
            </div>
          )}
        </div>
      )}

      {mode === 'SELL' ? (
        <div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Field label="Shares to sell" width={90}>
              <TextInput type="number" value={sellShares || ''} onChange={(e) => setSellShares(Number(e.target.value))} />
            </Field>
            <Field label="Sell price" width={90}>
              <TextInput type="number" step="0.01" value={sellPrice || ''} onChange={(e) => setSellPrice(Number(e.target.value))} />
            </Field>
            <Field label={`Target profit (${currency}, optional)`} width={110}>
              <TextInput type="number" step="0.01" value={targetProfit || ''} onChange={(e) => setTargetProfit(Number(e.target.value))} />
            </Field>
          </div>
          {overCap && <p className="footer-note" style={{ color: 'var(--loss)' }}>Capped at {shares} shares held.</p>}
          {solvedSellPriceForProfit !== null && (
            <p className="footer-note">
              Sell price needed for {fmtMoney(targetProfit, currency)} profit: {fmtPrice(solvedSellPriceForProfit)}{' '}
              <button className="btn secondary small" onClick={() => setSellPrice(roundTick(solvedSellPriceForProfit, tick))}>Use</button>
            </p>
          )}
          {sellCap > 0 && sellPrice > 0 && (
            <div className="footer-note" style={{ marginTop: 8 }}>
              Net proceeds {fmtMoney(sellNet, currency)} · Realized P/L{' '}
              <span className={realized >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(realized, currency)}</span>
              {realized > 0 && <> · Est. CGT {fmtMoney(sellCGT, currency)}</>} · Remaining{' '}
              {fmt(remainingShares, 0)} shares ({fmtMoney(remainingInvested, currency)} invested)
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Field label="Buy price" width={90}>
              <TextInput
                type="number"
                step="0.01"
                value={buyPrice || ''}
                onChange={(e) => {
                  const price = Number(e.target.value);
                  setBuyPrice(price);
                  if (newShares) setAmountInput(price > 0 ? (newShares * price).toFixed(2) : '');
                }}
              />
            </Field>
            <Field label="New shares" width={90}>
              <TextInput
                type="number"
                value={newShares || ''}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setNewShares(s);
                  setAmountInput(buyPrice > 0 && s ? (s * buyPrice).toFixed(2) : '');
                }}
              />
            </Field>
            <Field label="Amount" width={100}>
              <TextInput
                type="number"
                step="0.01"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setNewShares(buyPrice > 0 ? Number(e.target.value) / buyPrice : 0);
                }}
              />
            </Field>
            <Field label="Target avg cost (optional)" width={90}>
              <TextInput type="number" step="0.01" value={targetAvg || ''} onChange={(e) => setTargetAvg(Number(e.target.value))} />
            </Field>
            {mode === 'CYCLE' && (
              <Field label="Target sell price" width={90}>
                <TextInput type="number" step="0.01" value={targetSell || ''} onChange={(e) => { setTargetSell(Number(e.target.value)); setTargetTouched(true); }} />
              </Field>
            )}
          </div>
          {solvedSharesForAvg !== null && (
            <p className="footer-note">
              Buy ~{fmt(solvedSharesForAvg, 0)} shares to bring average cost to {fmtPrice(targetAvg)}{' '}
              <button
                className="btn secondary small"
                onClick={() => {
                  const rounded = Math.round(solvedSharesForAvg);
                  setNewShares(rounded);
                  setAmountInput(buyPrice > 0 && rounded ? (rounded * buyPrice).toFixed(2) : '');
                }}
              >
                Use
              </button>
            </p>
          )}
          {buyPrice > 0 && (
            <p className="footer-note">Affordable with current cash ({fmtMoney(cashBalance, currency)}): {fmt(affordableShares, 0)} shares</p>
          )}
          {newShares > 0 && buyPrice > 0 && (
            <div className="footer-note" style={{ marginTop: 8 }}>
              New avg cost {fmtPrice(newAvg)} · New break-even {fmtPrice(newBe)} · Needs {bounceRequired.toFixed(1)}% bounce from buy price
            </div>
          )}
          {mode === 'CYCLE' && totalShares > 0 && targetSell > 0 && (
            <div className="footer-note" style={{ marginTop: 4 }}>
              If sold at target: proceeds {fmtMoney(cycleSellProceeds, currency)} · Cycle P/L{' '}
              <span className={cycleNetPL >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(cycleNetPL, currency)}</span> ({cycleRoi.toFixed(1)}%)
            </div>
          )}
        </div>
      )}

      <button className="btn" style={{ marginTop: 12 }} onClick={addTrade}>
        <PlusIcon />Add {mode === 'SELL' ? 'sell' : mode === 'CYCLE' ? 'buy (cycle)' : 'buy'} to transactions
      </button>
      {mode === 'CYCLE' && (
        <p className="footer-note" style={{ marginTop: 4 }}>
          Only the buy leg is logged now — add the sell as its own transaction when you actually sell.
        </p>
      )}
    </div>
  );
}
