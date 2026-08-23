import type { CashSettings, CashWorkbook } from '../types/cashWorkbook';

export const DEFAULT_CASH_SETTINGS: CashSettings = {
  defaultCurrency: 'USD',
};

export function createEmptyCashWorkbook(): CashWorkbook {
  return {
    settings: { ...DEFAULT_CASH_SETTINGS },
    entries: [],
  };
}
