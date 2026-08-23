export interface CashFlow {
  date: Date;
  amount: number;
}

/** Extended Internal Rate of Return — annualized return accounting for the
 * size and timing of each cash flow, not just totals. Newton-Raphson with
 * a bisection fallback (ported from `reference/finance-suite-prototype/`,
 * same algorithm). Returns `null` if there isn't at least one negative and
 * one positive flow (no rate can satisfy that), or if neither method
 * converges. Exchange/module-agnostic — usable anywhere cash flows exist
 * (Funds today; could improve QSE/PSX's own return-percentage displays
 * later, a separate decision). */
export function xirr(cashFlows: CashFlow[]): number | null {
  if (!cashFlows || cashFlows.length < 2) return null;
  if (!cashFlows.some((c) => c.amount < 0) || !cashFlows.some((c) => c.amount > 0)) return null;

  const t0 = cashFlows[0].date.getTime();
  const yrs = cashFlows.map((c) => (c.date.getTime() - t0) / (365 * 24 * 3600 * 1000));
  const npv = (r: number) => cashFlows.reduce((s, c, i) => s + c.amount / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = (r: number) => cashFlows.reduce((s, c, i) => s - (yrs[i] * c.amount) / Math.pow(1 + r, yrs[i] + 1), 0);

  let rate = 0.15;
  let ok = false;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (Math.abs(df) < 1e-9) break;
    const next = rate - f / df;
    if (!isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - rate) < 1e-7) {
      rate = next;
      ok = true;
      break;
    }
    rate = next;
  }

  if (!ok || Math.abs(npv(rate)) > 1) {
    let lo = -0.9999;
    let hi = 20;
    let flo = npv(lo);
    const fhi = npv(hi);
    if (flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fm = npv(mid);
      if (Math.abs(fm) < 1e-6) {
        rate = mid;
        break;
      }
      if (flo * fm < 0) hi = mid;
      else {
        lo = mid;
        flo = fm;
      }
      rate = (lo + hi) / 2;
    }
  }
  return isFinite(rate) ? rate : null;
}
