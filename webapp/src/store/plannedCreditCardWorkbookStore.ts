import { createEntryStore } from './createEntryStore';
import { createEmptyPlannedCreditCardWorkbook } from './defaultPlannedCreditCardWorkbook';

/** Credit Cards' "what if" scenario planner — see
 * `plannedBankWorkbookStore.ts`'s doc comment for the full reasoning
 * (independent store, no migration risk to `creditCardWorkbookStore.ts`'s
 * existing data). */
export const usePlannedCreditCardWorkbookStore = createEntryStore(
  'financerecorder_planned_credit_card_v1',
  createEmptyPlannedCreditCardWorkbook,
);
