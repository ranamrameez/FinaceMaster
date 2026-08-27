import { create } from 'zustand';
import { toInstantMs } from '../lib/datetime';
import { backfillSeq, nextSeq } from '../lib/seq';
import { createEmptyBankWorkbook } from './defaultBankWorkbook';
import type { BankAccount, BankTransaction, BankWorkbook } from '../types/bankWorkbook';

const STORAGE_KEY = 'financerecorder_bank_workbook_v1';

/** Backfills `seq` (see `BankTransaction.seq`'s doc comment) onto any
 * transaction missing it, in real-instant chronological order — same
 * pattern as `createWorkbookStore.ts`'s `normalize()`. Applied on every
 * path data can enter the store (local load and `setWorkbook`, which also
 * covers the Firebase pull in `useBankFirebaseSync`). */
function normalize(wb: BankWorkbook): BankWorkbook {
  const chronological = [...wb.transactions].sort(
    (a, b) => toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone),
  );
  return { ...wb, transactions: backfillSeq(wb.transactions, chronological) };
}

/** Banking has accounts (nested under settings) plus transactions — a
 * different shape again from Cash's single entries array and Personal
 * Loans' two top-level arrays, so this is hand-written too, following the
 * same idiom (mutate/persist/localStorage, `{workbook, setWorkbook}`
 * satisfying `useWorkbookCloudSync`'s `MinimalWorkbookStore`). See
 * MODULES_PLAN.md §2 and the zustand-selector rule in §6 (select raw
 * state, derive in useMemo, never inside the selector) — followed here
 * throughout. */
interface BankStoreState {
  workbook: BankWorkbook;
  setWorkbook: (wb: BankWorkbook, opts?: { skipPersist?: boolean }) => void;
  addAccount: (account: BankAccount) => void;
  updateAccount: (id: string, patch: Partial<BankAccount>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (tx: BankTransaction) => void;
  addTransactions: (txs: BankTransaction[]) => void;
  updateTransaction: (id: string, patch: Partial<BankTransaction>) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (category: string, amount: number) => void;
}

function loadFromLocalStorage(): BankWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyBankWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load workbook from localStorage', e);
  }
  return createEmptyBankWorkbook();
}

function persist(workbook: BankWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save workbook to localStorage — your last change may not have persisted.', e);
  }
}

export const useBankWorkbookStore = create<BankStoreState>((set, get) => {
  const mutate = (updater: (wb: BankWorkbook) => BankWorkbook) => {
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

    addAccount: (account) =>
      mutate((wb) => ({ ...wb, settings: { ...wb.settings, accounts: [...wb.settings.accounts, account] } })),

    updateAccount: (id, patch) =>
      mutate((wb) => ({
        ...wb,
        settings: { ...wb.settings, accounts: wb.settings.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) },
      })),

    deleteAccount: (id) =>
      mutate((wb) => ({
        ...wb,
        settings: { ...wb.settings, accounts: wb.settings.accounts.filter((a) => a.id !== id) },
        transactions: wb.transactions.filter((t) => t.accountId !== id),
      })),

    addTransaction: (tx) =>
      mutate((wb) => ({ ...wb, transactions: [...wb.transactions, tx.seq !== undefined ? tx : { ...tx, seq: nextSeq(wb.transactions) }] })),

    addTransactions: (txs) =>
      mutate((wb) => {
        let seq = nextSeq(wb.transactions) - 1;
        const withSeq = txs.map((t) => (t.seq !== undefined ? t : { ...t, seq: ++seq }));
        return { ...wb, transactions: [...wb.transactions, ...withSeq] };
      }),

    updateTransaction: (id, patch) =>
      mutate((wb) => ({ ...wb, transactions: wb.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

    deleteTransaction: (id) => mutate((wb) => ({ ...wb, transactions: wb.transactions.filter((t) => t.id !== id) })),

    setBudget: (category, amount) =>
      mutate((wb) => ({
        ...wb,
        settings: { ...wb.settings, budgets: { ...(wb.settings.budgets ?? {}), [category]: amount } },
      })),
  };
});
