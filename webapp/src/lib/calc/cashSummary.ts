import type { Adjustment, CashSummary, FeeCalculator, Transaction, Transfer } from '../../types/workbook';
import { buildCashLedger, totalTransferFees } from './cashLedger';
import { computePositions } from './positions';
import { getMarketPrice } from './priceHistory';

/** The single all-in summary: what actually happened to your money, trading
 * gains/losses and every fee included. Ported 1:1 from the legacy
 * `cashSummary()` in index.html. */
export function cashSummary(
  transactions: Transaction[],
  transfers: Transfer[],
  adjustments: Adjustment[],
  marketPrices: Record<string, number>,
  calcFee: FeeCalculator,
): CashSummary {
  const totalInward = transfers.filter((t) => t.type === 'DEPOSIT').reduce((s, t) => s + t.gross, 0);
  const totalOutward = transfers.filter((t) => t.type === 'WITHDRAWAL').reduce((s, t) => s + t.gross, 0);
  const transferFees = totalTransferFees(transfers);
  const totalRewards = (adjustments || []).reduce((s, a) => s + a.amount, 0);

  const positions = computePositions(transactions, calcFee); // includes closed tickers, needed for lifetime realized P/L
  const tradingFees = positions.reduce((s, p) => s + p.buyFees + p.sellFees, 0);
  const realizedPL = positions.reduce((s, p) => s + p.realized, 0);

  let unrealizedPL = 0;
  let portfolioValue = 0;
  positions
    .filter((p) => p.shares > 0)
    .forEach((p) => {
      const mp = getMarketPrice(p.ticker, marketPrices, transactions);
      const grossValue = p.shares * mp;
      const estSellFee = mp > 0 ? calcFee(grossValue, false, { shares: p.shares }) : 0;
      const netValue = grossValue - estSellFee;
      unrealizedPL += netValue - p.invested;
      portfolioValue += netValue;
    });

  const ledger = buildCashLedger(transactions, transfers, adjustments, calcFee);
  const cashBalance = ledger.length ? ledger[ledger.length - 1].balance : 0;
  const netWorth = cashBalance + portfolioValue;
  const totalCharges = transferFees + tradingFees;
  // buy/sell commissions are already inside realized/unrealized; transfer fees
  // aren't, so subtract them here; broker rewards are found money, so add them.
  const netPL = realizedPL + unrealizedPL - transferFees + totalRewards;

  return {
    totalInward,
    totalOutward,
    transferFees,
    tradingFees,
    totalCharges,
    totalRewards,
    realizedPL,
    unrealizedPL,
    netPL,
    cashBalance,
    portfolioValue,
    netWorth,
    ledger,
  };
}
