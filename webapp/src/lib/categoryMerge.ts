import { useCashWorkbookStore } from '../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../store/plannedCashWorkbookStore';
import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import { usePlannedBankWorkbookStore } from '../store/plannedBankWorkbookStore';
import { useRentalsWorkbookStore } from '../store/rentalsWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../store/plannedRentalsWorkbookStore';
import { useFundsWorkbookStore } from '../store/fundsWorkbookStore';
import { useSubscriptionsWorkbookStore } from '../store/subscriptionsWorkbookStore';
import { useCreditCardWorkbookStore } from '../store/creditCardWorkbookStore';
import { useCategoryStore } from '../store/categoryStore';
import { categoryName } from './categories';

/** Repoints every real (id-based) and planned (name-based, see the
 * `Finance` doc comment in `types/finance.ts` for why those two shapes
 * differ) record's category from `fromId` to `toId`, across every module
 * that has ever carried one — Cash/Bank/Rentals + their Planned*
 * counterparts, plus Funds/Subscriptions/CreditCard, which also gained
 * their own `categoryID` in earlier sessions (a real, wider scope than
 * this project's own "Finance restructure is Cash/Bank/Rentals only" note
 * — checked every `categoryID` reference in the codebase before writing
 * this rather than assuming the 3-module scope still holds for every
 * consumer of the shared registry) — then removes `fromId` from the
 * shared registry.
 *
 * User-requested (2026-09-16): "for my data merge Ignore & IgnoreCount
 * into 1." This is a real DATA merge, not just deleting the stale id and
 * letting `categoryName()`'s existing "Uncategorized" fallback paper over
 * the gap — that would silently turn every "IgnoreCount"-tagged record
 * into "Uncategorized" instead of the user's actual intent (fold it into
 * "Ignore"). Deliberately bypasses `categoryStore.ts`'s own `scope:'app'`
 * rename/delete guard for this one hardcoded, explicitly user-approved
 * operation — that guard exists to stop an ACCIDENTAL UI action from
 * touching shared reference data, not to block a deliberate, reviewed
 * merge like this one; it does NOT loosen the guard for anything else.
 *
 * Writes go through each store's own `setWorkbook()` (same as every other
 * bulk write in this app, e.g. `AppDataPage.tsx`'s import) — the already-
 * running `use<Module>FirebaseSync` hooks mounted in `App.tsx` pick the
 * change up and push it to the cloud automatically, same as any other
 * local write; nothing here talks to Firebase directly. Caller is
 * responsible for the sign-in gate and a confirm step (a merge is a real,
 * many-record write, not something to fire silently) — this function only
 * does the actual work once both have already been cleared.
 *
 * Returns how many records were actually touched, purely for the caller's
 * own confirmation toast — a merge that finds 0 records still completes
 * (the now-redundant category is still removed), just reports 0. */
export function mergeCategoriesEverywhere(fromId: string, toId: string): number {
  let touched = 0;
  const categories = useCategoryStore.getState().workbook.categories;
  const fromName = categoryName(fromId, categories);
  const toName = categoryName(toId, categories);

  const remapById = <T extends { categoryID?: string }>(records: T[]): T[] =>
    records.map((r) => {
      if (r.categoryID !== fromId) return r;
      touched++;
      return { ...r, categoryID: toId };
    });
  const remapByName = <T extends { category?: string }>(records: T[]): T[] =>
    records.map((r) => {
      if (r.category !== fromName) return r;
      touched++;
      return { ...r, category: toName };
    });

  {
    const store = useCashWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, entries: remapById(store.workbook.entries) });
  }
  {
    const store = usePlannedCashWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, entries: remapByName(store.workbook.entries) });
  }
  {
    const store = useBankWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, transactions: remapById(store.workbook.transactions) });
  }
  {
    const store = usePlannedBankWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, entries: remapByName(store.workbook.entries) });
  }
  {
    const store = useRentalsWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, entries: remapById(store.workbook.entries) });
  }
  {
    const store = usePlannedRentalsWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, entries: remapByName(store.workbook.entries) });
  }
  {
    const store = useFundsWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, funds: remapById(store.workbook.funds) });
  }
  {
    const store = useSubscriptionsWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, entries: remapById(store.workbook.entries) });
  }
  {
    const store = useCreditCardWorkbookStore.getState();
    store.setWorkbook({ ...store.workbook, transactions: remapById(store.workbook.transactions) });
  }

  const catStore = useCategoryStore.getState();
  catStore.setWorkbook({ ...catStore.workbook, categories: catStore.workbook.categories.filter((c) => c.id !== fromId) });

  return touched;
}
