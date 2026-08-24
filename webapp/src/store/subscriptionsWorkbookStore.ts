import { createEntryStore } from './createEntryStore';
import { createEmptySubscriptionsWorkbook } from './defaultSubscriptionsWorkbook';

export const useSubscriptionsWorkbookStore = createEntryStore('financerecorder_subscriptions_workbook_v1', createEmptySubscriptionsWorkbook);
