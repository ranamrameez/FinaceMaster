/** Implied per-unit NAV from a fund's current total balance, given the
 * units already held — used by `FundsPage.tsx`'s "Update balance" quick
 * action (`commitBalance`) for a user who tracks a fund's total balance
 * day-to-day rather than its per-unit NAV. Returns `null` when there are
 * no units to divide across (nothing held yet) — the caller should
 * require an initial investment first.
 *
 * This file used to also hold a full XLSX "Daily History Import" flow
 * (parse a whole workbook of per-fund daily-balance sheets, reconstruct a
 * synthetic buy/deposit history from the gaps between rows, merge it into
 * the workbook) — removed 2026-09-09 at the user's own explicit request
 * ("i have already provided all sample data and its imported in the app.
 * remove the excel headache now") once their real data no longer needed
 * that one-time import path. Only this standalone helper survived, since
 * it's still used by the ongoing "Update balance" feature, unrelated to
 * Excel parsing. The removed code (and the `xlsx`/SheetJS dependency it
 * pulled in, which CLAUDE.md's own history flagged as carrying an
 * unresolved `npm audit` advisory) is still in git history if a future
 * session ever needs a similar bulk-import feature again — see this
 * repo's history around 2026-08-26 ("Funds Daily History Import built"). */
export function impliedFundNav(balance: number, units: number): number | null {
  if (units <= 0) return null;
  return balance / units;
}
