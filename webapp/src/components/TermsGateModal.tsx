import { useState } from 'react';
import { useTermsStore } from '../store/termsStore';

/** Blocks the app behind a one-time Disclaimer/Terms acceptance for first-
 * time visitors — legal risk (calculations are estimates, not advice, no
 * liability) applies to anyone reading numbers here, signed in or not, so
 * unlike SignInModal this isn't gated to a write action. Deliberately not
 * built on the shared `Modal` component: this one has no close button and
 * no click-outside-to-dismiss — the only way out is the explicit checkbox
 * + Accept button, so it can't be dismissed without agreeing. Full text
 * stays reachable anytime after via the sidebar's "Disclaimer & Privacy"
 * link to /legal — this is a condensed version, not a replacement. */
export function TermsGateModal() {
  const { accepted, accept } = useTermsStore();
  const [checked, setChecked] = useState(false);

  if (accepted) return null;

  return (
    // z-index 1000, not the shared .modal-overlay's 100: this must sit above
    // every other fixed element (the floating Calculator button is z-index
    // 500) or it'd be visible and clickable right through this "blocking"
    // gate, defeating the point.
    <div className="modal-overlay show" style={{ zIndex: 1000 }}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>Before you continue</h3>
        <p>
          FinanceRecorder computes fees, taxes, break-even prices, and profit/loss using settings you configure —
          these are <strong>estimates</strong>, not guarantees. Brokers, exchanges, and regulators change fee
          schedules, tax rules, and rounding conventions without notice, and figures here can differ from your
          real account statement. <strong>Always verify against your official broker/exchange statement</strong>{' '}
          before making any financial decision.
        </p>
        <p>
          Nothing in this app — including exit-price suggestions, alerts, projections, or the trade calculator —
          is financial, investment, or tax advice. It's a personal record-keeping and planning tool; trading
          decisions are entirely your own responsibility. The app is provided "as is," and to the fullest extent
          permitted by law the developer(s) aren't liable for financial loss, missed opportunity, data loss, or
          other damage arising from using it, including calculation errors, sync failures, or downtime.
        </p>
        <p className="footer-note">
          Full details any time via <strong>Disclaimer &amp; Privacy</strong> in the sidebar.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I have read and accept the Disclaimer, Terms &amp; Privacy.</span>
        </label>
        <button className="btn" disabled={!checked} style={{ marginTop: 12 }} onClick={accept}>
          Accept &amp; continue
        </button>
      </div>
    </div>
  );
}
