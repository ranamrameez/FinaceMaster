import type { BankSettings, BankWorkbook } from '../types/bankWorkbook';

export const DEFAULT_BANK_SETTINGS: BankSettings = {
  accounts: [],
};

export function createEmptyBankWorkbook(): BankWorkbook {
  return {
    settings: { ...DEFAULT_BANK_SETTINGS, accounts: [] },
    transactions: [],
  };
}
