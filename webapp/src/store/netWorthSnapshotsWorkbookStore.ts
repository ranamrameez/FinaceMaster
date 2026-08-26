import { createEntryStore } from './createEntryStore';
import { createEmptyNetWorthSnapshotsWorkbook } from './defaultNetWorthSnapshotsWorkbook';

export const useNetWorthSnapshotsWorkbookStore = createEntryStore(
  'financerecorder_net_worth_snapshots_v1',
  createEmptyNetWorthSnapshotsWorkbook,
);
