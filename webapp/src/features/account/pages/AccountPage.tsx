import { Link } from 'react-router-dom';
import { AppearanceFields } from '../../../components/AppearancePanel';
import { Card, CollapsibleCard } from '../../../components/Card';
import { LogInIcon } from '../../../components/icons';
import { Notice } from '../../../components/Notice';
import { ProfileEditor } from '../../../components/ProfileEditor';
import { requireSignIn } from '../../../components/SignInModal';
import { SyncStatusIndicator, type ModuleSyncStatus } from '../../../components/SyncStatusIndicator';
import { toast } from '../../../components/Toast';
import { signOutUser } from '../../../lib/firebase/auth';
import { useAuthState } from '../../../lib/firebase/useAuthState';

/** Firebase provider ids -> what a non-technical user actually recognizes.
 * Only the two methods this app actually offers (see SignInModal.tsx) need
 * a mapping; anything else falls back to the raw id rather than guessing. */
const PROVIDER_LABEL: Record<string, string> = {
  'google.com': 'Google',
  password: 'Email',
};

/** The global "Rare" tier hub (2026-08-27 redesign, Main/Often/Rare model —
 * see CLAUDE.md's "App-wide UI/UX redesign" section for the full plan).
 * Consolidates what used to be scattered across the sidebar footer
 * (Import/export link, sync status, disclaimer paragraph) plus each
 * module's own duplicated "Account" section (sign-in/profile/sign-out) —
 * this page is now the ONE place all of that lives. Per-module settings
 * (a module's own fee %, CGT rate, CSV import, etc.) deliberately stay on
 * that module's own Settings tab — those are legitimately per-module Rare
 * content, not global, so this hub only links out to them rather than
 * trying to absorb every module's own settings tab into one giant page.
 *
 * "Security" scope (confirmed with the user, not guessed): sign-in method
 * summary + sign out + switch account — no new account-security feature,
 * just surfacing what already exists in one place. */
export function AccountPage({ syncStatuses }: { syncStatuses: ModuleSyncStatus[] }) {
  const { user } = useAuthState();
  const providers = user?.providerData.map((p) => PROVIDER_LABEL[p.providerId] ?? p.providerId) ?? [];

  const switchAccount = async () => {
    await signOutUser();
    toast('Signed out — sign in with a different account when ready.');
    requireSignIn('Sign in with the account you want to switch to.');
  };

  return (
    <div>
      <h1 className="pagetitle">Account</h1>

      {!user ? (
        <Card style={{ marginBottom: 16 }}>
          <p className="footer-note" style={{ marginTop: 0 }}>
            You're browsing without an account — calculators and pages all work, but saving anything
            (a transaction, an entity, a plan) requires signing in first.
          </p>
          <button className="btn" onClick={() => requireSignIn()}>
            <LogInIcon />Sign in
          </button>
        </Card>
      ) : (
        <>
          <CollapsibleCard title={<h3 style={{ margin: 0 }}>Profile</h3>} style={{ marginBottom: 16 }}>
            <ProfileEditor user={user} />
          </CollapsibleCard>

          <CollapsibleCard title={<h3 style={{ margin: 0 }}>Security</h3>} style={{ marginBottom: 16 }}>
            <p className="footer-note" style={{ marginTop: 0 }}>
              Signed in with: <strong>{providers.length ? providers.join(', ') : 'Unknown method'}</strong>
              {user.email ? <> · {user.email}</> : null}
            </p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn secondary" onClick={() => signOutUser().then(() => toast('Signed out.'))}>
                Sign out
              </button>
              <button className="btn secondary" onClick={switchAccount}>
                Switch account
              </button>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title={<h3 style={{ margin: 0 }}>Sync status</h3>} style={{ marginBottom: 16 }}>
            <p className="footer-note" style={{ marginTop: 0, marginBottom: 8 }}>
              One line per module — click to see which, if any, has a sync issue.
            </p>
            <SyncStatusIndicator modules={syncStatuses} />
          </CollapsibleCard>
        </>
      )}

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Appearance</h3>} style={{ marginBottom: 16 }}>
        <div style={{ maxWidth: 320 }}>
          <AppearanceFields />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Data</h3>} style={{ marginBottom: 16 }}>
        <p className="footer-note" style={{ marginTop: 0 }}>
          Export every module's data to one JSON file, or import one back in — a full backup, or a way to
          move data between devices.
        </p>
        <Link to="/app-data" className="btn secondary">Backup / restore all data →</Link>
      </CollapsibleCard>

      <Notice tone="info" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0 }}>
          Every figure in this app is an estimate — verify against your official statement.{' '}
          <Link to="/legal" style={{ color: 'inherit' }}>Read the full Disclaimer, Terms &amp; Privacy →</Link>
        </p>
      </Notice>
    </div>
  );
}
