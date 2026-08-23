import { createWorkbookStore } from './createWorkbookStore';
import { createEmptyWorkbook } from './defaultWorkbook';

export const useWorkbookStore = createWorkbookStore('financerecorder_qse_workbook_v1', createEmptyWorkbook);
