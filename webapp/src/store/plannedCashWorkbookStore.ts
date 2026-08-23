import { createEntryStore } from './createEntryStore';
import { createEmptyPlannedCashWorkbook } from './defaultPlannedCashWorkbook';

/** Cash's "what if" scenario planner (user request 2026-08-23) — a
 * separate store, own localStorage key/Firebase path, deliberately not
 * bolted onto `cashWorkbookStore.ts`'s existing `CashWorkbook` shape
 * (which only has room for one `entries` array via `createEntryStore`'s
 * generic factory). Keeping it independent means zero migration risk to
 * real users' existing Cash data — same reasoning already used for
 * `interEntityTransfersStore.ts`. */
export const usePlannedCashWorkbookStore = createEntryStore(
  'financerecorder_planned_cash_v1',
  createEmptyPlannedCashWorkbook,
);
