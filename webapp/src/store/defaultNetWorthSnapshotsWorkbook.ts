import type { NetWorthSnapshotsWorkbook } from '../types/netWorthSnapshot';

export function createEmptyNetWorthSnapshotsWorkbook(): NetWorthSnapshotsWorkbook {
  return {
    settings: {},
    entries: [],
  };
}
