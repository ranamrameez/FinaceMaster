import { create } from 'zustand';

/** Which subscription-alert occurrences the user has already dismissed —
 * a local UI-only "seen this" marker, not financial data, so it's global
 * (same idiom as `appearanceStore`/`termsStore`) and never synced to
 * Firebase. Keyed by `dueSubscriptionAlerts()`'s own per-occurrence key
 * (`subId:alertId:occurrenceTag`) — dismissing only silences THIS
 * occurrence; a `daysBefore` alert re-triggers with a fresh key once its
 * cycle rolls forward, so dismissal is never "forever." */
const STORAGE_KEY = 'financerecorder_subscription_alert_dismissals_v1';

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
    console.warn('Failed to save subscription alert dismissals', e);
  }
}

interface DismissalState {
  dismissed: Record<string, true>;
  isDismissed: (key: string) => boolean;
  dismiss: (key: string) => void;
}

export const useSubscriptionAlertDismissalStore = create<DismissalState>((set, get) => ({
  dismissed: load(),
  isDismissed: (key) => !!get().dismissed[key],
  dismiss: (key) => {
    const next = { ...get().dismissed, [key]: true as const };
    set({ dismissed: next });
    persist(next);
  },
}));
