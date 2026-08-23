import { useEffect, useMemo, useState } from 'react';
import { breakEvenPrice, requiredSellPrice, roundTick } from '../../../lib/calc';
import { toast } from '../../../components/Toast';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';

type Mode = 'BUY' | 'SELL' | 'CYCLE';

/** Binary search for the BUY share count that brings the position's
 * weighted-average cost to a target value, ported from the legacy app's
 * reverse-averaging solver (60-iteration bisection). Returns null if the
 * target isn't reachable by buying more at this price (e.g. target is on
 * the wrong side of the current average). */
function solveSharesForTargetAvg(
  invested: number,
  shares: number,
  buyPrice: number,
  target: number,
  calcFee: (amount: number, isBuy: boolean) => number,
): number | null {
  const avgAt = (n: number) => {
    const fee = calcFee(n * buyPrice, true);
    return (invested + n * buyPrice + fee) / (shares + n || 1);
  };
  const currentAvg = shares > 0 ? invested / shares : buyPrice;
  let lo = 0;
  let hi = Math.max(1e7, (shares + 1) * 10000);
  const loVal = currentAvg - target;
  const hiVal = avgAt(hi) - target;
  if (loVal === 0) return 0;
  if (loVal > 0 === hiVal > 0) return null; // not reachable by buying more
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const midVal = avgAt(mid) - target;
    if (midVal > 0 === loVal > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function TradeCalculator() {
  const { workbook, positions, calcFee, summary } = useQSEDerived();
  const { tickerNames } = useQSEStockData();
  const addTransaction = useWorkbookStore((s) => s.addTransaction);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;

  const [mode, setMode] = useState<Mode>('BUY');
  const [ticker, setTicker] = useState('');
  const [targetTouched, setTargetTouched] = useState(false);

  const [sellShares, setSellShares] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [targetProfit, setTargetProfit] = useState(0);

  const [buyPrice, setBuyPrice] = useState(0);
  const [newShares, setNewShares] = useState(0);
  const [targetAvg, setTargetAvg] = useState(0);
  const [targetSell, setTargetSell] = useState(0);

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
  const be = shares > 0 ? breakEvenPrice(invested, shares, feePct, tick, calcFee) : 0;
  const sellFeeNow = mp > 0 ? calcFee(shares * mp, false) : 0;
  const worth = mp > 0 ? shares * mp - sellFeeNow : 0;
  const currentPL = mp > 0 ? worth - invested : 0;

  const buyAmount = newShares * buyPrice;
  const buyFee = buyPrice > 0 ? calcFee(buyAmount, true) : 0;
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
      const cost = (n + 1) * buyPrice + calcFee((n + 1) * buyPrice, true);
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
  const sellFee = sellPrice > 0 ? calcFee(sellGross, false) : 0;
  const sellNet = sellGross - sellFee;
  const sellCostBasis = avg * sellCap;
  const realized = sellNet - sellCostBasis;
  const remainingShares = shares - sellCap;
  const remainingInvested = Math.max(0, invested - sellCostBasis);

  const cycleSellProceeds = totalShares * targetSell - (targetSell > 0 ? calcFee(totalShares * targetSell, false) : 0);
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
            <optgroup label="Other QSE tickers">
              {others.map((t) => (
                <option key={t} value={t}>
                  {t} (new position)
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {position && (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 12 }}>
          <div className="stat-card card"><div className="label">Avg cost</div><div className="value">{fmtPrice(avg)}</div></div>
          <div className="stat-card card"><div className="label">Break-even</div><div className="value">{fmtPrice(be)}</div></div>
          <div className="stat-card card"><div className="label">Worth now</div><div className="value">{fmtMoney(worth, currency)}</div></div>
          <div className="stat-card card"><div className="label">Current P/L</div><div className="value">{fmtMoney(currentPL, currency)}</div></div>
        </div>
      )}

      {mode === 'SELL' ? (
        <div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label>Shares to sell<input type="number" value={sellShares || ''} onChange={(e) => setSellShares(Number(e.target.value))} style={{ width: 90, marginLeft: 6 }} /></label>
            <label>Sell price<input type="number" step="0.001" value={sellPrice || ''} onChange={(e) => setSellPrice(Number(e.target.value))} style={{ width: 90, marginLeft: 6 }} /></label>
            <label>Target profit ({currency}, optional)<input type="number" step="0.01" value={targetProfit || ''} onChange={(e) => setTargetProfit(Number(e.target.value))} style={{ width: 90, marginLeft: 6 }} /></label>
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
              <span className={realized >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(realized, currency)}</span> · Remaining{' '}
              {fmt(remainingShares, 0)} shares ({fmtMoney(remainingInvested, currency)} invested)
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label>Buy price<input type="number" step="0.001" value={buyPrice || ''} onChange={(e) => setBuyPrice(Number(e.target.value))} style={{ width: 90, marginLeft: 6 }} /></label>
            <label>New shares<input type="number" value={newShares || ''} onChange={(e) => setNewShares(Number(e.target.value))} style={{ width: 90, marginLeft: 6 }} /></label>
            <label>Amount<input type="number" step="0.01" value={buyAmount ? buyAmount.toFixed(2) : ''} onChange={(e) => setNewShares(buyPrice > 0 ? Number(e.target.value) / buyPrice : 0)} style={{ width: 100, marginLeft: 6 }} /></label>
            <label>Target avg cost (optional)<input type="number" step="0.001" value={targetAvg || ''} onChange={(e) => setTargetAvg(Number(e.target.value))} style={{ width: 90, marginLeft: 6 }} /></label>
            {mode === 'CYCLE' && (
              <label>Target sell price<input type="number" step="0.001" value={targetSell || ''} onChange={(e) => { setTargetSell(Number(e.target.value)); setTargetTouched(true); }} style={{ width: 90, marginLeft: 6 }} /></label>
            )}
          </div>
          {solvedSharesForAvg !== null && (
            <p className="footer-note">
              Buy ~{fmt(solvedSharesForAvg, 0)} shares to bring average cost to {fmtPrice(targetAvg)}{' '}
              <button className="btn secondary small" onClick={() => setNewShares(Math.round(solvedSharesForAvg))}>Use</button>
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
        Add {mode === 'SELL' ? 'sell' : mode === 'CYCLE' ? 'buy (cycle)' : 'buy'} to transactions
      </button>
      {mode === 'CYCLE' && (
        <p className="footer-note" style={{ marginTop: 4 }}>
          Only the buy leg is logged now — add the sell as its own transaction when you actually sell.
        </p>
      )}
    </div>
  );
}
