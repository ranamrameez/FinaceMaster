import { describe, expect, it } from 'vitest';
import { buildFundsImportPlan, materializeFundsImport, parseFundsSnapshotCSV } from '../fundsSnapshotImport';
import { computePositions } from '../positions';
import { getMarketPrice } from '../priceHistory';
import type { Fund } from '../../../types/fundsWorkbook';

const calcFee = () => 0;

/** The user's real, corrected snapshot data (row 6 originally mislabeled
 * "JS Cash Fund" — the user confirmed it's actually Alhamra Islamic Income
 * Fund, MCB Live & MCB iSave, ALHIIF). Trailing bank-balance table
 * (rows 15+ in the original file) is intentionally omitted here since
 * `parseFundsSnapshotCSV` never reads that far. */
const REAL_SNAPSHOT_CSV = `Index,Bank/ App,FundCode,Name,Total Invested,Withdrawn,Current Investment,Current Balance,PL,PL-Percentage,Risk Profile
1,MCB Live & MCB iSave,ALHCMO_GR-GRO,Alhamra Cash Management Optimzer Fund,"5,744,445",0,"5,744,445.04","5,790,054.40","45,609.36",0.794,Medium
2,MCB Live & MCB iSave,ALDDF,Alhamra Daily Dividend Fund,"300,000",0,"300,000.00","304,143.43","4,143.43",1.381,Medium
3,Jazzcash,JCSLM,Salaam Investment,"110,000","10,000","100,000.00","100,164.03",164.03,0.164,Low
4,JS Zindagi App,JCF,JS Cash Fund,"1,000","1,001",-1.00,0.00,1.00,0.020,High
5,MCB Live & MCB iSave,ALHIIF,Alhamrah Islamic Income Fund,"135,000","136,890","-1,890.00",0.00,"1,890.00",0.000,Low
6,MCB Live & MCB iSave,ALHISF,Alhamra Islamic Stock Fund,"1,000",984,16.49,0.00,-16.49,-1.649,High
7,MCB Live & MCB iSave,ALHISF,Alhamra Islamic Stock Fund,"1,000,000","962,871","37,128.78",0.00,"-37,128.78",-3.713,High
8,MCB Live & MCB iSave,ALHIAAF,Alhamra Islamic Asset Allocation Fund,"300,000","289,589","10,410.69",0.00,"-10,410.69",-3.470,High
,All Totals,,All Totals,"7,291,445","1,401,335","6,190,110.00","6,194,361.86","4,251.86",-6.473,

Index,Bank,Balance,Sum,Column 1,,,,,,
1,MCB Funds,"6,094,198","6,094,197.83",,,,,,,
`;

describe('parseFundsSnapshotCSV', () => {
  it('parses only the funds table, stopping at "All Totals"', () => {
    const rows = parseFundsSnapshotCSV(REAL_SNAPSHOT_CSV);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ code: 'ALHCMO_GR-GRO', name: 'Alhamra Cash Management Optimzer Fund', totalInvested: 5744445, withdrawn: 0, currentBalance: 5790054.4 });
    expect(rows[4]).toMatchObject({ code: 'ALHIIF', name: 'Alhamrah Islamic Income Fund', bank: 'MCB Live & MCB iSave', totalInvested: 135000, withdrawn: 136890, currentBalance: 0 });
  });

  it('returns nothing when there is no FundCode header', () => {
    expect(parseFundsSnapshotCSV('a,b,c\n1,2,3')).toEqual([]);
  });
});

describe('buildFundsImportPlan + materializeFundsImport', () => {
  const rows = parseFundsSnapshotCSV(REAL_SNAPSHOT_CSV);
  const plan = buildFundsImportPlan(rows, []);

  it('creates a new fund per row, all unmatched against an empty workbook', () => {
    expect(plan).toHaveLength(8);
    expect(plan.every((p) => p.isNewFund)).toBe(true);
  });

  it('keeps a still-open position\'s BUY/SELL/NAV reconciling to the real current balance (Salaam Investment, partial withdrawal)', () => {
    const p = plan.find((p) => p.row.code === 'JCSLM')!;
    expect(p.closed).toBe(false);
    expect(p.buyShares).toBe(110000);
    expect(p.sellShares).toBe(10000);
    expect(p.sellNav).toBe(1);
    // remaining units 100,000 * navUpdate should reproduce 100,164.03
    expect(p.navUpdate).not.toBeNull();
    expect(100000 * p.navUpdate!).toBeCloseTo(100164.03, 2);
  });

  it('fully closes a redeemed position with proceeds matching the withdrawn amount exactly (JS Cash Fund)', () => {
    const p = plan.find((p) => p.row.code === 'JCF')!;
    expect(p.closed).toBe(true);
    expect(p.buyShares).toBe(1000);
    expect(p.sellShares).toBe(1000);
    expect(p.sellShares * p.sellNav).toBeCloseTo(1001, 2); // == withdrawn
    expect(p.navUpdate).toBeNull();
  });

  it('reconciles realized P/L for a closed position to withdrawn - invested (matches the spreadsheet\'s own PL column)', () => {
    const p = plan.find((p) => p.row.code === 'ALHIAAF')!;
    const realizedPL = p.sellShares * p.sellNav - p.buyShares;
    expect(realizedPL).toBeCloseTo(-10411, 0); // spreadsheet's own PL: -10,410.69
  });

  it('produces two ALHISF funds (same code, two distinct real positions) rather than merging them', () => {
    const alhisfRows = plan.filter((p) => p.row.code === 'ALHISF');
    expect(alhisfRows).toHaveLength(2);
    // Both are new funds against an empty workbook — a real re-import
    // pass (existingFunds populated) would only match the FIRST by code;
    // this is a known, accepted limitation for a duplicate-code snapshot,
    // not something this importer silently gets wrong.
  });

  it('end to end: feeding the materialized transactions/NAV updates through the real calc engine reproduces the spreadsheet\'s own total current balance', () => {
    const { newFunds, transactions, navUpdates } = materializeFundsImport(plan, {
      snapshotDate: '2026-08-25',
      currencyCode: 'PKR',
      defaultCategory: 'Other',
    });
    expect(newFunds).toHaveLength(8);

    const marketPrices: Record<string, number> = {};
    navUpdates.forEach((u) => { marketPrices[u.ticker] = u.price; });

    const positions = computePositions(transactions, calcFee);
    let totalValue = 0;
    newFunds.forEach((f: Fund) => {
      const pos = positions.find((p) => p.ticker === f.id);
      const units = pos?.shares ?? 0;
      const nav = getMarketPrice(f.id, marketPrices, transactions);
      totalValue += units * nav;
    });

    // The spreadsheet's own "All Totals" Current Balance row.
    expect(totalValue).toBeCloseTo(6194361.86, 1);
  });
});
