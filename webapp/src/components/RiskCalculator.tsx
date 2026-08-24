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
import { Card } from './Card';
import { Notice } from './Notice';
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
  const [capital, setCapital] = useState(500);
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
    setCurrentPriceInput(row.marketPrice || avg);
    setSharesInput(Math.round(row.shares));
    setAvgInput(avg);
    setCapital(500);
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
      sharesInput > 0 && currentPriceInput > 0
        ? computeAveragingScenarios(capital, currentPriceInput, sharesInput, avgInput, target, feePct, tick, calcFee)
        : [],
    [capital, currentPriceInput, sharesInput, avgInput, target, feePct, tick, calcFee],
  );
  const best = closestScenario(scenarios, capital);
  const diminishing = findDiminishingReturnPoint(scenarios);
  const stress = best ? stressTestScenario(best, currentPriceInput, stressPct, calcFee) : [];

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
          <Field label="Risk mode">
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
          <Field label="Avg buy price" width={100}>
            <TextInput type="number" step="0.001" value={avgInput || ''} onChange={(e) => setAvgInput(Number(e.target.value))} />
          </Field>
          <Field label="Additional capital" width={100}>
            <TextInput type="number" step="10" value={capital || ''} onChange={(e) => setCapital(Number(e.target.value))} />
          </Field>
          <Field label="Target sell price" width={100}>
            <TextInput type="number" step="0.001" value={target || ''} onChange={(e) => { setTarget(Number(e.target.value)); setTargetTouched(true); }} />
          </Field>
          <Field label={`Min net profit (${currency})`} width={100}>
            <TextInput type="number" step="0.01" value={minProfit || ''} onChange={(e) => setMinProfit(Number(e.target.value))} />
          </Field>
          <Field label="Stress drawdown" width={90}>
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
              <div className="stat-card card" style={hueStyle(HUES[0])}><div className="label">Invested</div><div className="value">{fmtMoney(currentMetrics.invested, currency)}</div></div>
              <div className="stat-card card" style={hueStyle(HUES[1])}><div className="label">Break-even</div><div className="value">{fmtPrice(currentMetrics.breakEven)}</div></div>
              <div className="stat-card card" style={hueStyle(HUES[4])}><div className="label">Recovery needed</div><div className="value">{fmt(currentMetrics.recoveryNeededPct, 2)}%</div></div>
              <div className="stat-card card" style={hueStyle(currentMetrics.netPL >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Current net P/L</div><div className={`value ${currentMetrics.netPL >= 0 ? 'pill-buy' : 'pill-sell'}`}>{fmtMoney(currentMetrics.netPL, currency)}</div></div>
              <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Risk ceiling</div><div className="value">{fmtMoney(currentMetrics.ceiling, currency)}</div></div>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Meaningful averaging points</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Add</th><th>Shares</th><th>New avg</th><th>New break-even</th><th>Recovery</th>
                    <th>Net P/L @ target</th><th>Signal</th>
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
                        <td className={s.netAtTarget >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(s.netAtTarget, currency)}</td>
                        <td>{isDiminishing ? 'Diminishing' : isBest ? 'Selected' : 'Useful'}</td>
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
              <div className="stat-card card" style={hueStyle(HUES[6])}><div className="label">Risk level</div><div className="value">{riskMode.toUpperCase()}</div></div>
              <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Suggested ceiling</div><div className="value">{fmtMoney(currentMetrics.ceiling, currency)}</div></div>
              <div className="stat-card card" style={hueStyle(HUES[2])}><div className="label">Selected capital</div><div className="value">{best ? fmtMoney(best.add, currency) : '—'}</div></div>
              <div className="stat-card card" style={hueStyle(HUES[5])}><div className="label">Stop averaging around</div><div className="value">{diminishing ? fmtMoney(diminishing.add, currency) : 'Not reached'}</div></div>
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
                  <div className={`value ${p.pl >= 0 ? 'pill-buy' : 'pill-sell'}`}>{fmtMoney(p.pl, currency)}</div>
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
