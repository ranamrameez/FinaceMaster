import type { FeeCalculator, Transaction } from '../../types/workbook';
import type { PSXSettings } from '../../types/psxWorkbook';

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

/** Full itemized PSX fee breakdown for one hypothetical leg — ported 1:1
 * from the legacy `calcFeeBreakdown()`. Commission is tiered: a flat
 * PKR/share rate at/under a low-price threshold, else a percentage of
 * trade value. CVT is buy-side only. Everything defaults to 0 except
 * commission/SST, which were checked against a real broker statement —
 * PSX/NCCPL/SECP/CDC/CVT rates vary by broker and aren't guessed at. */
export function calcFeeBreakdown(amount: number, isBuy: boolean, shares: number, settings: PSXSettings): PSXFeeBreakdown {
  const zero: PSXFeeBreakdown = { commission: 0, taxOnCommission: 0, psxFee: 0, nccplFee: 0, secpLevy: 0, cdc: 0, cvt: 0, total: 0 };
  if (amount <= 0) return zero;

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
  const cvt = isBuy ? amount * (settings.cvtPct / 100) : 0; // historically a buy-side stamp duty

  const rawTotal = commission + taxOnCommission + psxFee + nccplFee + secpLevy + cdc + cvt;
  const total = Math.max(round2(rawTotal), settings.minFee || 0);

  return {
    commission: round2(commission),
    taxOnCommission: round2(taxOnCommission),
    psxFee: round2(psxFee),
    nccplFee: round2(nccplFee),
    secpLevy: round2(secpLevy),
    cdc: round2(cdc),
    cvt: round2(cvt),
    total,
  };
}

/** README item 5: JS Bank (and most brokers) charge ~30% CGT for
 * non-filers vs 15% for filers — the legacy app hardcoded both to 15%.
 * This reads the two rates from settings and picks by `filerStatus`,
 * defaulting non-filer to 30% (see PSX_DEFAULT_SETTINGS). Positive gains
 * only — a loss generates neither a charge nor a rebate here. */
export function calcCGT(gain: number, settings: PSXSettings): number {
  if (!(gain > 0)) return 0;
  const rate = settings.filerStatus === 'nonfiler' ? settings.cgtNonFilerPct : settings.cgtFilerPct;
  return gain * (rate / 100);
}

/** README items 6/7: same-day (intraday) round-trips should only pay full
 * commission+SST on the LARGER side (buy qty vs sell qty for that ticker
 * on that date) — the smaller side nets against it and pays only the
 * government levies, not double commission. Ties go to BUY. Returns null
 * when there's no same-day pairing (normal both-sides commission). */
export function sameDayChargedSide(transactions: Transaction[], ticker: string, date: string): 'BUY' | 'SELL' | null {
  const dayTxs = transactions.filter((t) => t.ticker === ticker && t.date === date);
  const buyQty = dayTxs.filter((t) => t.action === 'BUY').reduce((s, t) => s + t.shares, 0);
  const sellQty = dayTxs.filter((t) => t.action === 'SELL').reduce((s, t) => s + t.shares, 0);
  if (buyQty <= 0 || sellQty <= 0) return null;
  return sellQty > buyQty ? 'SELL' : 'BUY';
}

/** README item 7: is this transaction's leg netted (government levies only,
 * no commission/SST)? True either when the user has manually flagged it
 * (`manualSameDay`, for when the recorded date doesn't line up with the
 * real trade day) or when the date-based auto-detection pairs it with an
 * opposite-side same-day trade. */
export function isNettedLeg(transactions: Transaction[], tx: Transaction): boolean {
  if (tx.manualSameDay) return true;
  const charged = sameDayChargedSide(transactions, tx.ticker, tx.date);
  return charged !== null && tx.action !== charged;
}

/** Builds a same-day-aware fee calculator over a fixed transaction list.
 * When called with a real transaction (`context.tx`), it looks up whether
 * that transaction's side is the one "charged" full commission for that
 * ticker+date, or the netted side (levies only) — see `isNettedLeg`. When
 * called without a `tx` (e.g. break-even/target-price what-ifs, where
 * there's no real same-day context yet), it falls back to modeling a
 * single hypothetical leg — matching the legacy calcFee()/
 * calcFeeBreakdown() split between "forward-looking calculators" and
 * "actual recorded transactions". */
export function makePSXFeeCalculator(settings: PSXSettings, allTransactions: Transaction[]): FeeCalculator {
  return (amount, isBuy, context) => {
    const shares = context?.shares ?? 0;
    const tx = context?.tx;
    if (!tx) return calcFeeBreakdown(amount, isBuy, shares, settings).total;

    if (!isNettedLeg(allTransactions, tx)) {
      return calcFeeBreakdown(amount, isBuy, shares, settings).total;
    }
    // Netted side: government levies only, no commission or SST.
    const fb = calcFeeBreakdown(amount, isBuy, shares, settings);
    return round2(fb.psxFee + fb.nccplFee + fb.secpLevy + fb.cdc + fb.cvt);
  };
}
