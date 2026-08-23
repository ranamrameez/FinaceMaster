import { create } from 'zustand';
import { createEmptyPersonalLoansWorkbook } from './defaultPersonalLoansWorkbook';
import type { PersonalLoan, PersonalLoanRepayment, PersonalLoansWorkbook } from '../types/personalLoansWorkbook';

const STORAGE_KEY = 'financerecorder_personal_loans_workbook_v1';

/** Personal Loans has two related arrays (loans + repayments), so it
 * doesn't fit createEntryStore's single-`entries`-array shape any better
 * than it fits createWorkbookStore's stock-exchange shape — rather than
 * add a third generic factory for "two arrays", this is hand-written
 * following the exact same idiom (mutate/persist/localStorage, and a
 * `{workbook, setWorkbook}` shape that structurally satisfies
 * `useWorkbookCloudSync`'s `MinimalWorkbookStore`) so it's still
 * cloud-sync-compatible without inventing a genuinely new pattern. */
interface PersonalLoansStoreState {
  workbook: PersonalLoansWorkbook;
  setWorkbook: (wb: PersonalLoansWorkbook, opts?: { skipPersist?: boolean }) => void;
  addLoan: (loan: PersonalLoan) => void;
  updateLoan: (id: string, patch: Partial<PersonalLoan>) => void;
  deleteLoan: (id: string) => void;
  addRepayment: (repayment: PersonalLoanRepayment) => void;
  updateRepayment: (id: string, patch: Partial<PersonalLoanRepayment>) => void;
  deleteRepayment: (id: string) => void;
  updateSettings: (patch: Partial<PersonalLoansWorkbook['settings']>) => void;
}

/** Assigns a stable id to any repayment saved before the 2026-08-23 id
 * retrofit (see PersonalLoanRepayment's own doc comment), so real user data
 * written before today keeps working with no manual migration step — same
 * pattern as createWorkbookStore.ts's Transfer id retrofit and
 * createEntryStore.ts's ensureIds. Applied on every path data enters the
 * store: local load and setWorkbook (which also covers the Firebase pull in
 * useWorkbookCloudSync). */
function ensureRepaymentIds(repayments: PersonalLoanRepayment[]): PersonalLoanRepayment[] {
  return repayments.map((r) => (r.id ? r : { ...r, id: crypto.randomUUID() }));
}

function normalize(wb: PersonalLoansWorkbook): PersonalLoansWorkbook {
  return { ...wb, repayments: ensureRepaymentIds(wb.repayments) };
}

function loadFromLocalStorage(): PersonalLoansWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyPersonalLoansWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load workbook from localStorage', e);
  }
  return createEmptyPersonalLoansWorkbook();
}

function persist(workbook: PersonalLoansWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save workbook to localStorage — your last change may not have persisted.', e);
  }
}

export const usePersonalLoansWorkbookStore = create<PersonalLoansStoreState>((set, get) => {
  const mutate = (updater: (wb: PersonalLoansWorkbook) => PersonalLoansWorkbook) => {
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

    addLoan: (loan) => mutate((wb) => ({ ...wb, loans: [...wb.loans, loan] })),

    updateLoan: (id, patch) =>
      mutate((wb) => ({ ...wb, loans: wb.loans.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

    deleteLoan: (id) =>
      mutate((wb) => ({
        ...wb,
        loans: wb.loans.filter((l) => l.id !== id),
        repayments: wb.repayments.filter((r) => r.loanId !== id),
      })),

    addRepayment: (repayment) => mutate((wb) => ({ ...wb, repayments: [...wb.repayments, repayment] })),

    updateRepayment: (id, patch) =>
      mutate((wb) => ({ ...wb, repayments: wb.repayments.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

    deleteRepayment: (id) => mutate((wb) => ({ ...wb, repayments: wb.repayments.filter((r) => r.id !== id) })),

    updateSettings: (patch) => mutate((wb) => ({ ...wb, settings: { ...wb.settings, ...patch } })),
  };
});
