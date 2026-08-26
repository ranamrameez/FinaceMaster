import { create } from 'zustand';
import { createEmptyEMIWorkbook } from './defaultEmiWorkbook';
import type { EMILoan, EMIRepayment, EMIWorkbook } from '../types/emiWorkbook';

const STORAGE_KEY = 'financerecorder_emi_workbook_v1';

/** EMI gained a second array (`repayments`, README Pending items 21/62's
 * repayment-ledger gap) — like Personal Loans before it, two related
 * arrays don't fit `createEntryStore`'s single-array shape, so this is now
 * hand-written following the exact same idiom (mutate/persist/localStorage,
 * `{workbook, setWorkbook}` satisfying `useWorkbookCloudSync`'s
 * `MinimalWorkbookStore`). `addEntry`/`updateEntry`/`deleteEntry` (the loan
 * CRUD) keep their exact old names/signatures from the `createEntryStore`
 * days so every existing call site in `EMIPage.tsx` and `resetLocalData.ts`
 * keeps working unchanged. */
interface EMIStoreState {
  workbook: EMIWorkbook;
  setWorkbook: (wb: EMIWorkbook, opts?: { skipPersist?: boolean }) => void;
  addEntry: (loan: EMILoan) => void;
  updateEntry: (id: string, patch: Partial<EMILoan>) => void;
  deleteEntry: (id: string) => void;
  addRepayment: (repayment: EMIRepayment) => void;
  updateRepayment: (id: string, patch: Partial<EMIRepayment>) => void;
  deleteRepayment: (id: string) => void;
  updateSettings: (patch: Partial<EMIWorkbook['settings']>) => void;
}

/** Sets/clears `loan.installmentOverrides[month]` to match a repayment
 * record — keeps `emiSchedule()`'s calculation the single source of truth
 * for the actual amortization numbers (nothing here re-derives interest/
 * principal splits), while `EMIRepayment` adds an addressable id/date/
 * source on top for display, editing, and cross-entity linking. */
function applyOverride(loans: EMILoan[], loanId: string, month: number, amount: number | null): EMILoan[] {
  return loans.map((l) => {
    if (l.id !== loanId) return l;
    const overrides = { ...(l.installmentOverrides || {}) };
    if (amount == null) delete overrides[month];
    else overrides[month] = amount;
    return { ...l, installmentOverrides: overrides };
  });
}

function ensureRepaymentIds(repayments: EMIRepayment[]): EMIRepayment[] {
  return repayments.map((r) => (r.id ? r : { ...r, id: crypto.randomUUID() }));
}

function normalize(wb: EMIWorkbook): EMIWorkbook {
  return { ...wb, repayments: ensureRepaymentIds(wb.repayments || []) };
}

function loadFromLocalStorage(): EMIWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyEMIWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load workbook from localStorage', e);
  }
  return createEmptyEMIWorkbook();
}

function persist(workbook: EMIWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save workbook to localStorage — your last change may not have persisted.', e);
  }
}

export const useEMIWorkbookStore = create<EMIStoreState>((set, get) => {
  const mutate = (updater: (wb: EMIWorkbook) => EMIWorkbook) => {
    const next = updater(get().workbook);
    set({ workbook: next });
    persist(next);
  };

  return {
    workbook: loadFromLocalStorage(),

    setWorkbook: (wb, opts) => {
      const normalized = normalize(wb);
      set({ workbook: normalized });
      if (!opts?.skipPersist) persist(normalized);
    },

    addEntry: (loan) => mutate((wb) => ({ ...wb, entries: [...wb.entries, loan] })),

    updateEntry: (id, patch) =>
      mutate((wb) => ({ ...wb, entries: wb.entries.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

    deleteEntry: (id) =>
      mutate((wb) => ({
        ...wb,
        entries: wb.entries.filter((l) => l.id !== id),
        repayments: wb.repayments.filter((r) => r.loanId !== id),
      })),

    addRepayment: (repayment) =>
      mutate((wb) => ({
        ...wb,
        repayments: [...wb.repayments, repayment],
        entries: applyOverride(wb.entries, repayment.loanId, repayment.month, repayment.amount),
      })),

    updateRepayment: (id, patch) =>
      mutate((wb) => {
        const existing = wb.repayments.find((r) => r.id === id);
        if (!existing) return wb;
        const updated = { ...existing, ...patch };
        let entries = wb.entries;
        // A month change needs the OLD slot cleared first, or the loan
        // would end up with both the stale and the new override set.
        if (updated.month !== existing.month || updated.loanId !== existing.loanId) {
          entries = applyOverride(entries, existing.loanId, existing.month, null);
        }
        entries = applyOverride(entries, updated.loanId, updated.month, updated.amount);
        return {
          ...wb,
          repayments: wb.repayments.map((r) => (r.id === id ? updated : r)),
          entries,
        };
      }),

    deleteRepayment: (id) =>
      mutate((wb) => {
        const existing = wb.repayments.find((r) => r.id === id);
        return {
          ...wb,
          repayments: wb.repayments.filter((r) => r.id !== id),
          entries: existing ? applyOverride(wb.entries, existing.loanId, existing.month, null) : wb.entries,
        };
      }),

    updateSettings: (patch) => mutate((wb) => ({ ...wb, settings: { ...wb.settings, ...patch } })),
  };
});
