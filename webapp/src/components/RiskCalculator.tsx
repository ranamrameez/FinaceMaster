import { useEffect, useMemo, useState } from 'react';
import {
  closestScenario,
  computeAveragingScenarios,
  currentPositionMetrics,
  findDiminishingReturnPoint,
  stressTestScenario,
  type RiskMode,
} from '../lib/calc/riskAnalysis';
import { fmt, fmtMoney, fmtPrice } from '../lib/format';
import type { FeeCalculator } from '../types/workbook';
import { Card, StatCard } from './Card';
import { Notice } from './Notice';
import { Tooltip } from './Tooltip';
import { Field, Select, TextInput } from './ui/Field';
import { HUES, hueStyle } from '../lib/statCardHues';

export interface RiskCalculatorRow {
  ticker: string;
  shares: number;
  invested: number;
  marketPrice: number;
}

/** README item 20 / MODULES_PLAN.md §9: native averaging-down / risk
 * planner, shared by QSE and PSX (each supplies its own rows/fee
 * calculator/settings) — see lib/calc/riskAnalysis.ts for the calc engine
 * and what changed vs. the legacy Risk_Analysis_Calculator.html this
 * replaces. Only meaningful for an existing open position (averaging down
 * requires something to average), so the ticker picker only lists held
 * tickers, unlike the Trade Calculator which also covers brand-new
 * positions. */
export function RiskCalculator({
  rows,
  tickerNames,
  currency,
  feePct,
  tick,
  calcFee,
}: {
  rows: RiskCalculatorRow[];
  tickerNames: Record<string, string>;
  currency: string;
  feePct: number;
  tick: number;
  calcFee: FeeCalculator;
}) {
  const held = useMemo(() => [...rows].filter((r) => r.shares > 0).sort((a, b) => a.ticker.localeCompare(b.ticker)), [rows]);
  const [ticker, setTicker] = useState('');
  const [riskMode, setRiskMode] = useState<RiskMode>('balanced');
  const [currentPriceInput, setCurrentPriceInput] = useState(0);
  const [sharesInput, setSharesInput] = useState(0);
  const [avgInput, setAvgInput] = useState(0);
  // README item 1 (user-reported): a single "Additional capital" number
  // couldn't model a real order — averaging down is usually a specific
  // limit price, not necessarily today's live price. Replaced with a
  // price/shares/amount trio, same 2-of-3 linked-input pattern already
  // used by TradeCalculator's Buy price/New shares/Amount row: whichever
  // field the user isn't actively typing into gets recalculated.
  // `targetAmountInput` is a string (not a number) for the same reason
  // TradeCalculator's Amount field is — a `.toFixed(2)`-formatted value
  // re-set on every keystroke makes multi-digit typing impossible.
  const [targetPrice, setTargetPrice] = useState(0);
  const [targetShares, setTargetShares] = useState(0);
  const [targetAmountInput, setTargetAmountInput] = useState('500');
  const targetAmount = Number(targetAmountInput) || 0;
  const [target, setTarget] = useState(0);
  const [minProfit, setMinProfit] = useState(5);
  const [stressPct, setStressPct] = useState(10);

  const row = held.find((r) => r.ticker === ticker);

  useEffect(() => {
    if (!ticker && held.length) setTicker(held[0].ticker);
  }, [held, ticker]);

  // Re-prefill whenever the selected ticker changes, same pattern as
  // TradeCalculator — not on every recalculation, or typing would get
  // clobbered by the position's live numbers.
  useEffect(() => {
    if (!row) return;
    const avg = row.shares > 0 ? Math.round((row.invested / row.shares) * 100) / 100 : 0;
    const price = row.marketPrice || avg;
    setCurrentPriceInput(price);
    setSharesInput(Math.round(row.shares));
    setAvgInput(avg);
    setTargetPrice(price);
    setTargetAmountInput('500');
    setTargetShares(price > 0 ? Math.floor(500 / price) : 0);
    setMinProfit(5);
    setStressPct(10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const currentMetrics = useMemo(
    () =>
      sharesInput > 0
        ? currentPositionMetrics(sharesInput, avgInput, currentPriceInput, feePct, tick, calcFee, riskMode)
        : null,
    [sharesInput, avgInput, currentPriceInput, feePct, tick, calcFee, riskMode],
  );

  // Target defaults to the current break-even once known, but only until
  // the user actually types their own value.
  const [targetTouched, setTargetTouched] = useState(false);
  useEffect(() => {
    if (!targetTouched && currentMetrics) setTarget(currentMetrics.breakEven);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMetrics?.breakEven]);

  const scenarios = useMemo(
    () =>
      sharesInput > 0 && targetPrice > 0
        ? computeAveragingScenarios(targetAmount, targetPrice, sharesInput, avgInput, target, feePct, tick, calcFee)
        : [],
    [targetAmount, targetPrice, sharesInput, avgInput, target, feePct, tick, calcFee],
  );
  const best = closestScenario(scenarios, targetAmount);
  const diminishing = findDiminishingReturnPoint(scenarios);
  const stress = best ? stressTestScenario(best, targetPrice, stressPct, calcFee) : [];

  if (!held.length) {
    return (
      <Card>
        <p className="footer-note">No open positions to analyze yet — the Risk Calculator plans averaging into an
          existing position, so add a trade first.</p>
      </Card>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Stock">
            <Select value={ticker} onChange={(e) => { setTicker(e.target.value); setTargetTouched(false); }}>
              {held.map((r) => (
                <option key={r.ticker} value={r.ticker}>{r.ticker} — {tickerNames[r.ticker] || ''}</option>
              ))}
            </Select>
          </Field>
          <Field label="Risk mode" title="Only changes the suggested capital ceiling further down the page — it never changes the math or guarantees a recovery.">
            <Select value={riskMode} onChange={(e) => setRiskMode(e.target.value as RiskMode)}>
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </Select>
          </Field>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Field label="Current price" width={100}>
            <TextInput type="number" step="0.001" value={currentPriceInput || ''} onChange={(e) => setCurrentPriceInput(Number(e.target.value))} />
          </Field>
          <Field label="Shares held" width={90}>
            <TextInput type="number" value={sharesInput || ''} onChange={(e) => setSharesInput(Number(e.target.value))} />
          </Field>
          <Field label="Avg buy price" width={100} title="Pre-filled from your real position (invested ÷ shares). Editable so you can test a hypothetical average, but editing it doesn't change your actual holdings.">
            <TextInput type="number" step="0.001" value={avgInput || ''} onChange={(e) => setAvgInput(Number(e.target.value))} />
          </Field>
          <Field label="Target buy price" width={100} title="The price you're planning to add shares at — can differ from Current price above (e.g. a limit order below today's price).">
            <TextInput
              type="number"
              step="0.001"
              value={targetPrice || ''}
              onChange={(e) => {
                const price = Number(e.target.value);
                setTargetPrice(price);
                if (targetShares) setTargetAmountInput(price > 0 ? (targetShares * price).toFixed(2) : '');
              }}
            />
          </Field>
          <Field label="Target shares to buy" width={110}>
            <TextInput
              type="number"
              value={targetShares || ''}
              onChange={(e) => {
                const s = Number(e.target.value);
                setTargetShares(s);
                setTargetAmountInput(targetPrice > 0 && s ? (s * targetPrice).toFixed(2) : '');
              }}
            />
          </Field>
          <Field label="Target amount" width={110}>
            <TextInput
              type="number"
              step="10"
              value={targetAmountInput}
              onChange={(e) => {
                setTargetAmountInput(e.target.value);
                setTargetShares(targetPrice > 0 ? Number(e.target.value) / targetPrice : 0);
              }}
            />
          </Field>
          <Field label="Target sell price" width={100} title="Defaults to your current break-even, but editable — the price you'd actually plan to sell at once you've averaged down.">
            <TextInput type="number" step="0.001" value={target || ''} onChange={(e) => { setTarget(Number(e.target.value)); setTargetTouched(true); }} />
          </Field>
          <Field label={`Min net profit (${currency})`} width={100} title="The smallest profit (after fees) you'd consider worth it at Target sell price — used to flag whether a scenario actually clears your own bar.">
            <TextInput type="number" step="0.01" value={minProfit || ''} onChange={(e) => setMinProfit(Number(e.target.value))} />
          </Field>
          <Field label="Stress drawdown" width={90} title="How far the price would need to fall from here for the 'Stress' card below to show the resulting loss.">
            <Select value={stressPct} onChange={(e) => setStressPct(Number(e.target.value))}>
              <option value={5}>5%</option>
              <option value={10}>10%</option>
              <option value={15}>15%</option>
              <option value={20}>20%</option>
            </Select>
          </Field>
        </div>
        <p className="footer-note" style={{ marginTop: 8, marginBottom: 0 }}>
          Risk mode only changes the suggested capital ceiling below — it never overrides the math or guarantees
          recovery. Averaging down is not a recovery strategy by itself.
        </p>
      </Card>

      {currentMetrics && (
        <>
          <Notice tone={currentMetrics.netPL >= 0 ? 'success' : 'warning'} style={{ marginBottom: 16, marginTop: 0 }}>
            <b>{currentMetrics.netPL >= 0 ? 'Position is not currently underwater.' : 'Position is underwater — test capital before adding.'}</b>
            <br />
            Current net P/L is <b>{fmtMoney(currentMetrics.netPL, currency)}</b>.
            {best && (
              <> Adding {fmtMoney(best.add, currency)} changes the average to <b>{fmtPrice(best.newAvg)}</b>; break-even
                after fees becomes <b>{fmtPrice(best.breakEven)}</b>. {best.netAtTarget >= minProfit
                  ? 'The selected target meets the requested minimum net profit.'
                  : 'The selected target does not meet the requested minimum net profit.'}</>
            )}
          </Notice>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Current position</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
              <StatCard label="Invested" value={fmtMoney(currentMetrics.invested, currency)} hue={HUES[0]} labelTitle="Total cost basis of your current position, fees included." />
              <StatCard
                label="Break-even"
                value={fmtPrice(currentMetrics.breakEven)}
                hue={HUES[1]}
                labelTitle="The price this position needs to reach to fully recover its cost and fees — not a prediction, just the math."
              />
              <StatCard
                label="Recovery needed"
                value={`${fmt(currentMetrics.recoveryNeededPct, 2)}%`}
                hue={HUES[4]}
                labelTitle="How far the price needs to rise from here to reach break-even."
              />
              <div className="stat-card card" style={hueStyle(currentMetrics.netPL >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Current net P/L</div><div className="value">{fmtMoney(currentMetrics.netPL, currency)}</div></div>
              <StatCard
                label="Risk ceiling"
                value={fmtMoney(currentMetrics.ceiling, currency)}
                hue={HUES[3]}
                labelTitle="A suggested upper limit on how much more to add, scaled to your chosen risk mode — advisory only, never a rule or a guarantee."
              />
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Meaningful averaging points</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Add</th><th>Shares</th><th>New avg</th><th>New break-even</th>
                    <th><Tooltip text="How far the price needs to rise from the new average to reach the new break-even."><span style={{ cursor: 'pointer' }}>Recovery</span></Tooltip></th>
                    <th><Tooltip text="What you'd net (after fees) if you sold everything at Target sell price, using this scenario's new average cost."><span style={{ cursor: 'pointer' }}>Net P/L @ target</span></Tooltip></th>
                    <th><Tooltip text="Selected = closest to your Target amount above. Diminishing = past this point, adding more barely helps. Useful = still meaningfully improves your position."><span style={{ cursor: 'pointer' }}>Signal</span></Tooltip></th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => {
                    const isBest = best?.add === s.add;
                    const isDiminishing = diminishing?.add === s.add;
                    return (
                      <tr key={s.add} style={isBest ? { fontWeight: 700 } : undefined}>
                        <td>{fmtMoney(s.add, currency)}</td>
                        <td>{fmt(s.newShares, 0)}</td>
                        <td>{fmtPrice(s.newAvg)}</td>
                        <td>{fmtPrice(s.breakEven)}</td>
                        <td>{fmt(s.recoveryNeededPct, 2)}%</td>
                        <td style={{ padding: '10px 12px' }}><span className={s.netAtTarget >= 0 ? 'pill pill-buy' : 'pill pill-sell'}>{fmtMoney(s.netAtTarget, currency)}</span></td>
                        <td>
                          {isDiminishing ? (
                            <span className="pill pill-warn">⚠ Diminishing</span>
                          ) : isBest ? (
                            <span className="pill pill-info">✓ Selected</span>
                          ) : (
                            <span className="pill pill-buy">Useful</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!scenarios.length && <tr><td colSpan={7} className="footer-note">Not enough data to model scenarios.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Capital efficiency &amp; diminishing returns</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 10 }}>
              <StatCard label="Risk level" value={riskMode.toUpperCase()} hue={HUES[6]} labelTitle="Conservative/Balanced/Aggressive only changes the suggested ceiling above — never the math." />
              <StatCard
                label="Suggested ceiling"
                value={fmtMoney(currentMetrics.ceiling, currency)}
                hue={HUES[3]}
                labelTitle="Same suggested limit as the Current position card above, scaled by your risk mode — advisory only."
              />
              <StatCard
                label="Selected capital"
                value={best ? fmtMoney(best.add, currency) : '—'}
                hue={HUES[2]}
                labelTitle="Your Target amount above, matched to the closest step in the scenario table below."
              />
              <StatCard
                label="Stop averaging around"
                value={diminishing ? fmtMoney(diminishing.add, currency) : 'Not reached'}
                hue={HUES[5]}
                labelTitle="The point where adding more capital starts improving your required recovery by less than 0.25 percentage points — a signal to reconsider, not a hard stop."
              />
            </div>
            <Notice tone={diminishing ? 'warning' : 'info'} style={{ marginTop: 0, opacity: diminishing ? 1 : 0.7 }}>
              <b>{diminishing ? 'Diminishing-return warning.' : 'Capital still has measurable benefit.'}</b>{' '}
              {diminishing
                ? `Around ${fmtMoney(diminishing.add, currency)} the next tranche improves required recovery by less than 0.25 percentage points.`
                : 'The tested range has not crossed the configured diminishing-return threshold.'}
            </Notice>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Stress test after selected average</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px,1fr))', gap: 8 }}>
              {stress.map((p) => (
                <div key={p.label} className="stat-card card" style={hueStyle(p.pl >= 0 ? 'var(--profit)' : 'var(--loss)')}>
                  <div className="label">{p.label}</div>
                  <div className="value">{fmtMoney(p.pl, currency)}</div>
                </div>
              ))}
            </div>
            <p className="footer-note" style={{ marginTop: 8, marginBottom: 0 }}>
              Stress P/L includes the original position plus the selected additional purchase. A lower average can
              coexist with a larger monetary loss if the decline continues.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
