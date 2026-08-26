import { describe, expect, it } from 'vitest';
import {
  averagePeriodPL,
  mergeDailyImportIntoWorkbook,
  parseDailyBalanceRows,
  reconstructFundDailyHistory,
  suggestFundMatch,
  type DailyBalanceRow,
  type WorkbookSlice,
} from '../fundsDailyHistoryImport';

/** Real daily rows from the user's own uploaded workbook
 * (Funds.PK.2026.ALDDF sheet) — no cash-flow gaps anywhere, a clean case
 * for verifying the reconstruction reproduces the real final balance
 * exactly. Final NewBlc (304143.43) and total organic PL (4143.43) both
 * match that same workbook's Summary sheet for this fund. */
const ALDDF_ROWS: DailyBalanceRow[] = [
  { date: '2026-07-07', prvBlc: 300000.0, newBlc: 301154.69, profitLoss: 1154.69 },
  { date: '2026-07-08', prvBlc: 301154.69, newBlc: 301223.02, profitLoss: 68.33 },
  { date: '2026-07-09', prvBlc: 301223.02, newBlc: 301351.12, profitLoss: 128.1 },
  { date: '2026-07-13', prvBlc: 301351.12, newBlc: 301542.62, profitLoss: 191.5 },
  { date: '2026-07-14', prvBlc: 301542.62, newBlc: 301607.03, profitLoss: 64.41 },
  { date: '2026-07-27', prvBlc: 301607.03, newBlc: 301798.14, profitLoss: 191.11 },
  { date: '2026-07-31', prvBlc: 301798.14, newBlc: 302688.31, profitLoss: 890.17 },
  { date: '2026-08-14', prvBlc: 302688.31, newBlc: 303500.72, profitLoss: 812.41 },
  { date: '2026-08-25', prvBlc: 303500.72, newBlc: 304143.43, profitLoss: 642.71 },
];

/** The FULL real daily rows from Funds.PK.2026.ALHCMOF (all 39 valid
 * entries, verbatim from the user's uploaded workbook) — has 8 genuine
 * cash-flow gaps (deposits between updates). Using every real row rather
 * than a hand-condensed subset avoids introducing arithmetic mistakes by
 * hand — the reconstruction is checked against the aggregate outcome
 * (final balance, deposit count, no unexpected sells) rather than
 * hand-verifying each individual gap. Final NewBlc (5790054.40) matches
 * that same workbook's Summary sheet for this fund. */
const ALHCMOF_ROWS: DailyBalanceRow[] = [
  { date: '2026-07-07', prvBlc: 650000.0, newBlc: 653832.45, profitLoss: 3832.45 },
  { date: '2026-07-08', prvBlc: 653832.45, newBlc: 653980.91, profitLoss: 148.46 },
  { date: '2026-07-09', prvBlc: 1571980.91, newBlc: 1573393.61, profitLoss: 1412.7 },
  { date: '2026-07-13', prvBlc: 1573393.61, newBlc: 1573884.42, profitLoss: 490.81 },
  { date: '2026-07-14', prvBlc: 1845384.42, newBlc: 1845943.26, profitLoss: 558.84 },
  { date: '2026-07-15', prvBlc: 1845943.26, newBlc: 1846438.36, profitLoss: 495.1 },
  { date: '2026-07-16', prvBlc: 1846438.36, newBlc: 1847004.72, profitLoss: 566.36 },
  { date: '2026-07-17', prvBlc: 1847004.72, newBlc: 1848577.75, profitLoss: 1573.03 },
  { date: '2026-07-20', prvBlc: 1848577.75, newBlc: 1849081.99, profitLoss: 504.24 },
  { date: '2026-07-21', prvBlc: 1849081.99, newBlc: 1849599.02, profitLoss: 517.03 },
  { date: '2026-07-22', prvBlc: 1849599.02, newBlc: 1850112.4, profitLoss: 513.38 },
  { date: '2026-07-23', prvBlc: 1912021.83, newBlc: 1912021.83, profitLoss: 0 },
  { date: '2026-07-24', prvBlc: 1912021.83, newBlc: 1913919.37, profitLoss: 1897.54 },
  { date: '2026-07-27', prvBlc: 1913919.37, newBlc: 1914499.02, profitLoss: 579.65 },
  { date: '2026-07-28', prvBlc: 1914499.02, newBlc: 1915059.79, profitLoss: 560.77 },
  { date: '2026-07-29', prvBlc: 1915059.79, newBlc: 1915594.12, profitLoss: 534.33 },
  { date: '2026-07-30', prvBlc: 1915594.12, newBlc: 1916139.79, profitLoss: 545.67 },
  { date: '2026-07-31', prvBlc: 2916139.79, newBlc: 2918927.68, profitLoss: 2787.89 },
  { date: '2026-08-03', prvBlc: 3518927.68, newBlc: 3519963.56, profitLoss: 1035.88 },
  { date: '2026-08-04', prvBlc: 3519963.56, newBlc: 3521002.9, profitLoss: 1039.34 },
  { date: '2026-08-05', prvBlc: 3521002.9, newBlc: 3522097.67, profitLoss: 1094.77 },
  { date: '2026-08-06', prvBlc: 3522097.67, newBlc: 3522974.18, profitLoss: 876.51 },
  { date: '2026-08-07', prvBlc: 3522974.18, newBlc: 3525437.42, profitLoss: 2463.24 },
  { date: '2026-08-10', prvBlc: 3525437.42, newBlc: 3526743.53, profitLoss: 1306.11 },
  { date: '2026-08-11', prvBlc: 3626743.53, newBlc: 3628212.79, profitLoss: 1469.26 },
  { date: '2026-08-12', prvBlc: 3628212.79, newBlc: 3629099.91, profitLoss: 887.12 },
  { date: '2026-08-13', prvBlc: 3769099.91, newBlc: 3773351.42, profitLoss: 4251.51 },
  { date: '2026-08-14', prvBlc: 3773351.42, newBlc: 3774417.07, profitLoss: 1065.65 },
  { date: '2026-08-15', prvBlc: 3774417.07, newBlc: 3774417.07, profitLoss: 0 },
  { date: '2026-08-16', prvBlc: 3774417.07, newBlc: 3774417.07, profitLoss: 0 },
  { date: '2026-08-17', prvBlc: 3774417.07, newBlc: 3774417.07, profitLoss: 0 },
  { date: '2026-08-18', prvBlc: 3774417.07, newBlc: 3775486.42, profitLoss: 1069.35 },
  { date: '2026-08-19', prvBlc: 3775486.42, newBlc: 3776548.37, profitLoss: 1061.95 },
  { date: '2026-08-20', prvBlc: 3778532.88, newBlc: 3779547.26, profitLoss: 1014.38 },
  { date: '2026-08-21', prvBlc: 5779547.26, newBlc: 5785077.79, profitLoss: 5530.53 },
  { date: '2026-08-22', prvBlc: 5785077.79, newBlc: 5785077.79, profitLoss: 0 },
  { date: '2026-08-23', prvBlc: 5785077.79, newBlc: 5785077.79, profitLoss: 0 },
  { date: '2026-08-24', prvBlc: 5785077.79, newBlc: 5786708.35, profitLoss: 1630.56 },
  { date: '2026-08-25', prvBlc: 5786708.35, newBlc: 5790054.4, profitLoss: 3346.05 },
];

describe('reconstructFundDailyHistory', () => {
  it('reconstructs a no-cash-flow fund to its exact real final balance and P/L', () => {
    const result = reconstructFundDailyHistory(ALDDF_ROWS);
    expect(result.transactions).toHaveLength(1); // only the initial buy
    expect(result.transactions[0]).toMatchObject({ action: 'BUY', shares: 300000, price: 1 });

    const finalNav = result.navPoints[result.navPoints.length - 1].price;
    expect(300000 * finalNav).toBeCloseTo(304143.43, 2);

    const totalOrganicPL = result.monthlyPL.reduce((s, m) => s + m.total, 0);
    expect(totalOrganicPL).toBeCloseTo(4143.43, 2);
    expect(result.warnings).toEqual([]);
  });

  it('separates real deposits from organic growth, reconstructing to the exact real final balance', () => {
    const result = reconstructFundDailyHistory(ALHCMOF_ROWS);
    // Initial buy + 9 deposits — matches the 9 real cash-flow gaps found by
    // independently scanning this fund's raw rows for PrvBlc/NewBlc
    // mismatches (see this session's own investigation, not re-derived
    // from the function under test).
    const buys = result.transactions.filter((t) => t.action === 'BUY');
    expect(buys).toHaveLength(10);
    expect(result.transactions.some((t) => t.action === 'SELL')).toBe(false);
    expect(result.warnings).toEqual([]);

    // Each buy's cash amount (shares * price) should be the real deposit
    // amount, not the raw unit count (units bought shrink as NAV rises).
    const cashAmounts = buys.map((b) => Math.round(b.shares * b.price));
    expect(cashAmounts).toEqual([650000, 918000, 271500, 61909, 1000000, 600000, 100000, 140000, 1985, 2000000]);

    const finalUnits = buys.reduce((s, b) => s + b.shares, 0);
    const finalNav = result.navPoints[result.navPoints.length - 1].price;
    expect(finalUnits * finalNav).toBeCloseTo(5790054.4, 1);
  });

  it('clamps a withdrawal that exceeds tracked units and warns, rather than going negative', () => {
    const rows: DailyBalanceRow[] = [
      { date: '2026-01-01', prvBlc: 500, newBlc: 500, profitLoss: 0 },
      // A data-entry mistake claiming a 1200 withdrawal against only 500 units held.
      { date: '2026-01-02', prvBlc: -700, newBlc: -700, profitLoss: 0 },
    ];
    const result = reconstructFundDailyHistory(rows);
    const sell = result.transactions.find((t) => t.action === 'SELL');
    expect(sell).toBeDefined();
    expect(sell!.shares).toBeLessThanOrEqual(500);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('treats a fund reopened after full redemption as a fresh buy at NAV 1, not a crash', () => {
    const rows: DailyBalanceRow[] = [
      { date: '2026-01-01', prvBlc: 1000, newBlc: 1000, profitLoss: 0 },
      { date: '2026-01-02', prvBlc: 0, newBlc: 0, profitLoss: 0 }, // fully redeemed
      { date: '2026-01-03', prvBlc: 500, newBlc: 505, profitLoss: 5 }, // re-funded
    ];
    const result = reconstructFundDailyHistory(rows);
    const buys = result.transactions.filter((t) => t.action === 'BUY');
    expect(buys).toHaveLength(2);
    expect(buys[1]).toMatchObject({ shares: 500, price: 1 });
    const finalNav = result.navPoints[result.navPoints.length - 1].price;
    expect(500 * finalNav).toBeCloseTo(505, 2);
  });
});

describe('averagePeriodPL', () => {
  it('averages only the real periods present, never padding with zero months', () => {
    expect(averagePeriodPL([{ total: 100 }, { total: 200 }, { total: 300 }])).toBeCloseTo(200, 6);
    expect(averagePeriodPL([])).toBe(0);
  });

  it('matches the real ALDDF monthly totals (2 real months of data)', () => {
    const result = reconstructFundDailyHistory(ALDDF_ROWS);
    expect(result.monthlyPL.map((m) => m.month)).toEqual(['2026-07', '2026-08']);
    const avg = averagePeriodPL(result.monthlyPL);
    const total = result.monthlyPL.reduce((s, m) => s + m.total, 0);
    expect(avg).toBeCloseTo(total / 2, 6);
  });
});

describe('parseDailyBalanceRows', () => {
  const header = ['Date', 'PrvBlc', 'NewBlc', 'Profit-Loss', 'NET PL'];

  it('parses valid rows and drops unfilled template rows (date present, no NewBlc)', () => {
    const data = [
      [new Date('2026-01-01'), 1000, 1010, 10, 10],
      [new Date('2026-01-02'), 1010, null, null, null], // unfilled — no NewBlc yet
      [new Date('2026-01-03'), null, null, null, null],
    ];
    const rows = parseDailyBalanceRows(header, data);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ date: '2026-01-01', prvBlc: 1000, newBlc: 1010, profitLoss: 10 });
  });

  it('returns null when the sheet is not a daily-balance log (no PrvBlc/NewBlc header)', () => {
    expect(parseDailyBalanceRows(['Index', 'Bank', 'FundCode'], [[1, 'a', 'b']])).toBeNull();
  });

  it('recognizes the header regardless of sheet name, matching by column text only', () => {
    // Sheet name in the real workbook ("ALIIF") doesn't match the fund's
    // real code ("ALHIIF") — parsing must not depend on it.
    const rows = parseDailyBalanceRows(header, [[new Date('2026-02-01'), 100, 105, 5, 5]]);
    expect(rows).toHaveLength(1);
  });
});

describe('suggestFundMatch', () => {
  const candidates = [
    { code: 'ALDDF', currentBalance: 304143.43 },
    { code: 'ALHISF', currentBalance: 0 },
    { code: 'ALHISF', currentBalance: 0 }, // real duplicate code in the user's own data
  ];

  it('matches uniquely when exactly one candidate has that balance', () => {
    expect(suggestFundMatch(304143.43, candidates)?.code).toBe('ALDDF');
  });

  it('refuses to guess when multiple candidates are indistinguishable', () => {
    expect(suggestFundMatch(0, candidates)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(suggestFundMatch(999999, candidates)).toBeNull();
  });
});

describe('mergeDailyImportIntoWorkbook', () => {
  const baseWorkbook: WorkbookSlice = {
    funds: [{ id: 'existing-1', name: 'Alhamra Cash', code: 'ALHCMOF', platform: 'MCB', category: 'Debt', currencyCode: 'PKR' }],
    transactions: [
      { id: 'old-tx-1', date: '2026-01-01', ticker: 'existing-1', action: 'BUY', shares: 5744445.04, price: 1 },
      { id: 'old-tx-2', date: '2026-08-25', ticker: 'other-fund', action: 'BUY', shares: 100, price: 1 }, // untouched
    ],
    marketPrices: { 'existing-1': 1.008 },
    priceHistory: { 'existing-1': [{ date: '2026-01-01', price: 1.008 }] },
  };

  it('REPLACES every existing transaction for a matched fund, leaving other funds untouched', () => {
    const result = mergeDailyImportIntoWorkbook(
      [
        {
          fundId: 'existing-1',
          reconstruction: {
            transactions: [
              { date: '2026-07-07', action: 'BUY', shares: 650000, price: 1 },
              { date: '2026-07-09', action: 'BUY', shares: 912394.9, price: 1.006 },
            ],
            navPoints: [{ date: '2026-07-07', price: 1.006 }, { date: '2026-08-25', price: 1.02 }],
            monthlyPL: [],
            yearlyPL: [],
            warnings: [],
          },
        },
      ],
      baseWorkbook,
    );

    const existingFundTxs = result.transactions.filter((t) => t.ticker === 'existing-1');
    expect(existingFundTxs).toHaveLength(2); // the single old snapshot-import buy is gone
    expect(existingFundTxs.some((t) => t.id === 'old-tx-1')).toBe(false);
    // The other fund's transaction is completely unaffected.
    expect(result.transactions.some((t) => t.id === 'old-tx-2')).toBe(true);
    expect(result.marketPrices['existing-1']).toBe(1.02);
    expect(result.priceHistory['existing-1']).toHaveLength(2);
    expect(result.funds).toHaveLength(1); // no new fund created
  });

  it('creates a new fund and adds its transactions without touching any existing fund', () => {
    const result = mergeDailyImportIntoWorkbook(
      [
        {
          fundId: 'new-1',
          newFund: { id: 'new-1', name: 'Salaam Investment', code: 'JCSLM', platform: 'Jazzcash', category: 'Debt', currencyCode: 'PKR' },
          reconstruction: {
            transactions: [{ date: '2026-08-14', action: 'BUY', shares: 50000, price: 1 }],
            navPoints: [{ date: '2026-08-14', price: 1.0002 }],
            monthlyPL: [],
            yearlyPL: [],
            warnings: [],
          },
        },
      ],
      baseWorkbook,
    );
    expect(result.funds).toHaveLength(2);
    expect(result.transactions.filter((t) => t.ticker === 'existing-1')).toHaveLength(1); // untouched
    expect(result.transactions.filter((t) => t.ticker === 'new-1')).toHaveLength(1);
    expect(result.marketPrices['new-1']).toBeCloseTo(1.0002, 6);
  });
});
