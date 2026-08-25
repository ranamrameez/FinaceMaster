/** Cross-module net-worth aggregation — pure and store-agnostic. Each
 * module's own by-currency total (Cash's `cashBalanceByCurrency`, Bank's
 * `totalBalanceByCurrency`, etc.) is computed by its own calc file; this
 * just combines those already-computed maps, so it stays testable without
 * touching any Zustand store. Never blends amounts across currencies (no
 * live FX-rate source is assumed here) — conversion for display is a
 * separate, optional step done in the UI layer via lib/fx.ts. */

export interface NetWorthInputs {
  /** Assets: Cash balance, Bank total balance, QSE/PSX net worth (cash +
   * portfolio value, one currency each), Funds current market value. */
  cash: Record<string, number>;
  bank: Record<string, number>;
  qse: Record<string, number>;
  psx: Record<string, number>;
  funds: Record<string, number>;
  /** Personal Loans' net position: positive = others owe you (asset),
   * negative = you owe net (liability) — already signed, per
   * `personalLoansModule.ts`'s `netPositionByCurrency`. */
  personalLoansNet: Record<string, number>;
  /** EMI's outstanding balance per currency — always a liability. */
  emiOutstanding: Record<string, number>;
}

/** One module's contribution to a currency's net worth — surfaced so the UI
 * can show "grouped info of all finances" per currency (item 2 of a
 * 2026-08-26 user feedback batch) instead of only the summed Assets/
 * Liabilities/Net figures. Zero-amount modules are omitted by the caller
 * (a module a user never touched shouldn't clutter every currency's
 * breakdown), not filtered here — this function stays a pure combine step. */
export interface NetWorthBreakdownEntry {
  module: string;
  amount: number;
}

export interface CurrencyNetWorth {
  currency: string;
  assets: number;
  liabilities: number;
  net: number;
  breakdown: NetWorthBreakdownEntry[];
}

function mergeCurrencyKeys(...maps: Record<string, number>[]): string[] {
  const keys = new Set<string>();
  maps.forEach((m) => Object.keys(m).forEach((k) => keys.add(k)));
  return [...keys].sort();
}

export function computeNetWorthByCurrency(inputs: NetWorthInputs): CurrencyNetWorth[] {
  const { cash, bank, qse, psx, funds, personalLoansNet, emiOutstanding } = inputs;
  const currencies = mergeCurrencyKeys(cash, bank, qse, psx, funds, personalLoansNet, emiOutstanding);

  return currencies.map((currency) => {
    const loanNet = personalLoansNet[currency] ?? 0;
    const emi = emiOutstanding[currency] ?? 0;
    const assets =
      (cash[currency] ?? 0) +
      (bank[currency] ?? 0) +
      (qse[currency] ?? 0) +
      (psx[currency] ?? 0) +
      (funds[currency] ?? 0) +
      Math.max(loanNet, 0);
    const liabilities = emi + Math.max(-loanNet, 0);
    const breakdown: NetWorthBreakdownEntry[] = [
      { module: 'Cash', amount: cash[currency] ?? 0 },
      { module: 'Bank', amount: bank[currency] ?? 0 },
      { module: 'Stocks (QSE)', amount: qse[currency] ?? 0 },
      { module: 'Stocks (PSX)', amount: psx[currency] ?? 0 },
      { module: 'Funds', amount: funds[currency] ?? 0 },
      { module: 'Personal Loans (net)', amount: loanNet },
      { module: 'EMI/Loans (outstanding)', amount: emi > 0 ? -emi : 0 },
    ].filter((b) => b.amount !== 0);
    return { currency, assets, liabilities, net: assets - liabilities, breakdown };
  });
}
