/** Cross-module net-worth aggregation. Amounts are never blended across currencies. */

export interface NetWorthInputs {
  cash: Record<string, number>;
  bank: Record<string, number>;
  qse: Record<string, number>;
  psx: Record<string, number>;
  funds: Record<string, number>;
  personalLoansNet: Record<string, number>;
  emiOutstanding: Record<string, number>;
  creditCards: Record<string, number>;
}

export interface NetWorthBreakdownEntry { module: string; amount: number; }
export interface CurrencyNetWorth { currency: string; assets: number; liabilities: number; net: number; breakdown: NetWorthBreakdownEntry[]; }

function mergeCurrencyKeys(...maps: Record<string, number>[]): string[] {
  const keys = new Set<string>();
  maps.forEach((m) => Object.keys(m).forEach((k) => keys.add(k)));
  return [...keys].sort();
}

export function mergeCurrencyTotals(...maps: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  maps.forEach((m) => Object.entries(m).forEach(([code, amount]) => { out[code] = (out[code] ?? 0) + amount; }));
  return out;
}

export function computeNetWorthByCurrency(inputs: NetWorthInputs): CurrencyNetWorth[] {
  const { cash, bank, qse, psx, funds, personalLoansNet, emiOutstanding, creditCards } = inputs;
  const currencies = mergeCurrencyKeys(cash, bank, qse, psx, funds, personalLoansNet, emiOutstanding, creditCards);
  return currencies.map((currency) => {
    const loanNet = personalLoansNet[currency] ?? 0;
    const emi = emiOutstanding[currency] ?? 0;
    const cardDebt = creditCards[currency] ?? 0;
    const assets = (cash[currency] ?? 0) + (bank[currency] ?? 0) + (qse[currency] ?? 0) + (psx[currency] ?? 0) + (funds[currency] ?? 0) + Math.max(loanNet, 0);
    const liabilities = emi + cardDebt + Math.max(-loanNet, 0);
    const breakdown: NetWorthBreakdownEntry[] = [
      { module: 'Cash', amount: cash[currency] ?? 0 },
      { module: 'Bank', amount: bank[currency] ?? 0 },
      { module: 'Stocks (QSE)', amount: qse[currency] ?? 0 },
      { module: 'Stocks (PSX)', amount: psx[currency] ?? 0 },
      { module: 'Funds', amount: funds[currency] ?? 0 },
      { module: 'Credit cards', amount: cardDebt > 0 ? -cardDebt : 0 },
      { module: 'Personal Loans (net)', amount: loanNet },
      { module: 'EMI/Loans (outstanding)', amount: emi > 0 ? -emi : 0 },
    ].filter((b) => b.amount !== 0);
    return { currency, assets, liabilities, net: assets - liabilities, breakdown };
  });
}

/** Date-range cash flow from cleared Cash/Bank activity. Pending entries are
 * excluded so "money moved" figures represent actual movement only. */
export function flowByCurrency(
  cashEntries: { date: string; isDeposit: boolean; amount: number; currencyCode: string; isPending?: boolean }[],
  bankAccounts: { id: string; currencyCode: string }[],
  bankTransactions: { accountId: string; date: string; amount: number; isPending?: boolean }[],
  fromDate: string,
  toDate: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  cashEntries.forEach((e) => {
    if (e.isPending || e.date < fromDate || e.date > toDate) return;
    const delta = e.isDeposit ? e.amount : -e.amount;
    out[e.currencyCode] = (out[e.currencyCode] ?? 0) + delta;
  });
  const accountCurrency = new Map(bankAccounts.map((a) => [a.id, a.currencyCode]));
  bankTransactions.forEach((t) => {
    if (t.isPending || t.date < fromDate || t.date > toDate) return;
    const code = accountCurrency.get(t.accountId);
    if (!code) return;
    out[code] = (out[code] ?? 0) + t.amount;
  });
  return out;
}

export interface FlowActivityItem { module: string; date: string; description: string; amount: number; accountName?: string; }

export function flowActivity(
  cashEntries: { date: string; isDeposit: boolean; amount: number; currencyCode: string; title?: string; isPending?: boolean }[],
  bankAccounts: { id: string; name: string; currencyCode: string }[],
  bankTransactions: { accountId: string; date: string; amount: number; description: string; isPending?: boolean }[],
  currency: string,
  fromDate: string,
  toDate: string,
): FlowActivityItem[] {
  const items: FlowActivityItem[] = [];
  cashEntries.forEach((e) => {
    if (e.isPending || e.date < fromDate || e.date > toDate || e.currencyCode !== currency) return;
    items.push({ module: 'Cash', date: e.date, description: e.title || 'Cash entry', amount: e.isDeposit ? e.amount : -e.amount });
  });
  const accountsInCurrency = new Map(bankAccounts.filter((a) => a.currencyCode === currency).map((a) => [a.id, a.name]));
  bankTransactions.forEach((t) => {
    if (t.isPending || t.date < fromDate || t.date > toDate) return;
    const accountName = accountsInCurrency.get(t.accountId);
    if (!accountName) return;
    items.push({ module: 'Bank', date: t.date, description: t.description, amount: t.amount, accountName });
  });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
