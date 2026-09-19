import { describe, expect, it } from 'vitest';
import fixture from './fixtures/psx-workbook-backup.json';
import type { PSXSettings } from '../../../types/psxWorkbook';
import type { Transaction } from '../../../types/workbook';
import { computeFIFOPositions } from '../fifoPositions';
import { computePositions } from '../positions';
import { makePSXFeeCalculator } from '../psxFees';
import { makeQSEFeeCalculator } from '../fees';

// README item 8: FIFO lot matching should attribute cost basis to specific
// buy lots (oldest first) instead of blending every buy into one running
// average — hand-traced synthetic cases below, plus a sanity pass over the
// real backup fixture confirming the pipeline runs clean and genuinely
// differs from the weighted-average result once lots were bought at
// different prices (that's the whole point of the feature).

const NO_FEE_SETTINGS: PSXSettings = {
  feePct: 0,
  lowPriceThreshold: 0,
  lowPriceFee: 0,
  sstPct: 0,
  sstIncludedInCommission: true,
  psxFeePct: 0,
  nccplFeePct: 0,
  secpLevyPct: 0,
  cdcPerShare: 0,
  cvtPct: 0,
  minFee: 0,
  tick: 0.01,
  currency: 'PKR',
  depositFee: 0,
  cgtFilerPct: 15,
  cgtNonFilerPct: 30,
  filerStatus: 'filer',
  costBasisMethod: 'fifo',
};

const noFee = () => 0;

describe('computeFIFOPositions', () => {
  it('consumes the oldest lot first on a partial sell', () => {
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 10 },
      { date: '2026-02-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 20 },
      { date: '2026-03-01', ticker: 'TEST', action: 'SELL', shares: 150, price: 30 },
    ];
    const { positions, lotsByTicker } = computeFIFOPositions(txs, noFee);
    const p = positions.find((x) => x.ticker === 'TEST')!;

    // Sells 100 @ cost 10 (fully consumes lot 1) + 50 @ cost 20 (partial lot 2).
    const costRemoved = 100 * 10 + 50 * 20;
    const proceeds = 150 * 30;
    expect(p.realized).toBeCloseTo(proceeds - costRemoved, 5);

    // 50 shares left, all from the second (20/share) lot.
    expect(p.shares).toBe(50);
    expect(p.invested).toBeCloseTo(50 * 20, 5);
    expect(lotsByTicker.TEST).toHaveLength(1);
    expect(lotsByTicker.TEST[0]).toMatchObject({ buyPrice: 20, remainingShares: 50 });
  });

  it('differs from weighted-average when lots were bought at different prices', () => {
    // Same scenario as above: weighted-average blends to avg cost 15/share for
    // the sell, FIFO attributes the sell to the cheaper first lot — the two
    // methods must disagree here, or FIFO isn't doing anything.
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 10 },
      { date: '2026-02-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 20 },
      { date: '2026-03-01', ticker: 'TEST', action: 'SELL', shares: 100, price: 30 },
    ];
    const fifo = computeFIFOPositions(txs, noFee).positions.find((p) => p.ticker === 'TEST')!;
    const avg = computePositions(txs, noFee).find((p) => p.ticker === 'TEST')!;

    expect(fifo.realized).not.toBeCloseTo(avg.realized, 2);
    // FIFO: sold 100 @ cost 10 -> realized = 100*30 - 100*10 = 2000.
    expect(fifo.realized).toBeCloseTo(2000, 5);
    // Weighted-average: avg cost (100*10+100*20)/200=15 -> realized = 100*30-100*15=1500.
    expect(avg.realized).toBeCloseTo(1500, 5);
  });

  it('allocates each lot its own buy fee, divided per remaining share', () => {
    const feePerBuy = 50; // flat fee regardless of amount, for a simple hand-traceable case
    const calcFee = (_amount: number, isBuy: boolean) => (isBuy ? feePerBuy : 0);
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 10 }, // cost/share incl fee = 10 + 50/100 = 10.5
      { date: '2026-02-01', ticker: 'TEST', action: 'SELL', shares: 40, price: 30 },
    ];
    const { positions, lotsByTicker } = computeFIFOPositions(txs, calcFee);
    const p = positions.find((x) => x.ticker === 'TEST')!;

    expect(lotsByTicker.TEST[0].remainingShares).toBe(60);
    // Remaining 60 shares still carry the original lot's per-share fee allocation.
    expect(p.invested).toBeCloseTo(60 * 10.5, 5);
    // Sold 40 @ cost 10.5/share (fee-inclusive), no sell fee in this test's calcFee.
    expect(p.realized).toBeCloseTo(40 * 30 - 40 * 10.5, 5);
  });

  it('rejects an oversell (more sold than held) entirely, matching computePositions — never manufactures zero-cost profit for the excess', () => {
    // Both `computeFIFOPositions` and `computePositions` skip an invalid
    // oversell transaction wholesale (see each function's own oversell
    // guard/doc comment: "this app does not model short positions, so a
    // SELL larger than the currently-held quantity cannot legitimately
    // create zero-cost profit") — NOT a partial fill with the excess
    // treated as zero-cost, which an earlier version of this test wrongly
    // asserted (a stale expectation neither engine has ever actually
    // implemented; corrected 2026-09-18 while verifying an unrelated
    // change, matching `positions.ts`'s own passing "does not manufacture
    // profit from an oversell" test for the identical scenario).
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 10, price: 10 },
      { date: '2026-02-01', ticker: 'TEST', action: 'SELL', shares: 15, price: 20 },
    ];
    const { positions } = computeFIFOPositions(txs, noFee);
    const p = positions.find((x) => x.ticker === 'TEST')!;
    expect(p.shares).toBe(10);
    expect(p.invested).toBe(100);
    expect(p.realized).toBe(0);
    expect(p.totalSoldShares).toBe(0);
  });

  it('closes a same-day round trip correctly even when the SELL is entered before the matching BUY', () => {
    // Same root-cause bug as computePositions' equivalent test: with no
    // time-of-day on Transaction, a same-day SELL sitting before its
    // matching BUY in the array must not be processed against an
    // empty lot queue — this is exactly the user-reported scenario
    // (buy 2, sell 2, same day) that should net to a fully closed position.
    const sameDay: Transaction[] = [
      { date: '2026-08-24', ticker: 'ROUNDTRIP', action: 'SELL', shares: 2, price: 334.5 },
      { date: '2026-08-24', ticker: 'ROUNDTRIP', action: 'BUY', shares: 2, price: 330.5 },
    ];
    const { positions } = computeFIFOPositions(sameDay, noFee);
    const p = positions.find((x) => x.ticker === 'ROUNDTRIP')!;
    expect(p.shares).toBe(0);
    expect(p.invested).toBe(0);
    expect(p.realized).toBeCloseTo(669 - 661, 5);
  });

  describe('targetLotBuyId (specific lot identification, Partial Trade Strategy "Sell this lot")', () => {
    // The real IQCD case this exists for: 50 sh @10.40 (older, expensive) +
    // 14 sh @9.962 (newer, cheap) — a normal FIFO sell always drains the
    // OLDEST lot first, so selling exactly the cheap lot's 14 shares would
    // otherwise silently reduce the expensive lot instead, leaving a
    // misleading average cost/break-even for what's actually still held.
    const lots: Transaction[] = [
      { id: 'buy-old', date: '2026-01-01', ticker: 'IQCD', action: 'BUY', shares: 50, price: 10.4 },
      { id: 'buy-cheap', date: '2026-01-15', ticker: 'IQCD', action: 'BUY', shares: 14, price: 9.962 },
    ];

    it('without targetLotBuyId, a sell still drains the oldest lot first (unchanged default)', () => {
      const txs = [...lots, { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 14, price: 10.37 } as Transaction];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee);
      // The expensive lot lost 14 shares (36 left); the cheap lot is untouched.
      expect(lotsByTicker.IQCD).toEqual([
        expect.objectContaining({ buyId: 'buy-old', buyPrice: 10.4, remainingShares: 36 }),
        expect.objectContaining({ buyId: 'buy-cheap', buyPrice: 9.962, remainingShares: 14 }),
      ]);
    });

    it('with targetLotBuyId set, a sell closes that specific (non-oldest) lot instead, leaving the oldest lot untouched', () => {
      const txs = [
        ...lots,
        { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 14, price: 10.37, targetLotBuyId: 'buy-cheap' } as Transaction,
      ];
      const { positions, lotsByTicker } = computeFIFOPositions(txs, noFee);
      const p = positions.find((x) => x.ticker === 'IQCD')!;

      // The cheap lot is fully closed; only the expensive lot remains —
      // so avg cost / break-even for what's left is driven purely by the
      // 50-share @10.40 lot, not a blended or misattributed figure.
      expect(lotsByTicker.IQCD).toHaveLength(1);
      expect(lotsByTicker.IQCD[0]).toMatchObject({ buyId: 'buy-old', buyPrice: 10.4, remainingShares: 50 });
      expect(p.shares).toBe(50);
      expect(p.invested).toBeCloseTo(50 * 10.4, 5);
      // Realized P/L is priced off the CHEAP lot's own cost, not the old lot's.
      expect(p.realized).toBeCloseTo(14 * 10.37 - 14 * 9.962, 5);
    });

    it('falls through to normal oldest-first FIFO for shares beyond what the targeted lot holds', () => {
      const txs = [
        ...lots,
        // Sells 20 shares targeting the 14-share cheap lot — the cheap lot
        // covers 14 of them, the remaining 6 fall through to the next
        // oldest lot in the normal queue (the expensive lot).
        { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 20, price: 10.37, targetLotBuyId: 'buy-cheap' } as Transaction,
      ];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee);
      expect(lotsByTicker.IQCD).toEqual([expect.objectContaining({ buyId: 'buy-old', remainingShares: 44 })]);
    });

    it('ignores an unmatched targetLotBuyId and falls back to normal oldest-first FIFO', () => {
      const txs = [...lots, { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 14, price: 10.37, targetLotBuyId: 'no-such-lot' } as Transaction];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee);
      expect(lotsByTicker.IQCD).toEqual([
        expect.objectContaining({ buyId: 'buy-old', remainingShares: 36 }),
        expect.objectContaining({ buyId: 'buy-cheap', remainingShares: 14 }),
      ]);
    });
  });

  describe("matchOrder: 'lowestCostFirst' (2026-09-13, real user-reported bug fix)", () => {
    it("with matchOrder omitted (default), a sell still drains the oldest lot first even when it's more expensive — unchanged behavior, protects PSX's real opt-in FIFO cost basis", () => {
      const txs: Transaction[] = [
        { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 50, price: 10.4 },
        { date: '2026-02-01', ticker: 'TEST', action: 'BUY', shares: 14, price: 9.962 },
        { date: '2026-03-01', ticker: 'TEST', action: 'SELL', shares: 20, price: 10.2 },
      ];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee);
      // Old, expensive lot is the one drained — the cheap lot is untouched.
      expect(lotsByTicker.TEST).toEqual([
        expect.objectContaining({ buyPrice: 10.4, remainingShares: 30 }),
        expect.objectContaining({ buyPrice: 9.962, remainingShares: 14 }),
      ]);
    });

    it("with matchOrder: 'lowestCostFirst', a sell drains the cheapest available lot first regardless of buy date", () => {
      const txs: Transaction[] = [
        { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 50, price: 10.4 },
        { date: '2026-02-01', ticker: 'TEST', action: 'BUY', shares: 14, price: 9.962 },
        { date: '2026-03-01', ticker: 'TEST', action: 'SELL', shares: 20, price: 10.2 },
      ];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee, 'lowestCostFirst');
      // Cheap lot (9.962) is fully drained first (14 sh), remaining 6 sh fall
      // through to the only lot left (10.4) — leaving the EXPENSIVE lot open.
      expect(lotsByTicker.TEST).toEqual([expect.objectContaining({ buyPrice: 10.4, remainingShares: 44 })]);
    });

    it('reproduces the real reported IQCD bug: FIFO wrongly leaves cheap lots open (triggering a wrong "sell the cheap ones" suggestion); lowestCostFirst correctly leaves the losing expensive lot open instead', () => {
      // Real transaction sequence from the user's own uploaded QSE backup
      // (2026-09-13) that produced the reported wrong "13 of 13 shares
      // already profitable, sell them" advice — the app had drained the
      // 50 sh @10.40 (expensive, bought first) lot down to nothing across
      // the real sells, leaving the two cheap lots (9.962, 10.08) as the
      // "still open, already profitable at mkt 10.20" remainder, exactly
      // backwards from what actually happened: the user sold shares at a
      // real loss while the truly loss-making expensive lot sat untouched.
      const calcFee = makeQSEFeeCalculator({ feePct: 0.275, minFee: 0 });
      const txs: Transaction[] = [
        { date: '2026-08-10', ticker: 'IQCD', action: 'BUY', shares: 50, price: 10.4 },
        { date: '2026-09-01', ticker: 'IQCD', action: 'BUY', shares: 14, price: 9.962 },
        { date: '2026-09-07', ticker: 'IQCD', action: 'SELL', shares: 20, price: 10.02 },
        { date: '2026-09-08', ticker: 'IQCD', action: 'SELL', shares: 5, price: 10.37 },
        { date: '2026-09-08', ticker: 'IQCD', action: 'SELL', shares: 2, price: 10.37 },
        { date: '2026-09-08', ticker: 'IQCD', action: 'SELL', shares: 1, price: 10.37 },
        { date: '2026-09-09', ticker: 'IQCD', action: 'BUY', shares: 1, price: 10.08 },
        { date: '2026-09-09', ticker: 'IQCD', action: 'BUY', shares: 1, price: 10.08 },
        { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 6, price: 10.25 },
        { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 10, price: 10.25 },
        { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 6, price: 10.26 },
        { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 3, price: 10.26 },
      ];

      // The bug: default (oldest-first) FIFO leaves the two CHEAP lots open
      // (13 sh total, split 11@9.962 + 1@10.08 + 1@10.08) — every one of
      // them clears its own break-even at the real 10.20 market price,
      // which is exactly what produced the wrong "sell all 13, they're
      // profitable" suggestion.
      const buggy = computeFIFOPositions(txs, calcFee);
      const buggyLots = buggy.lotsByTicker.IQCD;
      expect(buggyLots.reduce((s, l) => s + l.remainingShares, 0)).toBe(13);
      expect(buggyLots.some((l) => l.buyPrice === 10.4)).toBe(false);
      expect(buggyLots.every((l) => l.buyPrice < 10.2)).toBe(true);

      // The fix: 'lowestCostFirst' correctly leaves the single EXPENSIVE
      // lot (13 sh @10.40) open instead — a real loss at the 10.20 market
      // price, correctly suggesting "hold," not "sell."
      const fixed = computeFIFOPositions(txs, calcFee, 'lowestCostFirst');
      const fixedLots = fixed.lotsByTicker.IQCD;
      expect(fixedLots).toHaveLength(1);
      expect(fixedLots[0]).toMatchObject({ buyPrice: 10.4, remainingShares: 13 });
    });

    it('still lets targetLotBuyId take priority over lowestCostFirst, with any remainder falling through to lowest-cost among what is left', () => {
      const txs: Transaction[] = [
        { id: 'buy-old', date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 10, price: 5 },
        { id: 'buy-mid', date: '2026-02-01', ticker: 'TEST', action: 'BUY', shares: 10, price: 8 },
        {
          date: '2026-03-01', ticker: 'TEST', action: 'SELL', shares: 15, price: 20,
          targetLotBuyId: 'buy-mid',
        } as Transaction,
      ];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee, 'lowestCostFirst');
      // Targeted lot (buy-mid, 10 sh @8) is fully drained first; the
      // remaining 5 sh fall through to whatever's left (buy-old @5), NOT
      // reselected by price since there's only one lot remaining anyway.
      expect(lotsByTicker.TEST).toEqual([expect.objectContaining({ buyId: 'buy-old', remainingShares: 5 })]);
    });
  });

  describe('canonical worked examples (2026-09-18, documented in webapp/README.md — keep these in sync)', () => {
    // The user's own repeated ask, verbatim: "I have already given examples
    // multiple times but maybe you didn't documented it. document examples
    // from now onwards as well as test cases." These 5 scenarios are the
    // permanent regression coverage for that documentation — see
    // webapp/README.md's "Cost-basis worked examples" section for the full
    // write-up and citations for why FIFO is now the recommended default
    // (real-world research: NCCPL mandates FIFO for PSX's own government
    // CGT computation; FIFO is also the global IRS/major-broker default).

    it('toy example (user\'s own words): buy 2@10.1, 2@10.15, 3@10.18, 1@10.4; sell all 8@10.18 -> FIFO consumes in buy order', () => {
      // Dates/prices happen to rise together here, so this example alone
      // does NOT distinguish FIFO from lowestCostFirst (both produce the
      // identical result) — paired with the next test, which does.
      const txs: Transaction[] = [
        { date: '2026-01-01', ticker: 'TOY', action: 'BUY', shares: 2, price: 10.1 },
        { date: '2026-01-02', ticker: 'TOY', action: 'BUY', shares: 2, price: 10.15 },
        { date: '2026-01-03', ticker: 'TOY', action: 'BUY', shares: 3, price: 10.18 },
        { date: '2026-01-04', ticker: 'TOY', action: 'BUY', shares: 1, price: 10.4 },
        { date: '2026-01-05', ticker: 'TOY', action: 'SELL', shares: 8, price: 10.18 },
      ];
      const fifo = computeFIFOPositions(txs, noFee, 'fifo').positions.find((p) => p.ticker === 'TOY')!;
      const lowest = computeFIFOPositions(txs, noFee, 'lowestCostFirst').positions.find((p) => p.ticker === 'TOY')!;
      const costRemoved = 2 * 10.1 + 2 * 10.15 + 3 * 10.18 + 1 * 10.4;
      expect(fifo.realized).toBeCloseTo(8 * 10.18 - costRemoved, 5);
      expect(lowest.realized).toBeCloseTo(fifo.realized, 5);
      expect(fifo.shares).toBe(0);
    });

    it('minimal FIFO-vs-lowestCostFirst distinguishing example: a later BUY that is cheaper than an earlier one', () => {
      const txs: Transaction[] = [
        { date: '2026-01-01', ticker: 'DIST', action: 'BUY', shares: 5, price: 12.0 }, // day 1, pricier
        { date: '2026-01-02', ticker: 'DIST', action: 'BUY', shares: 5, price: 10.0 }, // day 2, cheaper but later
        { date: '2026-01-03', ticker: 'DIST', action: 'SELL', shares: 5, price: 11.0 },
      ];
      const fifo = computeFIFOPositions(txs, noFee, 'fifo');
      const lowest = computeFIFOPositions(txs, noFee, 'lowestCostFirst');
      // FIFO takes the OLDER (day-1, pricier) lot -> the cheaper day-2 lot survives untouched.
      expect(fifo.lotsByTicker.DIST).toEqual([expect.objectContaining({ buyPrice: 10.0, remainingShares: 5 })]);
      // lowestCostFirst takes the CHEAPER (day-2) lot -> the pricier day-1 lot survives untouched.
      expect(lowest.lotsByTicker.DIST).toEqual([expect.objectContaining({ buyPrice: 12.0, remainingShares: 5 })]);
    });

    it('real IQCD example under FIFO-as-official with no manual targeting: FIFO alone drains the EXPENSIVE lot, the opposite of what "Sell this lot" achieves', () => {
      // Reframes the existing targetLotBuyId IQCD scenario above under the
      // new recommended default: proves manual targeting still matters
      // even with FIFO as the honest default, since FIFO alone would
      // "protect" the cheap lot by accident, not the expensive one the
      // user actually wants to protect.
      const txs: Transaction[] = [
        { id: 'buy-old', date: '2026-01-01', ticker: 'IQCD', action: 'BUY', shares: 50, price: 10.4 },
        { id: 'buy-cheap', date: '2026-01-15', ticker: 'IQCD', action: 'BUY', shares: 14, price: 9.962 },
        { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 14, price: 10.37 },
      ];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee, 'fifo');
      expect(lotsByTicker.IQCD).toEqual([
        expect.objectContaining({ buyId: 'buy-old', remainingShares: 36 }),
        expect.objectContaining({ buyId: 'buy-cheap', remainingShares: 14 }),
      ]);
    });

    it('real QFLS example (user\'s own full transaction table): an exactly-matched round trip closes cleanly and cannot leak, regardless of match order', () => {
      // Verbatim from the user's real trade history (dates/shares/prices),
      // sorted chronologically ascending here for readability — the app
      // itself sorts internally, so entry order doesn't matter.
      const txs: Transaction[] = [
        { date: '2026-06-22', ticker: 'QFLS', action: 'BUY', shares: 14, price: 14.11 },
        { date: '2026-06-23', ticker: 'QFLS', action: 'SELL', shares: 14, price: 14.16 },
        { date: '2026-08-06', ticker: 'QFLS', action: 'BUY', shares: 25, price: 13.66 },
        { date: '2026-08-06', ticker: 'QFLS', action: 'BUY', shares: 50, price: 13.80 },
        { date: '2026-08-09', ticker: 'QFLS', action: 'BUY', shares: 49, price: 13.52 },
        { date: '2026-08-10', ticker: 'QFLS', action: 'BUY', shares: 100, price: 13.50 },
        { date: '2026-09-08', ticker: 'QFLS', action: 'BUY', shares: 16, price: 12.46 },
        { date: '2026-09-08', ticker: 'QFLS', action: 'BUY', shares: 5, price: 12.46 },
        { date: '2026-09-13', ticker: 'QFLS', action: 'BUY', shares: 10, price: 12.42 },
        { date: '2026-09-14', ticker: 'QFLS', action: 'SELL', shares: 10, price: 12.53 },
        { date: '2026-09-14', ticker: 'QFLS', action: 'SELL', shares: 21, price: 12.53 },
      ];

      for (const matchOrder of ['fifo', 'lowestCostFirst'] as const) {
        const { lotsByTicker } = computeFIFOPositions(txs, noFee, matchOrder);
        // The 06-22/06-23 round trip is an EXACT match (buy 14, sell 14) —
        // it fully closes and is spliced out before any later activity
        // even starts, so it cannot leak into anything below under either
        // match order: no lot at 14.11 survives, ever.
        expect(lotsByTicker.QFLS.some((l) => l.buyPrice === 14.11)).toBe(false);
      }

      // Official view (FIFO): the two 09-14 sells (31 sh total) drain the
      // OLDEST lots first (the 08-06 pair, 75 sh combined, more than
      // enough) — every lot from 08-09 onward is completely untouched.
      const fifo = computeFIFOPositions(txs, noFee, 'fifo').lotsByTicker.QFLS;
      const fifoAug06Remaining = fifo.filter((l) => l.buyDate === '2026-08-06').reduce((s, l) => s + l.remainingShares, 0);
      expect(fifoAug06Remaining).toBe(75 - 31); // 44 sh left, split across the two 08-06 lots
      expect(fifo).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ buyPrice: 13.52, remainingShares: 49 }),
          expect.objectContaining({ buyPrice: 13.5, remainingShares: 100 }),
          expect.objectContaining({ buyPrice: 12.46, remainingShares: 16 }),
          expect.objectContaining({ buyPrice: 12.46, remainingShares: 5 }),
          expect.objectContaining({ buyPrice: 12.42, remainingShares: 10 }),
        ]),
      );

      // Trader Strategy view (lowestCostFirst): the same two sells (31 sh)
      // instead drain the NEWEST/cheapest lots first — 09-13 (10 sh @12.42)
      // fully, then BOTH 09-08 lots (5 + 16 = 21 sh, exactly the remaining
      // need either way the two tie) — leaving every 08-06/08-09/08-10 lot
      // (the 4 priciest, 225 sh) completely untouched.
      const lowest = computeFIFOPositions(txs, noFee, 'lowestCostFirst').lotsByTicker.QFLS;
      expect(lowest).toHaveLength(4);
      expect(lowest).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ buyPrice: 13.66, remainingShares: 25 }),
          expect.objectContaining({ buyPrice: 13.8, remainingShares: 50 }),
          expect.objectContaining({ buyPrice: 13.52, remainingShares: 49 }),
          expect.objectContaining({ buyPrice: 13.5, remainingShares: 100 }),
        ]),
      );
      expect(lowest.some((l) => l.buyPrice === 12.46 || l.buyPrice === 12.42)).toBe(false);
    });

    it('new synthetic lotAllocations example: an arbitrary split matching neither FIFO nor lowestCostFirst', () => {
      // 3 lots, deliberately NOT ordered by date-equals-price: A is both
      // oldest AND cheapest (so both presets would pick it first), but the
      // user explicitly allocates the sale to skip it entirely — proving
      // the mechanism represents a truly arbitrary real composition, per
      // the user's own words: "I may sell in bulk completely different
      // figures from the lot system."
      const txs: Transaction[] = [
        { id: 'lot-a', date: '2026-01-01', ticker: 'ALLOC', action: 'BUY', shares: 10, price: 10 },
        { id: 'lot-b', date: '2026-02-01', ticker: 'ALLOC', action: 'BUY', shares: 10, price: 11 },
        { id: 'lot-c', date: '2026-03-01', ticker: 'ALLOC', action: 'BUY', shares: 10, price: 12 },
        {
          date: '2026-04-01', ticker: 'ALLOC', action: 'SELL', shares: 15, price: 20,
          lotAllocations: [{ buyId: 'lot-b', shares: 5 }, { buyId: 'lot-c', shares: 10 }],
        } as Transaction,
      ];
      const { lotsByTicker, positions } = computeFIFOPositions(txs, noFee, 'fifo');
      // Lot A (cheapest AND oldest) is untouched; B is partially drained; C is fully drained.
      expect(lotsByTicker.ALLOC).toEqual([
        expect.objectContaining({ buyId: 'lot-a', remainingShares: 10 }),
        expect.objectContaining({ buyId: 'lot-b', remainingShares: 5 }),
      ]);
      const p = positions.find((x) => x.ticker === 'ALLOC')!;
      // Realized = proceeds - (5 sh @11 + 10 sh @12), NOT the lowest-cost
      // 15 shares (which would have been all of A + 5 of B, a completely
      // different, wrong figure if lotAllocations weren't honored.
      expect(p.realized).toBeCloseTo(15 * 20 - (5 * 11 + 10 * 12), 5);
    });

    it('lotAllocations gracefully skips a stale/unknown buyId (already-closed or never-existed) and falls through to the default match order for it', () => {
      const txs: Transaction[] = [
        { id: 'lot-a', date: '2026-01-01', ticker: 'GRACE', action: 'BUY', shares: 10, price: 10 },
        {
          date: '2026-02-01', ticker: 'GRACE', action: 'SELL', shares: 6, price: 20,
          lotAllocations: [{ buyId: 'no-such-lot', shares: 4 }, { buyId: 'lot-a', shares: 2 }],
        } as Transaction,
      ];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee, 'fifo');
      // The bogus allocation contributes 0; the real 2-share allocation to
      // lot-a is honored; the remaining 4 shares (6 - 2) fall through to
      // the default match order, draining the only lot left (lot-a again).
      expect(lotsByTicker.GRACE).toEqual([expect.objectContaining({ buyId: 'lot-a', remainingShares: 4 })]);
    });
  });

  it('runs clean over the real PSX backup fixture and produces finite numbers', () => {
    const transactions = fixture.transactions as Transaction[];
    const calcFee = makePSXFeeCalculator(NO_FEE_SETTINGS, transactions);
    const { positions, realizedSeries } = computeFIFOPositions(transactions, calcFee);
    const tickers = new Set(transactions.map((t) => t.ticker));
    expect(positions.length).toBe(tickers.size);
    positions.forEach((p) => {
      expect(Number.isFinite(p.invested)).toBe(true);
      expect(Number.isFinite(p.realized)).toBe(true);
      expect(p.shares).toBeGreaterThanOrEqual(0);
    });
    realizedSeries.forEach((point) => expect(Number.isFinite(point.value)).toBe(true));
  });
});
