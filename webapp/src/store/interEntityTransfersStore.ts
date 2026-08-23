import { createEntryStore } from './createEntryStore';
import { createEmptyInterEntityWorkbook } from './defaultInterEntityWorkbook';

/** README item 19: the link records themselves (not the ledger entries
 * they create in Cash/Bank/QSE/PSX — those live in each module's own
 * store, as usual). Reuses `createEntryStore` since this is exactly its
 * "settings + one array of dated, id-addressed entries" shape. */
export const useInterEntityTransfersStore = createEntryStore(
  'financerecorder_inter_entity_transfers_v1',
  createEmptyInterEntityWorkbook,
);
