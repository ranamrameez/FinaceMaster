import type { PersonalLoansSettings, PersonalLoansWorkbook } from '../types/personalLoansWorkbook';

export const DEFAULT_PERSONAL_LOANS_SETTINGS: PersonalLoansSettings = {
  defaultCurrency: 'USD',
};

export function createEmptyPersonalLoansWorkbook(): PersonalLoansWorkbook {
  return {
    settings: { ...DEFAULT_PERSONAL_LOANS_SETTINGS },
    loans: [],
    repayments: [],
  };
}
