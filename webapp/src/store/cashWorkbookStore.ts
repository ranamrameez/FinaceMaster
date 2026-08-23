import { createEntryStore } from './createEntryStore';
import { createEmptyCashWorkbook } from './defaultCashWorkbook';

export const useCashWorkbookStore = createEntryStore('financerecorder_cash_workbook_v1', createEmptyCashWorkbook);
