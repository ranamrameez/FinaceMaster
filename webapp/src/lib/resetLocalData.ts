import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../store/cashWorkbookStore';
import { createEmptyBankWorkbook } from '../store/defaultBankWorkbook';
import { createEmptyCashWorkbook } from '../store/defaultCashWorkbook';
import { createEmptyEMIWorkbook } from '../store/defaultEmiWorkbook';
import { createEmptyFundsWorkbook } from '../store/defaultFundsWorkbook';
import { createEmptyInterEntityWorkbook } from '../store/defaultInterEntityWorkbook';
import { createEmptyNetWorthSnapshotsWorkbook } from '../store/defaultNetWorthSnapshotsWorkbook';
import { createEmptyPersonalLoansWorkbook } from '../store/defaultPersonalLoansWorkbook';
import { createEmptyPlannedBankWorkbook } from '../store/defaultPlannedBankWorkbook';
import { createEmptyPlannedCashWorkbook } from '../store/defaultPlannedCashWorkbook';
import { createEmptyPlannedRentalsWorkbook } from '../store/defaultPlannedRentalsWorkbook';
import { createEmptyPSXWorkbook } from '../store/defaultPsxWorkbook';
import { createEmptyRentalsWorkbook } from '../store/defaultRentalsWorkbook';
import { createEmptySubscriptionsWorkbook } from '../store/defaultSubscriptionsWorkbook';
import { createEmptyWorkbook } from '../store/defaultWorkbook';
import { useEMIWorkbookStore } from '../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../store/fundsWorkbookStore';
import { useInterEntityTransfersStore } from '../store/interEntityTransfersStore';
import { useNetWorthSnapshotsWorkbookStore } from '../store/netWorthSnapshotsWorkbookStore';
import { usePersonalLoansWorkbookStore } from '../store/personalLoansWorkbookStore';
import { usePlannedBankWorkbookStore } from '../store/plannedBankWorkbookStore';
import { usePlannedCashWorkbookStore } from '../store/plannedCashWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../store/plannedRentalsWorkbookStore';
import { usePSXWorkbookStore } from '../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../store/rentalsWorkbookStore';
import { useSubscriptionsWorkbookStore } from '../store/subscriptionsWorkbookStore';
import { useWorkbookStore } from '../store/workbookStore';

/** Critical fix: signing out used to leave every module's data sitting in
 * memory and in localStorage — the next person to use the browser (or the
 * same person signing into a *different* account) would see the previous
 * account's QSE/PSX/Cash/Bank/etc. data until a cloud pull happened to
 * overwrite it, and could even hit the "cloud looks empty, upload local
 * data?" prompt and push the previous account's data into their own new
 * cloud path. Called from `useAuthState.ts` on any auth transition away
 * from a signed-in uid (sign-out, or switching accounts) — never on a
 * page-load resume of an already-signed-in session, which legitimately
 * still owns its local data.
 *
 * Deliberately does NOT touch `appearanceStore`/`termsStore` — those are
 * global browser preferences (theme, font, terms acceptance), not
 * per-account data, per this app's existing design decision that
 * appearance must never live inside a per-account workbook.
 *
 * Audited 2026-08-26 while adding the EMI repayment ledger and Net Worth
 * snapshot stores: Subscriptions and all three Planned* stores (Cash/Bank/
 * Rentals) had been added to the app after this list was last written and
 * were never added here — the exact class of bug this function exists to
 * prevent, just for those five stores. Fixed by adding them, plus the two
 * new stores from today, rather than letting the gap grow further; if a
 * future module adds a new per-account local store, it belongs in this
 * list too. */
export function resetAllLocalWorkbooks() {
  useWorkbookStore.getState().setWorkbook(createEmptyWorkbook());
  usePSXWorkbookStore.getState().setWorkbook(createEmptyPSXWorkbook());
  useCashWorkbookStore.getState().setWorkbook(createEmptyCashWorkbook());
  usePersonalLoansWorkbookStore.getState().setWorkbook(createEmptyPersonalLoansWorkbook());
  useBankWorkbookStore.getState().setWorkbook(createEmptyBankWorkbook());
  useEMIWorkbookStore.getState().setWorkbook(createEmptyEMIWorkbook());
  useFundsWorkbookStore.getState().setWorkbook(createEmptyFundsWorkbook());
  useRentalsWorkbookStore.getState().setWorkbook(createEmptyRentalsWorkbook());
  useInterEntityTransfersStore.getState().setWorkbook(createEmptyInterEntityWorkbook());
  useSubscriptionsWorkbookStore.getState().setWorkbook(createEmptySubscriptionsWorkbook());
  usePlannedCashWorkbookStore.getState().setWorkbook(createEmptyPlannedCashWorkbook());
  usePlannedBankWorkbookStore.getState().setWorkbook(createEmptyPlannedBankWorkbook());
  usePlannedRentalsWorkbookStore.getState().setWorkbook(createEmptyPlannedRentalsWorkbook());
  useNetWorthSnapshotsWorkbookStore.getState().setWorkbook(createEmptyNetWorthSnapshotsWorkbook());
}
