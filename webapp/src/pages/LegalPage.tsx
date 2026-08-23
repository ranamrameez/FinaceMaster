import { Card } from '../components/Card';

/** Standard disclaimer/terms/privacy boilerplate. Not a substitute for a
 * lawyer's review before a real public launch, but covers the baseline:
 * calculations are estimates, verify against official statements, no
 * liability for financial decisions made using this tool, and a plain-
 * language privacy summary. */
export function LegalPage() {
  return (
    <div>
      <h1 className="pagetitle">Disclaimer, Terms &amp; Privacy</h1>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Calculation accuracy</h3>
        <p>
          FinanceRecorder computes fees, taxes, break-even prices, and profit/loss using settings you configure
          (commission rates, tax rates, tick sizes, etc.). These are <strong>estimates</strong>, not guarantees.
          Brokers, exchanges, and regulators change their fee schedules, tax rules, and rounding conventions
          without notice, and this app cannot always keep pace with every change for every broker.
        </p>
        <p>
          <strong>Always verify figures against your official broker or exchange account statement</strong>{' '}
          before making any financial decision. If a number here disagrees with your statement, trust the
          statement, and please let us know so we can investigate.
        </p>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Not financial advice</h3>
        <p>
          Nothing in this app — including exit-price suggestions, alerts, projections, or the trade calculator —
          constitutes financial, investment, or tax advice. It is a personal record-keeping and planning tool.
          Trading decisions are entirely your own responsibility.
        </p>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Limitation of liability</h3>
        <p>
          This app is provided "as is," without warranty of any kind, express or implied. To the fullest extent
          permitted by law, the developer(s) are not liable for any financial loss, missed opportunity, data
          loss, or other damage arising from your use of, or inability to use, this app — including errors in
          calculations, sync failures, or downtime.
        </p>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Feedback and suggestions</h3>
        <p>
          Feature suggestions, bug reports, and other feedback you submit may be used to improve the app without
          compensation or attribution to you.
        </p>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Privacy</h3>
        <p>
          When you sign in, we store the trading data you enter (transactions, prices, watchlist, notes) and
          basic account info (email, display name, avatar) tied to your account, hosted on Google Firebase. Your
          data is private to your account — we don't sell it or share it with third parties. If you'd like your
          account data deleted, sign out and use "Clear all data" for local data, or contact us to request full
          account deletion.
        </p>
        <p className="footer-note">
          This app uses Firebase Authentication and Realtime Database (Google Cloud infrastructure) to store
          account and trading data securely per-account.
        </p>
      </Card>
    </div>
  );
}
