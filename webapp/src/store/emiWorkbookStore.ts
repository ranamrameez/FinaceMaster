import { createEntryStore } from './createEntryStore';
import { createEmptyEMIWorkbook } from './defaultEmiWorkbook';

export const useEMIWorkbookStore = createEntryStore('financerecorder_emi_workbook_v1', createEmptyEMIWorkbook);
