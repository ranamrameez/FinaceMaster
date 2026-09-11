import { Link } from 'react-router-dom';
import { AppearanceFields } from '../../../components/AppearancePanel';
import { Card, CollapsibleCard } from '../../../components/Card';
import { LogInIcon } from '../../../components/icons';
import { Notice } from '../../../components/Notice';
import { ProfileEditor } from '../../../components/ProfileEditor';
import { requireSignIn } from '../../../components/SignInModal';
import { SyncStatusIndicator, type ModuleSyncStatus } from '../../../components/SyncStatusIndicator';
import { toast } from '../../../components/Toast';
import { CURRENCIES } from '../../../lib/currencies';
import { signOutUser } from '../../../lib/firebase/auth';
import { useAuthState } from '../../../lib/firebase/useAuthState';
import { gridAutoStyle } from '../../../lib/gridStyle';
import { useEnabledCurrenciesStore } from '../../../store/enabledCurrenciesStore';

/** Firebase provider ids -> what a non-technical user actually recognizes.
 * Only the two methods this app actually offers (see SignInModal.tsx) need
 * a mapping; anything else falls back to the raw id rather than guessing. */
const PROVIDER_LABEL: Record<string, string> = {
  'google.com': 'Google',
  password: 'Email',
};

/** User-requested (2026-09-08): "App setting should let the user choose his
 * currencies... show checkbox/chips rather [than] scrolling through a
 * list... this app supports multiple currencies but not all users are
 * multi-currency!" A global preference (not per-module — same shape as
 * Appearance), so it lives on this same hub. Unchecking the last remaining
 * currency is a no-op with an explanatory toast rather than letting the
 * subset empty out (`useEnabledCurrenciesStore.toggle` itself refuses this,
 * see its own doc comment) — a picker with nothing checked would hide every
 * currency selector in the app, including the one needed to check a box
 * back on. */
function CurrenciesSection() {
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  const toggle = useEnabledCurrenciesStore((s) => s.toggle);
  const setEnabledCodes = useEnabledCurrenciesStore((s) => s.setEnabledCodes);
  const isEnabled = (code: string) => enabledCodes === null || enabledCodes.includes(code);

  return (
    <CollapsibleCard title={<h3 className="m-0">Currencies</h3>}>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 8 }}>
        Pick which currencies show up in a currency picker across the app. A currency your own
        data already uses always stays available, even if unchecked here.
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
      {enabledCodes !== null && (
        <button className="btn secondary small mt-sm" onClick={() => setEnabledCodes(null)}>
          Reset to all currencies
        </button>
      )}
    </CollapsibleCard>
  );
}

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

      {/* User-reported (2026-09): "Everything should be a grid item except
         for tables... Security, Sync, Appearance, Data eating whole page
         width while being one word/line items." None of this page's
         sections are tables — a responsive grid (same `auto-fit`/
         `alignItems:'start'` pattern already used for the Dashboard's own
         "Net worth summary + Exchange rates" pair) lets 2-3 of these short
         cards sit side by side on a normal-width screen instead of each
         claiming the full page width for a couple of lines of content.
         `alignItems:'start'` keeps each card at its own natural height —
         Security's two buttons shouldn't stretch to match Profile's. */}
      <div className="grid-auto" style={{ ...gridAutoStyle(300, 16), marginBottom: 16, alignItems: 'start' }}>
        {!user ? (
          <Card>
            <p className="text-muted mt-0">
              You're browsing without an account — calculators and pages all work, but saving anything
              (a transaction, an entity, a plan) requires signing in first.
            </p>
            <button className="btn" onClick={() => requireSignIn()}>
              <LogInIcon />Sign in
            </button>
          </Card>
        ) : (
          <>
            <CollapsibleCard title={<h3 className="m-0">Profile</h3>}>
              <ProfileEditor user={user} />
            </CollapsibleCard>

            <CollapsibleCard title={<h3 className="m-0">Security</h3>}>
              <p className="text-muted mt-0">
                Signed in with: <strong>{providers.length ? providers.join(', ') : 'Unknown method'}</strong>
                {user.email ? <> · {user.email}</> : null}
              </p>
              <div className="row gap-sm">
                <button className="btn secondary" onClick={() => signOutUser().then(() => toast('Signed out.'))}>
                  Sign out
                </button>
                <button className="btn secondary" onClick={switchAccount}>
                  Switch account
                </button>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title={<h3 className="m-0">Sync status</h3>}>
              <p className="text-muted" style={{ marginTop: 0, marginBottom: 8 }}>
                One line per module — click to see which, if any, has a sync issue.
              </p>
              <SyncStatusIndicator modules={syncStatuses} />
            </CollapsibleCard>
          </>
        )}

        <CollapsibleCard title={<h3 className="m-0">Appearance</h3>}>
          <div style={{ maxWidth: 320 }}>
            <AppearanceFields />
          </div>
        </CollapsibleCard>

        <CurrenciesSection />

        <CollapsibleCard title={<h3 className="m-0">Data</h3>}>
          <p className="text-muted mt-0">
            Export every module's data to one JSON file, or import one back in — a full backup, or a way to
            move data between devices.
          </p>
          <Link to="/app-data" className="btn secondary">Backup / restore all data →</Link>
        </CollapsibleCard>
      </div>

      <Notice tone="info" className="mb-md">
        <p className="m-0">
          Every figure in this app is an estimate — verify against your official statement.{' '}
          <Link to="/legal" style={{ color: 'inherit' }}>Read the full Disclaimer, Terms &amp; Privacy →</Link>
        </p>
      </Notice>
    </div>
  );
}
