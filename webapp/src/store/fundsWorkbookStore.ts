import { createWorkbookStore } from './createWorkbookStore';
import { createEmptyFundsWorkbook } from './defaultFundsWorkbook';

/** Funds reuses the exact same factory QSE/PSX use — see FundsWorkbook's
 * own doc comment for why. Fund CRUD (add/update/delete a Fund, as opposed
 * to a Transaction) has no dedicated action since `createWorkbookStore`
 * doesn't know about the extra `funds` field — the Funds page mutates it
 * directly via the store's generic `setWorkbook`, which is exactly what
 * that action is for. */
export const useFundsWorkbookStore = createWorkbookStore('financerecorder_funds_workbook_v1', createEmptyFundsWorkbook);
