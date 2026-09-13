import { create } from 'zustand';

/** Which Partial Trade Alert occurrences the user has already dismissed —
 * a local UI-only "seen this" marker, not financial data, so it's global
 * and never synced to Firebase (same idiom as
 * `subscriptionAlertDismissalStore.ts`, which this mirrors). Keyed by
 * `exchange:ticker:date` — dismissing only silences today's occurrence;
 * a fresh trading day (or the opportunity reappearing after having
 * closed) gets a new key, so dismissal is never "forever." */
const STORAGE_KEY = 'financerecorder_partial_trade_alert_dismissals_v1';

function load(): Record<string, true> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore, fall through to empty */
  }
  return {};
}

function persist(d: Record<string, true>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch (e) {
    console.warn('Failed to save partial trade alert dismissals', e);
  }
}

interface DismissalState {
  dismissed: Record<string, true>;
  isDismissed: (key: string) => boolean;
  dismiss: (key: string) => void;
}

export const usePartialTradeAlertDismissalStore = create<DismissalState>((set, get) => ({
  dismissed: load(),
  isDismissed: (key) => !!get().dismissed[key],
  dismiss: (key) => {
    const next = { ...get().dismissed, [key]: true as const };
    set({ dismissed: next });
    persist(next);
  },
}));
