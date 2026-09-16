import { useEnabledCurrenciesStore } from '../store/enabledCurrenciesStore';

/** The user's own explicit Primary currency (the first entry of their
 * ranked `enabledCodes`, per the 2026-09-16 currency-tier design — see
 * `useEnabledCurrencies`'s own doc comment for the three real cases this
 * was designed against) — `undefined` when nothing's been configured, so
 * every caller keeps its own existing fallback (USD, a biggest-exposure
 * heuristic, a module's own `settings.defaultCurrency`, etc.) for that
 * zero-migration case rather than this hook inventing one.
 *
 * SUPERSEDES a module's own `settings.defaultCurrency` (2026-09-16, per
 * the user's explicit, repeated instruction: "No need of settings in
 * individual modules! ... including currency"). Cash/Personal Loans/EMI/
 * Subscriptions/Bank/Funds/Rentals all still store a `defaultCurrency` on
 * their own workbook settings (removing the field itself would be real,
 * unnecessary schema churn — nothing reads it as a user-facing "setting"
 * anymore), but every add-form now prefers THIS hook first, falling back
 * to that stored field only when the user hasn't set a Primary currency
 * at all yet (`/account`'s Currencies section, via `CurrencyOnboardingModal`
 * or a manual reorder). Do not add a new per-module currency-setting UI —
 * the single global ranking on `/account` is the only place a user picks
 * this now. */
export function usePrimaryCurrency(): string | undefined {
  return useEnabledCurrenciesStore((s) => s.enabledCodes?.[0]);
}
