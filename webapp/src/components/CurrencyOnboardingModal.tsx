import { Modal } from './Modal';
import { toast } from './Toast';
import { CURRENCIES } from '../lib/currencies';
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
 * legal requirement, so skipping it is completely fine and leaves
 * `enabledCodes` at its safe `null` default ("not configured, show all"),
 * exactly the same as if this prompt never existed. */
export function CurrencyOnboardingModal() {
  const termsAccepted = useTermsStore((s) => s.accepted);
  const seen = useCurrencyOnboardingStore((s) => s.seen);
  const dismiss = useCurrencyOnboardingStore((s) => s.dismiss);
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  const toggle = useEnabledCurrenciesStore((s) => s.toggle);
  const isEnabled = (code: string) => enabledCodes === null || enabledCodes.includes(code);

  if (!termsAccepted || seen) return null;

  return (
    <Modal title="Which currencies do you use?" onClose={dismiss}>
      <p className="text-muted" style={{ marginTop: 0 }}>
        Pick which currencies show up in a currency picker across the app — most people only
        ever use one or two. You can change this any time from Account &gt; Currencies.
      </p>
      <div className="row" style={{ gap: 6 }}>
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            className={`chip${isEnabled(c.code) ? ' active' : ''}`}
            onClick={() => {
              if (!toggle(c.code)) toast('Keep at least one currency checked.');
            }}
          >
            {c.code}
          </button>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 16 }} onClick={dismiss}>
        Done
      </button>
    </Modal>
  );
}
