import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { dueSubscriptionAlerts } from '../lib/calc/subscriptionsModule';
import { fmtMoney } from '../lib/format';
import { useSubscriptionAlertDismissalStore } from '../store/subscriptionAlertDismissalStore';
import { useSubscriptionsWorkbookStore } from '../store/subscriptionsWorkbookStore';
import { XIcon } from './icons';

const AUTO_HIDE_MS = 12000;

/** User-requested (2026-08-26): an auto-hiding popup on opening the
 * webapp, summarizing any due subscription renewal/expiry alerts —
 * mounted once at the App root (alongside `TermsGateModal`/
 * `ConfirmDialogHost`) so it fires on first load regardless of which
 * page the user lands on, not tied to visiting the Subscriptions page.
 * A snapshot is taken once on mount (not live-recomputed) — the point is
 * "what's due when you opened the app," not a constantly-shifting list;
 * dismissing an item removes it from THIS popup and marks it dismissed
 * for its current occurrence (won't re-show until the next cycle, see
 * `dueSubscriptionAlerts`'s own per-occurrence key). Auto-hides after
 * 12s if left untouched, same "don't nag" spirit as the QSE/PSX Dashboard
 * alerts toast. */
export function SubscriptionAlertsPopup() {
  const subs = useSubscriptionsWorkbookStore((s) => s.workbook.entries);
  const isDismissed = useSubscriptionAlertDismissalStore((s) => s.isDismissed);
  const dismiss = useSubscriptionAlertDismissalStore((s) => s.dismiss);

  const initial = useMemo(() => dueSubscriptionAlerts(subs, new Date(), isDismissed), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => initial.map((d) => d.key));
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!initial.length) return;
    const t = setTimeout(() => setHidden(true), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [initial.length]);

  const visible = initial.filter((d) => visibleKeys.includes(d.key));
  if (hidden || !visible.length) return null;

  const dismissOne = (key: string) => {
    dismiss(key);
    setVisibleKeys((keys) => keys.filter((k) => k !== key));
  };

  return (
    <div
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 400, width: 320, maxWidth: 'calc(100vw - 32px)',
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,.28)', padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {visible.length} subscription{visible.length > 1 ? 's' : ''} need{visible.length === 1 ? 's' : ''} attention
        </div>
        <button className="btn ghost" style={{ padding: 2, minHeight: 22, minWidth: 22 }} aria-label="Close" onClick={() => setHidden(true)}>
          <XIcon size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((d) => (
          <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div>
              <Link to="/subscriptions" style={{ fontWeight: 600, fontSize: 13 }} onClick={() => setHidden(true)}>{d.subscription.name}</Link>
              <div className="footer-note">
                {fmtMoney(d.subscription.amount, d.subscription.currencyCode)}
                {d.alert.daysBefore != null ? ` · renews soon` : ` · reminder`}
              </div>
            </div>
            <button className="btn secondary small" onClick={() => dismissOne(d.key)}>Dismiss</button>
          </div>
        ))}
      </div>
    </div>
  );
}
