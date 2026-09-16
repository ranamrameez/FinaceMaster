import type { Adjustment, CashSummary, FeeCalculator, Position, Transaction, Transfer } from '../../types/workbook';
import { buildCashLedger, totalTransferFees } from './cashLedger';
import { computePositions } from './positions';
import { getMarketPrice } from './priceHistory';

/** Single all-in summary: actual cash, trading gains/losses and fees. Pending
 * and invalid oversell trades are excluded from actual cash/position ledgers. */
export function cashSummary(
  transactions: Transaction[],
  transfers: Transfer[],
  adjustments: Adjustment[],
  marketPrices: Record<string, number>,
  calcFee: FeeCalculator,
  positions: Position[] = computePositions(transactions, calcFee),
): CashSummary {
  const totalInward = transfers.filter((t) => t.type === 'DEPOSIT').reduce((s, t) => s + t.gross, 0);
  const totalOutward = transfers.filter((t) => t.type === 'WITHDRAWAL').reduce((s, t) => s + t.gross, 0);
  const transferFees = totalTransferFees(transfers);
  const totalRewards = (adjustments || []).reduce((s, a) => s + a.amount, 0);
  const tradingFees = positions.reduce((s, p) => s + p.buyFees + p.sellFees, 0);
  const realizedPL = positions.reduce((s, p) => s + p.realized, 0);

  let unrealizedPL = 0;
  let portfolioValue = 0;
  positions.filter((p) => p.shares > 0).forEach((p) => {
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
  const netPL = realizedPL + unrealizedPL - transferFees + totalRewards;

  const pendingCashImpact = transactions.filter((t) => t.isPending).reduce((sum, t) => {
    const amount = t.shares * t.price;
    const fee = calcFee(amount, t.action === 'BUY', { shares: t.shares, tx: t });
    return sum + (t.action === 'BUY' ? -(amount + fee) : amount - fee);
  }, 0);

  return { totalInward, totalOutward, transferFees, tradingFees, totalCharges, totalRewards, realizedPL, unrealizedPL, netPL, cashBalance, portfolioValue, netWorth, ledger, pendingCashImpact };
}
