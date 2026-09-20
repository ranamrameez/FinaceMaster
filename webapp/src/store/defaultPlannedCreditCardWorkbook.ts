import type { PlannedCreditCardSettings, PlannedCreditCardWorkbook } from '../types/plannedCreditCard';

export const DEFAULT_PLANNED_CREDIT_CARD_SETTINGS: PlannedCreditCardSettings = {
  showRealBalance: true,
  showPlannedBalance: true,
};

export function createEmptyPlannedCreditCardWorkbook(): PlannedCreditCardWorkbook {
  return {
    settings: { ...DEFAULT_PLANNED_CREDIT_CARD_SETTINGS },
    entries: [],
  };
}
