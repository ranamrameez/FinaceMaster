import { createEntryStore } from './createEntryStore';
import { createEmptyPlannedBankWorkbook } from './defaultPlannedBankWorkbook';

/** Banking's "what if" scenario planner — see `plannedCashWorkbookStore.ts`'s
 * doc comment for the full reasoning (independent store, no migration risk
 * to `bankWorkbookStore.ts`'s existing data). */
export const usePlannedBankWorkbookStore = createEntryStore(
  'financerecorder_planned_bank_v1',
  createEmptyPlannedBankWorkbook,
);
