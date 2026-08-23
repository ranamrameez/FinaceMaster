import type { PlannedBankSettings, PlannedBankWorkbook } from '../types/plannedBank';

export const DEFAULT_PLANNED_BANK_SETTINGS: PlannedBankSettings = {
  showRealBalance: true,
  showPlannedBalance: true,
};

export function createEmptyPlannedBankWorkbook(): PlannedBankWorkbook {
  return {
    settings: { ...DEFAULT_PLANNED_BANK_SETTINGS },
    entries: [],
  };
}
