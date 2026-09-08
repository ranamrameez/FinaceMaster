import type { BankSettings, BankWorkbook } from '../types/bankWorkbook';

export const DEFAULT_BANK_SETTINGS: BankSettings = {
  accounts: [],
  banks: [],
};

export function createEmptyBankWorkbook(): BankWorkbook {
  return {
    settings: { ...DEFAULT_BANK_SETTINGS, accounts: [], banks: [] },
    transactions: [],
  };
}
