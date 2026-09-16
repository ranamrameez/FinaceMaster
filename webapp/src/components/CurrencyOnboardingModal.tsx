import { useEffect } from 'react';
import { CurrencyQuickAdd } from './CurrencyQuickAdd';
import { XIcon } from './icons';
import { Modal } from './Modal';
import { toast } from './Toast';
import { detectPrimaryCurrency } from '../lib/currencies';
import { useCurrencyOnboardingStore } from '../store/currencyOnboardingStore';
import { useEnabledCurrenciesStore } from '../store/enabledCurrenciesStore';
import { useTermsStore } from '../store/termsStore';

/** User-requested (2026-09-09): "We should ask user about his currencies
 * on signup. then can still customize in settings anytime." Fires exactly
 * once, right after the Terms gate is accepted — reuses
 * `useEnabledCurrenciesStore` (the SAME store the ongoing Account >
 * Currencies section already reads/writes, `store/enabledCurrenciesStore.ts`)
 * so this is a shortcut into that existing preference, not a parallel one.
 *
 * Deliberately dismissible (a real `X`/click-outside close, unlike
 * `TermsGateModal`'s hard block) — this is a UI convenience nudge, not a
 * legal requirement.
 *
 * User-requested (2026-09-14): "ONE PRIMARY CURRENCY DEFAULT BASED ON USER
 * TIMEZONE/LOCATION, on[e] secondary and the other currencies" — the old
 * default (`enabledCodes === null`, shown here as "every chip checked")
 * was the wrong default for the exact case this whole feature exists for
 * ("this app supports multiple currencies but not all users are
 * multi-currency"): 11 pre-checked chips isn't a narrowed-down default at
 * all. The moment this modal is about to actually show (not before —
 * dismissing the Terms gate itself must never write anything), it seeds
 * the store with just the ONE currency `detectPrimaryCurrency()` guesses
 * from the browser's own timezone — the user adds any secondary/other
 * currency on top of it via the same chips, or removes it if the guess is
 * wrong. Skipping the modal (X / click-outside) without touching
 * anything simply leaves that one detected currency as the account's own
 * chosen set — a real, reversible default (Account &gt; Currencies), not a
 * silent "show everything" fallback that no longer means much once most
 * users only ever see one currency pre-checked here.
 *
 * Redesigned 2026-09-16 alongside the Account page's own Currencies
 * section (see that file's `CurrenciesSection` doc comment for the full
 * story) — `CURRENCIES` grew from 11 to ~50 the same day, so dumping every
 * one as a permanent chip row (this modal's original design) would have
 * turned a quick first-run nudge into a wall of ~50 buttons. Now shows
 * only the currently-effective (detected + added) currencies as removable
 * chips, plus `CurrencyQuickAdd`'s type-ahead input to add more — the same
 * shared component and pattern the Account page uses, so there's one
 * "add a currency" UX in the app, not two. */
export function CurrencyOnboardingModal() {
  const termsAccepted = useTermsStore((s) => s.accepted);
  const seen = useCurrencyOnboardingStore((s) => s.seen);
  const dismiss = useCurrencyOnboardingStore((s) => s.dismiss);
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  const setEnabledCodes = useEnabledCurrenciesStore((s) => s.setEnabledCodes);
  const toggle = useEnabledCurrenciesStore((s) => s.toggle);

  const shouldShow = termsAccepted && !seen;
  useEffect(() => {
    if (shouldShow && enabledCodes === null) setEnabledCodes([detectPrimaryCurrency()]);
  }, [shouldShow, enabledCodes, setEnabledCodes]);

  if (!shouldShow) return null;

  // Matches what the effect above is about to commit, so the FIRST paint
  // (before that effect has actually run) already shows the right chip
  // checked instead of a one-frame flash of "nothing checked".
  const effectiveCodes = enabledCodes ?? [detectPrimaryCurrency()];
  const primary = effectiveCodes[0];

  const addCode = (code: string) => {
    if (effectiveCodes.includes(code)) {
      toast(`${code} is already added.`);
      return;
    }
    toggle(code);
  };

  return (
    <Modal title="Which currencies do you use?" onClose={dismiss}>
      <p className="text-muted mt-0">
        Pick which currencies show up in a currency picker across the app — most people only
        ever use one or two. We've pre-picked one based on your timezone; add any others you
        deal in, or remove it if we guessed wrong. You can change this any time from Account
        &gt; Currencies.
      </p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {effectiveCodes.map((code) => (
          <button
            key={code}
            className="chip active"
            title="Remove"
            onClick={() => {
              if (!toggle(code)) toast('Keep at least one currency.');
            }}
          >
            {code}
            {code === primary && <span className="text-muted"> · Primary</span>} <XIcon size={10} />
          </button>
        ))}
      </div>
      <div className="mt-sm">
        <CurrencyQuickAdd excludeCodes={effectiveCodes} onAdd={addCode} />
      </div>
      <button className="btn mt-md" onClick={dismiss}>
        Done
      </button>
    </Modal>
  );
}
