import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../store/cashWorkbookStore';
import { createEmptyBankWorkbook } from '../store/defaultBankWorkbook';
import { createEmptyCashWorkbook } from '../store/defaultCashWorkbook';
import { createEmptyEMIWorkbook } from '../store/defaultEmiWorkbook';
import { createEmptyFundsWorkbook } from '../store/defaultFundsWorkbook';
import { createEmptyInterEntityWorkbook } from '../store/defaultInterEntityWorkbook';
import { createEmptyPersonalLoansWorkbook } from '../store/defaultPersonalLoansWorkbook';
import { createEmptyPSXWorkbook } from '../store/defaultPsxWorkbook';
import { createEmptyRentalsWorkbook } from '../store/defaultRentalsWorkbook';
import { createEmptyWorkbook } from '../store/defaultWorkbook';
import { useEMIWorkbookStore } from '../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../store/fundsWorkbookStore';
import { useInterEntityTransfersStore } from '../store/interEntityTransfersStore';
import { usePersonalLoansWorkbookStore } from '../store/personalLoansWorkbookStore';
import { usePSXWorkbookStore } from '../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../store/rentalsWorkbookStore';
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
 * appearance must never live inside a per-account workbook. */
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
}
