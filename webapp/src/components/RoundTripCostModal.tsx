import { Modal } from './Modal';
import { StatCard } from './Card';
import { fmtMoney, fmtPrice } from '../lib/format';
import { gridAutoStyle } from '../lib/gridStyle';

/** User-requested (2026-09-13): "visible on dashboard for opened stocks so
 * that I can quickly decide if today's fluctuation is worth trying. we can
 * show a popup to actually see this round trip total cost per current
 * price." Reuses `perShareCommission()` (already built for the Trade
 * Strategy page's "should I dive into the dip" helper) — this is just a
 * new, more prominent surface for the same number: the full commission
 * cost of buying then immediately selling 1 share at today's price, a
 * size-independent sanity check the user compares against today's own
 * price swing before deciding whether a small move is worth trading. */
export function RoundTripCostModal({
  ticker,
  currency,
  currentPrice,
  buyFee,
  sellFee,
  onClose,
}: {
  ticker: string;
  currency: string;
  currentPrice: number;
  buyFee: number;
  sellFee: number;
  onClose: () => void;
}) {
  const total = buyFee + sellFee;
  const pct = currentPrice > 0 ? (total / currentPrice) * 100 : 0;
  return (
    <Modal title={`${ticker} — round-trip cost at current price`} onClose={onClose}>
      <p className="text-muted mb-sm">
        The full commission cost of buying then immediately selling 1 share at today's price ({fmtPrice(currentPrice)}) — a
        quick, size-independent sanity check before trading on a small move. If today's price swing is smaller than
        this, a round trip on it likely isn't worth the fees.
      </p>
      <div className="grid-auto" style={gridAutoStyle(140, 12)}>
        {/* fmtPrice, not fmtMoney: a cheap stock's true per-share commission
            can be a fraction of a cent (see perShareCommission()'s own doc
            comment) — fmtMoney's fixed 2dp would round it right back down
            to "0.00", re-creating the exact bug this feature exists to
            surface, so these three use the same variable-precision
            formatter the RT/RTC table lines already do. */}
        <StatCard label="Buy commission (1 share)" value={`${fmtPrice(buyFee)} ${currency}`} />
        <StatCard label="Sell commission (1 share)" value={`${fmtPrice(sellFee)} ${currency}`} />
        <StatCard label="Total round-trip cost" value={`${fmtPrice(total)} ${currency}`} hue="var(--loss)" />
        <StatCard label="Current price + round-trip cost" value={fmtMoney(currentPrice + total, currency)} />
        <StatCard label="As % of current price" value={`${pct.toFixed(2)}%`} />
      </div>
    </Modal>
  );
}
