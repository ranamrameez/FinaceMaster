import type { PlannedCashSettings, PlannedCashWorkbook } from '../types/plannedCash';

export const DEFAULT_PLANNED_CASH_SETTINGS: PlannedCashSettings = {
  showRealBalance: true,
  showPlannedBalance: true,
};

export function createEmptyPlannedCashWorkbook(): PlannedCashWorkbook {
  return {
    settings: { ...DEFAULT_PLANNED_CASH_SETTINGS },
    entries: [],
  };
}
