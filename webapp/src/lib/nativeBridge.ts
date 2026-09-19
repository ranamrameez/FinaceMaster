import { useEffect } from 'react';
import { requireSignIn } from '../components/SignInModal';
import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import type { BankAccount, BankTransaction } from '../types/bankWorkbook';
import { getCurrentUser } from './firebase/useAuthState';

/**
 * The webapp side of the native Android app's SMS-transaction feature (see
 * android/README.md for the full picture). This file is deliberately the ONLY thing the
 * native app talks to — it never gets its own copy of the Bank store's logic, it just calls
 * the exact same `addTransaction` action, sign-in gate, and category/seq auto-fill every
 * other write in this app already goes through (see bankWorkbookStore.ts's own
 * `withDerivedFields`). A transaction created this way is completely indistinguishable from
 * one typed in by hand, except for `source`/`statementRef` marking where it came from — same
 * convention as CSV statement import.
 *
 * Running inside an ordinary browser (not the Android WebView), every function here is a
 * cheap no-op: `window.AndroidBridge` never exists there, so nothing is ever pushed out, and
 * `window.__nativeBridge` just sits unused. This file has zero effect on the normal web app.
 */

interface SmsTransactionPayload {
  accountId: string;
  /** Unsigned magnitude — direction comes from `isDeposit`, matching what the Android
   * review screen itself shows the user, not Bank's internal signed-amount convention
   * (that translation happens below, the same as it would for a hand-typed entry). */
  amount: number;
  isDeposit: boolean;
  description: string;
  date: string;
  time: string;
  timezone: string;
  statementRef: string;
}

declare global {
  interface Window {
    __nativeBridge?: {
      createBankTransactionFromSms: (payload: SmsTransactionPayload, requestId: string) => void;
    };
    AndroidBridge?: {
      updateKnownSenders: (accountsJson: string) => void;
      onCreateTransactionResult: (requestId: string, success: boolean, message: string) => void;
    };
  }
}

async function ensureSignedInForBridge(message?: string): Promise<boolean> {
  if (getCurrentUser()) return true;
  return requireSignIn(message);
}

function respondToNative(requestId: string, success: boolean, message: string) {
  if (typeof window === 'undefined') return;
  window.AndroidBridge?.onCreateTransactionResult(requestId, success, message);
}

async function createBankTransactionFromSms(payload: SmsTransactionPayload, requestId: string): Promise<void> {
  try {
    if (!(await ensureSignedInForBridge('Sign in to save the detected transaction.'))) {
      respondToNative(requestId, false, 'Sign-in was cancelled.');
      return;
    }
    const magnitude = Math.abs(payload.amount);
    const tx: BankTransaction = {
      id: crypto.randomUUID(),
      accountId: payload.accountId,
      amount: payload.isDeposit ? magnitude : -magnitude,
      isDeposit: payload.isDeposit,
      description: payload.description,
      date: payload.date,
      time: payload.time,
      timezone: payload.timezone,
      source: 'statement-import',
      statementRef: payload.statementRef,
    };
    useBankWorkbookStore.getState().addTransaction(tx);
    respondToNative(requestId, true, 'Saved.');
  } catch (e) {
    respondToNative(requestId, false, e instanceof Error ? e.message : 'Failed to save the transaction.');
  }
}

if (typeof window !== 'undefined') {
  window.__nativeBridge = {
    ...window.__nativeBridge,
    createBankTransactionFromSms,
  };
}

function pushKnownSendersToNative(accounts: BankAccount[]) {
  if (typeof window === 'undefined' || !window.AndroidBridge) return;
  // Same "only active entities feed a new-activity picker" convention every other
  // linking/matching picker in this app already follows (see e.g. useAccountPicker) —
  // an archived account shouldn't silently start collecting new transactions again just
  // because an old SMS sender ID is still configured on it.
  const known = accounts
    .filter((a) => a.isActive !== false && (a.smsSenderId?.trim() || a.smsSenderNumber?.trim()))
    .map((a) => ({
      accountId: a.id,
      accountName: a.name,
      currencyCode: a.currencyCode,
      smsSenderId: a.smsSenderId,
      smsSenderNumber: a.smsSenderNumber,
    }));
  window.AndroidBridge.updateKnownSenders(JSON.stringify(known));
}

/** Mounted once from App.tsx (alongside every other always-on sync hook). Keeps the Android
 * app's notification listener in sync with which Bank accounts are set up for SMS matching,
 * so a new/edited/removed smsSenderId takes effect without needing the app reopened. */
export function useNativeBridgeSync(): void {
  const accounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  useEffect(() => {
    pushKnownSendersToNative(accounts);
  }, [accounts]);
}
