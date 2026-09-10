import { create } from 'zustand';
import { toInstantMs } from '../lib/datetime';
import { assignSeqForEntities, backfillSeq, nextSeqForEntity } from '../lib/seq';
import { createEmptyCreditCardWorkbook } from './defaultCreditCardWorkbook';
import type { CreditCard, CreditCardTransaction, CreditCardWorkbook } from '../types/creditCard';

const STORAGE_KEY = 'financerecorder_credit_card_workbook_v1';

function withDerivedFields(tx: CreditCardTransaction): CreditCardTransaction {
  return { ...tx, timestamp: tx.timestamp ?? new Date().toISOString() };
}

/** Backfills `seq` per-card (see `lib/seq.ts`'s own doc comment on why
 * "per entity" matters, not a global counter) on every path data enters
 * the store — same pattern as `bankWorkbookStore.ts`'s `normalize()`. */
function normalize(wb: CreditCardWorkbook): CreditCardWorkbook {
  const withFields = wb.transactions.map(withDerivedFields);
  const chronological = [...withFields].sort(
    (a, b) => toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone),
  );
  return { ...wb, cards: wb.cards ?? [], transactions: backfillSeq(withFields, chronological) };
}

interface CreditCardStoreState {
  workbook: CreditCardWorkbook;
  setWorkbook: (wb: CreditCardWorkbook, opts?: { skipPersist?: boolean }) => void;
  addCard: (card: CreditCard) => void;
  updateCard: (id: string, patch: Partial<CreditCard>) => void;
  deleteCard: (id: string) => void;
  addTransaction: (tx: CreditCardTransaction) => void;
  updateTransaction: (id: string, patch: Partial<CreditCardTransaction>) => void;
  deleteTransaction: (id: string) => void;
}

function loadFromLocalStorage(): CreditCardWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyCreditCardWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load credit card workbook from localStorage', e);
  }
  return createEmptyCreditCardWorkbook();
}

function persist(workbook: CreditCardWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save credit card workbook to localStorage — your last change may not have persisted.', e);
  }
}

export const useCreditCardWorkbookStore = create<CreditCardStoreState>((set, get) => {
  const mutate = (updater: (wb: CreditCardWorkbook) => CreditCardWorkbook) => {
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

    addCard: (card) => mutate((wb) => ({ ...wb, cards: [...wb.cards, card] })),

    updateCard: (id, patch) =>
      mutate((wb) => ({ ...wb, cards: wb.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

    deleteCard: (id) =>
      mutate((wb) => ({
        ...wb,
        cards: wb.cards.filter((c) => c.id !== id),
        transactions: wb.transactions.filter((t) => t.cardId !== id),
      })),

    addTransaction: (tx) =>
      mutate((wb) => {
        const withFields = withDerivedFields(tx);
        const withSeq = withFields.seq !== undefined ? withFields : { ...withFields, seq: nextSeqForEntity(wb.transactions, (t) => t.cardId, withFields.cardId) };
        return { ...wb, transactions: [...wb.transactions, withSeq] };
      }),

    updateTransaction: (id, patch) =>
      mutate((wb) => ({
        ...wb,
        transactions: wb.transactions.map((t) => (t.id === id ? withDerivedFields({ ...t, ...patch }) : t)),
      })),

    deleteTransaction: (id) => mutate((wb) => ({ ...wb, transactions: wb.transactions.filter((t) => t.id !== id) })),
  };
});

/** Exposed for the one-time legacy-liability migration (see
 * `features/bank/pages/BankPage.tsx`'s `MigrateLegacyCreditCards`) — bulk
 * import needs `assignSeqForEntities`, not the single-record path above. */
export function addCreditCardTransactions(txs: CreditCardTransaction[]) {
  const state = useCreditCardWorkbookStore.getState();
  const withFields = txs.map(withDerivedFields);
  const withSeq = assignSeqForEntities(state.workbook.transactions, withFields, (t) => t.cardId);
  state.setWorkbook({ ...state.workbook, transactions: [...state.workbook.transactions, ...withSeq] });
}
