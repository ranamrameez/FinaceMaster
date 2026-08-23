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
  updateRepayment: (loanId: string, index: number, patch: Partial<PersonalLoanRepayment>) => void;
  deleteRepayment: (loanId: string, index: number) => void;
  updateSettings: (patch: Partial<PersonalLoansWorkbook['settings']>) => void;
}

function loadFromLocalStorage(): PersonalLoansWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...createEmptyPersonalLoansWorkbook(), ...JSON.parse(raw) };
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
      set({ workbook: wb });
      if (!opts?.skipPersist) persist(wb);
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

    updateRepayment: (loanId, index, patch) =>
      mutate((wb) => {
        let seen = -1;
        return {
          ...wb,
          repayments: wb.repayments.map((r) => {
            if (r.loanId !== loanId) return r;
            seen += 1;
            return seen === index ? { ...r, ...patch } : r;
          }),
        };
      }),

    deleteRepayment: (loanId, index) =>
      mutate((wb) => {
        let seen = -1;
        return {
          ...wb,
          repayments: wb.repayments.filter((r) => {
            if (r.loanId !== loanId) return true;
            seen += 1;
            return seen !== index;
          }),
        };
      }),

    updateSettings: (patch) => mutate((wb) => ({ ...wb, settings: { ...wb.settings, ...patch } })),
  };
});
