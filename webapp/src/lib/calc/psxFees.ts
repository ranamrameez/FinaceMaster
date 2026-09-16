import type { FeeCalculator, Transaction } from '../../types/workbook';
import type { PSXSettings } from '../../types/psxWorkbook';
import { defaultTimezoneForMarket, todayISODate } from '../datetime';

export interface PSXFeeBreakdown {
  commission: number;
  taxOnCommission: number;
  psxFee: number;
  nccplFee: number;
  secpLevy: number;
  cdc: number;
  cvt: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcFeeBreakdown(amount: number, isBuy: boolean, shares: number, settings: PSXSettings): PSXFeeBreakdown {
  const zero: PSXFeeBreakdown = { commission: 0, taxOnCommission: 0, psxFee: 0, nccplFee: 0, secpLevy: 0, cdc: 0, cvt: 0, total: 0 };
  if (amount <= 0) return zero;
  if (settings.feeMode === 'simple') {
    const total = Math.max(round2(amount * ((settings.allInFeePct ?? 0) / 100)), settings.minFee || 0);
    return { ...zero, commission: total, total };
  }
  let commission: number;
  if (shares > 0) {
    const price = amount / shares;
    commission = price <= settings.lowPriceThreshold ? shares * settings.lowPriceFee : amount * (settings.feePct / 100);
  } else {
    commission = amount * (settings.feePct / 100);
  }
  const taxOnCommission = settings.sstIncludedInCommission ? 0 : commission * (settings.sstPct / 100);
  const psxFee = amount * (settings.psxFeePct / 100);
  const nccplFee = amount * (settings.nccplFeePct / 100);
  const secpLevy = amount * (settings.secpLevyPct / 100);
  const cdc = shares > 0 ? shares * settings.cdcPerShare : 0;
  const cvt = isBuy ? amount * (settings.cvtPct / 100) : 0;
  const rawTotal = commission + taxOnCommission + psxFee + nccplFee + secpLevy + cdc + cvt;
  const total = Math.max(round2(rawTotal), settings.minFee || 0);
  return { commission: round2(commission), taxOnCommission: round2(taxOnCommission), psxFee: round2(psxFee), nccplFee: round2(nccplFee), secpLevy: round2(secpLevy), cdc: round2(cdc), cvt: round2(cvt), total };
}

export function calcCGT(gain: number, settings: PSXSettings): number {
  if (!(gain > 0)) return 0;
  const rate = settings.filerStatus === 'nonfiler' ? settings.cgtNonFilerPct : settings.cgtFilerPct;
  return gain * (rate / 100);
}

/** Only filled/completed transactions participate in actual fee pairing.
 * Pending orders are hypothetical and must never change the fee of a filled
 * transaction merely by being present in the workbook. */
export function sameDayChargedSide(transactions: Transaction[], ticker: string, date: string): 'BUY' | 'SELL' | null {
  const dayTxs = transactions.filter((t) => !t.isPending && t.ticker === ticker && t.date === date);
  const buyQty = dayTxs.filter((t) => t.action === 'BUY').reduce((s, t) => s + t.shares, 0);
  const sellQty = dayTxs.filter((t) => t.action === 'SELL').reduce((s, t) => s + t.shares, 0);
  if (buyQty <= 0 || sellQty <= 0) return null;
  return sellQty > buyQty ? 'SELL' : 'BUY';
}

export function isNettedLeg(transactions: Transaction[], tx: Transaction): boolean {
  if (tx.manualSameDay) return true;
  const charged = sameDayChargedSide(transactions, tx.ticker, tx.date);
  return charged !== null && tx.action !== charged;
}

export function isProvisionalSameDayBuy(transactions: Transaction[], tx: Transaction): boolean {
  if (tx.action !== 'BUY') return false;
  if (tx.date !== todayISODate(defaultTimezoneForMarket('PSX'))) return false;
  return sameDayChargedSide(transactions, tx.ticker, tx.date) === null;
}

export function feeScenarios(amount: number, isBuy: boolean, shares: number, settings: PSXSettings): { full: number; netted: number } {
  const fb = calcFeeBreakdown(amount, isBuy, shares, settings);
  return { full: fb.total, netted: round2(fb.psxFee + fb.nccplFee + fb.secpLevy + fb.cdc + fb.cvt) };
}

export function makePSXFeeCalculator(settings: PSXSettings, allTransactions: Transaction[]): FeeCalculator {
  return (amount, isBuy, context) => {
    const shares = context?.shares ?? 0;
    const tx = context?.tx;
    if (tx?.feeOverride !== undefined) return tx.feeOverride;
    if (!tx) return calcFeeBreakdown(amount, isBuy, shares, settings).total;
    if (!tx.manualSameDay && isProvisionalSameDayBuy(allTransactions, tx)) return 0;
    if (!isNettedLeg(allTransactions, tx)) return calcFeeBreakdown(amount, isBuy, shares, settings).total;
    const fb = calcFeeBreakdown(amount, isBuy, shares, settings);
    return round2(fb.psxFee + fb.nccplFee + fb.secpLevy + fb.cdc + fb.cvt);
  };
}
