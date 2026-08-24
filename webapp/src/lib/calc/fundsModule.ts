import type { Fund } from '../../types/fundsWorkbook';
import type { Transaction } from '../../types/workbook';
import { computePositions } from './positions';
import { getMarketPrice } from './priceHistory';

const calcFee = () => 0; // NAV is already net of fund fees — see FundsWorkbook's doc comment

/** Current market value per fund currency — mirrors the per-fund value
 * computation already inline in FundsPage.tsx's `FundsSummary`, factored
 * out here so the Net Worth dashboard can reuse it without duplicating the
 * logic or depending on FundsPage's component internals. Deliberately
 * current *value*, not amount invested — net worth cares what it's worth
 * now, not what went in. */
export function fundsValueByCurrency(
  funds: Fund[],
  transactions: Transaction[],
  marketPrices: Record<string, number>,
): Record<string, number> {
  const positions = computePositions(transactions, calcFee);
  const out: Record<string, number> = {};
  funds.forEach((fund) => {
    const position = positions.find((p) => p.ticker === fund.id);
    const units = position?.shares ?? 0;
    const nav = getMarketPrice(fund.id, marketPrices, transactions);
    out[fund.currencyCode] = (out[fund.currencyCode] ?? 0) + units * nav;
  });
  return out;
}
