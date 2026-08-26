import { parseCSV } from '../csv';
import type { Fund } from '../../types/fundsWorkbook';
import type { Transaction } from '../../types/workbook';

/** One row of a "portfolio snapshot" export — total invested/withdrawn/
 * current-balance per fund, as opposed to a dated transaction log. Real
 * example: a user-maintained tracking spreadsheet summarizing several
 * Pakistani mutual fund platforms (MCB, Jazzcash, JS Zindagi). Column
 * order is fixed (this importer targets that one spreadsheet's shape, not
 * a general "map any CSV" importer like Bank/Cash's statement import) —
 * expects a header row containing "FundCode" somewhere. */
export interface FundSnapshotRow {
  bank: string;
  code: string;
  name: string;
  totalInvested: number;
  withdrawn: number;
  currentBalance: number;
  reportedPL: number;
  riskProfile: string;
}

type Cell = string | number | Date | null | undefined;

function parseAmount(raw: Cell): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string' || raw === '') return 0; // covers null/undefined/Date — none are amounts
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cellText(raw: Cell): string {
  return raw === null || raw === undefined ? '' : String(raw).trim();
}

/** Shared row-extraction for both the CSV export and the equivalent
 * "Summary" sheet inside a fuller xlsx workbook (`fundsDailyHistoryImport.ts`)
 * — xlsx cells arrive as native numbers, CSV cells as comma-formatted
 * strings, so every field goes through `parseAmount`/`cellText` rather than
 * assuming one or the other. Stops at the first "All Totals" row (or a row
 * missing a fund code/name) — everything below that in this spreadsheet's
 * real layout is an unrelated bank-balance summary table, not fund data. */
function extractSnapshotRows(rows: Cell[][]): FundSnapshotRow[] {
  const headerIndex = rows.findIndex((r) => r.some((c) => cellText(c).toLowerCase() === 'fundcode'));
  if (headerIndex === -1) return [];
  const out: FundSnapshotRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const [, bank, code, name, totalInvested, withdrawn, , currentBalance, pl, , riskProfile] = rows[i];
    if (!cellText(code) || !cellText(name) || cellText(name).toLowerCase() === 'all totals') break;
    out.push({
      bank: cellText(bank),
      code: cellText(code).toUpperCase(),
      name: cellText(name),
      totalInvested: parseAmount(totalInvested),
      withdrawn: parseAmount(withdrawn),
      currentBalance: parseAmount(currentBalance),
      reportedPL: parseAmount(pl),
      riskProfile: cellText(riskProfile),
    });
  }
  return out;
}

export function parseFundsSnapshotCSV(csvText: string): FundSnapshotRow[] {
  return extractSnapshotRows(parseCSV(csvText));
}

/** Same parser, for a Summary sheet already extracted from an xlsx
 * workbook as a 2D array of cell values (see `fundsDailyHistoryImport.ts`). */
export function parseFundsSnapshotRows(rows: Cell[][]): FundSnapshotRow[] {
  return extractSnapshotRows(rows);
}

export interface FundSnapshotPlanRow {
  row: FundSnapshotRow;
  fundId: string;
  isNewFund: boolean;
  buyShares: number;
  sellShares: number;
  sellNav: number;
  /** New NAV to record via `setMarketPrice` — null for a fully-closed
   * position (nothing left to price) or a zero-invested row. */
  navUpdate: number | null;
  closed: boolean;
}

/** Turns each snapshot row into synthetic buy/sell transactions at a
 * placeholder NAV of 1 per "unit" (so units == invested currency amount)
 * — a snapshot has no real per-transaction date/NAV history, only
 * aggregate invested/withdrawn/current-balance, so this reconstructs a
 * cost basis and current value that reconcile exactly with those three
 * numbers rather than guessing at real trade dates:
 *  - still-held position (currentBalance > 0): BUY `totalInvested` units
 *    @ NAV 1, optionally SELL `withdrawn` units @ NAV 1 (a withdrawal at
 *    cost — there's no way to know the real NAV the user withdrew at from
 *    a snapshot), then a NAV update so remaining units * new NAV ==
 *    currentBalance.
 *  - fully redeemed position (currentBalance == 0): BUY `totalInvested`
 *    units @ NAV 1, SELL the same units @ NAV = withdrawn/invested so
 *    sale proceeds == `withdrawn` exactly and realized P/L == withdrawn -
 *    invested (matches the source spreadsheet's own PL column on real
 *    data — see fundsSnapshotImport.test.ts).
 * Verified against the user's own real spreadsheet: summing each row's
 * resulting current value exactly reproduces that spreadsheet's own
 * "All Totals" Current Balance figure. */
export function buildFundsImportPlan(rows: FundSnapshotRow[], existingFunds: Fund[]): FundSnapshotPlanRow[] {
  return rows.map((row) => {
    const existing = existingFunds.find((f) => f.code.toUpperCase() === row.code);
    const fundId = existing?.id ?? crypto.randomUUID();
    const invested = row.totalInvested;
    const withdrawn = row.withdrawn;
    const closed = invested > 0 && row.currentBalance === 0;

    let sellShares = 0;
    let sellNav = 1;
    let navUpdate: number | null = null;

    if (invested > 0) {
      if (closed) {
        sellShares = invested;
        sellNav = withdrawn / invested;
      } else {
        sellShares = Math.min(withdrawn, invested);
        const remaining = invested - sellShares;
        navUpdate = remaining > 0 ? row.currentBalance / remaining : null;
      }
    }

    return { row, fundId, isNewFund: !existing, buyShares: invested, sellShares, sellNav, navUpdate, closed };
  });
}

export interface FundsImportResult {
  newFunds: Fund[];
  transactions: Transaction[];
  navUpdates: { ticker: string; price: number }[];
}

/** Materializes a plan (from `buildFundsImportPlan`, possibly user-edited
 * in the preview UI first) into store-ready records. `snapshotDate` is a
 * single placeholder date applied to every synthetic transaction — there's
 * no real per-fund date in a snapshot — and using one shared date for both
 * legs of a row is safe because same-day ordering always processes BUY
 * before SELL (see `sortTransactionsChronological`). */
export function materializeFundsImport(
  plan: FundSnapshotPlanRow[],
  opts: { snapshotDate: string; currencyCode: string; defaultCategory: Fund['category'] },
): FundsImportResult {
  const newFunds: Fund[] = [];
  const transactions: Transaction[] = [];
  const navUpdates: { ticker: string; price: number }[] = [];

  for (const p of plan) {
    if (p.isNewFund) {
      newFunds.push({
        id: p.fundId,
        name: p.row.name,
        code: p.row.code,
        platform: p.row.bank,
        category: opts.defaultCategory,
        currencyCode: opts.currencyCode,
      });
    }
    if (p.buyShares > 0) {
      transactions.push({ id: crypto.randomUUID(), date: opts.snapshotDate, ticker: p.fundId, action: 'BUY', shares: p.buyShares, price: 1 });
    }
    if (p.sellShares > 0) {
      transactions.push({ id: crypto.randomUUID(), date: opts.snapshotDate, ticker: p.fundId, action: 'SELL', shares: p.sellShares, price: p.sellNav });
    }
    if (p.navUpdate !== null && p.navUpdate > 0) {
      navUpdates.push({ ticker: p.fundId, price: p.navUpdate });
    }
  }

  return { newFunds, transactions, navUpdates };
}
