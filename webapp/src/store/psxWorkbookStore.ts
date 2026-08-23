import { createEmptyPSXWorkbook } from './defaultPsxWorkbook';
import { createWorkbookStore } from './createWorkbookStore';

export const usePSXWorkbookStore = createWorkbookStore('financerecorder_psx_workbook_v1', createEmptyPSXWorkbook);
