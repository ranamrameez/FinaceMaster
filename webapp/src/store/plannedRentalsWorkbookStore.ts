import { createEntryStore } from './createEntryStore';
import { createEmptyPlannedRentalsWorkbook } from './defaultPlannedRentalsWorkbook';

/** Rentals' "what if" / projected-income planner — see
 * `plannedCashWorkbookStore.ts`'s doc comment for the full reasoning
 * (independent store, no migration risk to `rentalsWorkbookStore.ts`'s
 * existing data). */
export const usePlannedRentalsWorkbookStore = createEntryStore(
  'financerecorder_planned_rentals_v1',
  createEmptyPlannedRentalsWorkbook,
);
