import { create } from 'zustand';
import { toInstantMs } from '../lib/datetime';
import { assignSerialNumbersForEntities, backfillSerialNumber, nextSerialNumberForEntity } from '../lib/financeSerial';
import { resolveIsDeposit, resolveLegacyCategoryId } from '../lib/financeMigration';
import { createEmptyCashWorkbook } from './defaultCashWorkbook';
import type { CashEntry, CashSettings, CashWorkbook } from '../types/cashWorkbook';

const STORAGE_KEY = 'financerecorder_cash_workbook_v1';

/** `CashEntry` extends `Finance` (2026-09-03 restructure) — `isDeposit` is
 * the real, authoritative field here (the old `type: 'IN'|'OUT'` enum) for
 * every NEW write; this also derives it from the legacy `type` field for
 * real pre-restructure data that has no `isDeposit` at all (see
 * `CashEntry.type`'s own doc comment — caught via live testing, a genuine
 * regression risk, not a hypothetical), alongside the existing
 * `categoryID`/`timestamp` legacy-data fill-ins. */
function withDerivedFields(e: CashEntry): CashEntry {
  return {
    ...e,
    isDeposit: resolveIsDeposit(e.isDeposit, e.type, 'IN'),
    categoryID: e.categoryID ?? resolveLegacyCategoryId(e.category),
    timestamp: e.timestamp ?? new Date().toISOString(),
  };
}

/** Backfills `serialNumber` (see `Finance.serialNumber`'s doc comment) onto
 * any entry missing it, in real-instant chronological order. Cash used to
 * reuse the generic `createEntryStore` factory (see that file's own
 * comment) — pulled out into its own hand-written store, same idiom as
 * Bank/Rentals, once its sequence field became `serialNumber` (the
 * generic factory hardcodes `seq` for its other 2 callers, EMI and
 * Subscriptions, which stay untouched and out of scope for this
 * migration). */
function normalize(wb: CashWorkbook): CashWorkbook {
  const withFields = wb.entries.map(withDerivedFields);
  const chronological = [...withFields].sort(
    (a, b) => toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone),
  );
  return { ...wb, entries: backfillSerialNumber(withFields, chronological) };
}

interface CashStoreState {
  workbook: CashWorkbook;
  setWorkbook: (wb: CashWorkbook, opts?: { skipPersist?: boolean }) => void;
  addEntry: (entry: CashEntry) => void;
  addEntries: (entries: CashEntry[]) => void;
  updateEntry: (id: string, patch: Partial<CashEntry>) => void;
  deleteEntry: (id: string) => void;
  updateSettings: (patch: Partial<CashSettings>) => void;
}

function loadFromLocalStorage(): CashWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyCashWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load workbook from localStorage', e);
  }
  return createEmptyCashWorkbook();
}

function persist(workbook: CashWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save workbook to localStorage — your last change may not have persisted.', e);
  }
}

export const useCashWorkbookStore = create<CashStoreState>((set, get) => {
  const mutate = (updater: (wb: CashWorkbook) => CashWorkbook) => {
    const next = updater(get().workbook);
    set({ workbook: next });
    persist(next);
  };

  return {
    workbook: loadFromLocalStorage(),

    setWorkbook: (wb, opts) => {
      const next = normalize(wb);
      set({ workbook: next });
      if (!opts?.skipPersist) persist(next);
    },

    // Scoped by currency (Cash's own natural "entity" — matches the
    // per-currency statement grid, README Done item 224) rather than one
    // counter across every currency combined (user-reported 2026-09-03:
    // "ID sequence should belong to each entity rather than global").
    addEntry: (entry) =>
      mutate((wb) => {
        const withFields = withDerivedFields(entry);
        const withSerial = withFields.serialNumber !== undefined ? withFields : { ...withFields, serialNumber: nextSerialNumberForEntity(wb.entries, (e) => e.currencyCode, withFields.currencyCode) };
        return { ...wb, entries: [...wb.entries, withSerial] };
      }),

    addEntries: (entries) =>
      mutate((wb) => {
        const withFields = entries.map(withDerivedFields);
        const withSerial = assignSerialNumbersForEntities(wb.entries, withFields, (e) => e.currencyCode);
        return { ...wb, entries: [...wb.entries, ...withSerial] };
      }),

    updateEntry: (id, patch) =>
      mutate((wb) => ({ ...wb, entries: wb.entries.map((e) => (e.id === id ? withDerivedFields({ ...e, ...patch }) : e)) })),

    deleteEntry: (id) => mutate((wb) => ({ ...wb, entries: wb.entries.filter((e) => e.id !== id) })),

    updateSettings: (patch) => mutate((wb) => ({ ...wb, settings: { ...wb.settings, ...patch } })),
  };
});
