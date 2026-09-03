import { create } from 'zustand';
import { toInstantMs } from '../lib/datetime';
import { backfillSerialNumber, nextSerialNumber } from '../lib/financeSerial';
import { resolveLegacyCategoryId } from '../lib/financeMigration';
import { createEmptyBankWorkbook } from './defaultBankWorkbook';
import type { BankAccount, BankTransaction, BankWorkbook } from '../types/bankWorkbook';

const STORAGE_KEY = 'financerecorder_bank_workbook_v1';

/** `BankTransaction` extends `Finance` (2026-09-03 restructure) — `amount`
 * stays the SIGNED source of truth (see `types/finance.ts`'s file-level
 * comment on why), so `isDeposit` is always just its sign, recomputed here
 * rather than trusted from storage: never let it drift from the amount
 * that's actually authoritative. */
function withDerivedFields(tx: BankTransaction): BankTransaction {
  return {
    ...tx,
    isDeposit: tx.amount >= 0,
    categoryID: tx.categoryID ?? resolveLegacyCategoryId(tx.category),
    timestamp: tx.timestamp ?? new Date().toISOString(),
  };
}

/** Backfills `serialNumber` (see `Finance.serialNumber`'s doc comment) onto
 * any transaction missing it, in real-instant chronological order — same
 * pattern as `createWorkbookStore.ts`'s `normalize()`, just under this
 * class's own field name (`lib/financeSerial.ts`). Also derives
 * `isDeposit`/`categoryID`/`timestamp` on every record so pre-existing
 * local/cloud data (written before this migration) resolves correctly the
 * moment it's loaded, not just on the next edit. Applied on every path
 * data can enter the store (local load and `setWorkbook`, which also
 * covers the Firebase pull in `useBankFirebaseSync`). */
function normalize(wb: BankWorkbook): BankWorkbook {
  const withFields = wb.transactions.map(withDerivedFields);
  const chronological = [...withFields].sort(
    (a, b) => toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone),
  );
  return { ...wb, transactions: backfillSerialNumber(withFields, chronological) };
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
      mutate((wb) => {
        const withFields = withDerivedFields(tx);
        const withSerial = withFields.serialNumber !== undefined ? withFields : { ...withFields, serialNumber: nextSerialNumber(wb.transactions) };
        return { ...wb, transactions: [...wb.transactions, withSerial] };
      }),

    addTransactions: (txs) =>
      mutate((wb) => {
        let serial = nextSerialNumber(wb.transactions) - 1;
        const withFields = txs.map((t) => {
          const derived = withDerivedFields(t);
          return derived.serialNumber !== undefined ? derived : { ...derived, serialNumber: ++serial };
        });
        return { ...wb, transactions: [...wb.transactions, ...withFields] };
      }),

    updateTransaction: (id, patch) =>
      mutate((wb) => ({
        ...wb,
        transactions: wb.transactions.map((t) => (t.id === id ? withDerivedFields({ ...t, ...patch }) : t)),
      })),

    deleteTransaction: (id) => mutate((wb) => ({ ...wb, transactions: wb.transactions.filter((t) => t.id !== id) })),

    setBudget: (category, amount) =>
      mutate((wb) => ({
        ...wb,
        settings: { ...wb.settings, budgets: { ...(wb.settings.budgets ?? {}), [category]: amount } },
      })),
  };
});
