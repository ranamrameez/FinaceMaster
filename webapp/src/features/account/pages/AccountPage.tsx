import { Link } from 'react-router-dom';
import { AppearanceFields } from '../../../components/AppearancePanel';
import { Card, CollapsibleCard } from '../../../components/Card';
import { ArrowDownIcon, ArrowUpIcon, LogInIcon, XIcon } from '../../../components/icons';
import { IconButton } from '../../../components/ui/IconButton';
import { CurrencyQuickAdd } from '../../../components/CurrencyQuickAdd';
import { Notice } from '../../../components/Notice';
import { ProfileEditor } from '../../../components/ProfileEditor';
import { requireSignIn } from '../../../components/SignInModal';
import { SyncStatusIndicator, type ModuleSyncStatus } from '../../../components/SyncStatusIndicator';
import { toast } from '../../../components/Toast';
import { signOutUser } from '../../../lib/firebase/auth';
import { useAuthState } from '../../../lib/firebase/useAuthState';
import { gridAutoStyle } from '../../../lib/gridStyle';
import { useEnabledCurrenciesStore } from '../../../store/enabledCurrenciesStore';

/** Index 0 = Primary, index 1 = Secondary, everything else = Other — see
 * `useEnabledCurrencies`'s own doc comment for the full tier design. */
function tierLabel(index: number): string {
  if (index === 0) return 'Primary';
  if (index === 1) return 'Secondary';
  return 'Other';
}

/** User-requested (2026-09-16, "ordering in currency-grouped displays" /
 * "let the user reorder"): the ranking itself is just `enabledCodes`' own
 * array order (see `useEnabledCurrencies`'s doc comment) — this is the one
 * place a user can actually change that order, since `toggle()` only ever
 * APPENDS a newly-enabled currency to the end. Only rendered once there's
 * more than one currency to rank (a single-currency user has nothing to
 * reorder, per the "single currency user doesn't need complexity"
 * instruction). */
function CurrencyRanking() {
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  const setEnabledCodes = useEnabledCurrenciesStore((s) => s.setEnabledCodes);
  if (!enabledCodes || enabledCodes.length < 2) return null;

  const move = (index: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= enabledCodes.length) return;
    const next = [...enabledCodes];
    [next[index], next[target]] = [next[target], next[index]];
    setEnabledCodes(next);
  };

  return (
    <div className="mt-sm">
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 6 }}>
        Rank your currencies — the top one (Primary) becomes the default in new-record forms and
        currency pickers app-wide; the rest fill in after it in this same order.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {enabledCodes.map((code, i) => (
          <div key={code} className="row" style={{ alignItems: 'center', gap: 8 }}>
            <span className="pill pill-info" style={{ minWidth: 70, textAlign: 'center' }}>{tierLabel(i)}</span>
            <span style={{ fontWeight: 600 }}>{code}</span>
            <span style={{ flex: 1 }} />
            <IconButton label="Move up" icon={<ArrowUpIcon size={12} />} disabled={i === 0} onClick={() => move(i, 'up')} />
            <IconButton label="Move down" icon={<ArrowDownIcon size={12} />} disabled={i === enabledCodes.length - 1} onClick={() => move(i, 'down')} />
          </div>
        ))}
      </div>
    </div>
  );
}

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
 * Appearance), so it lives on this same hub.
 *
 * Redesigned 2026-09-16 after a direct user complaint: "'Reset to all
 * currencies' button is illogical. no one is going to work only these
 * currencies. in DB save a list of all currencies and let the user choose
 * for his currency or more simply let the user type his currency(ies)."
 * The old design showed EVERY bundled currency as a permanent chip grid
 * (fine at 11, unwieldy once `CURRENCIES` grew to ~50 the same day to
 * genuinely answer "save a list of all currencies" — see that file's own
 * doc comment) with a "Reset to all" button that checked literally every
 * one of them, which is exactly the nonsensical default the user flagged.
 * Now: a compact removable-chip row for only the currencies actually
 * enabled, plus `CurrencyQuickAdd`'s type-ahead input to add more — "let
 * the user type his currency(ies)," the user's own preferred, simpler
 * option. Unchecking/removing the last remaining currency is still a no-op
 * with an explanatory toast (`useEnabledCurrenciesStore.toggle` itself
 * refuses this) — a picker with nothing enabled would hide every currency
 * selector in the app, including the one needed to add one back. */
function CurrenciesSection() {
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  const toggle = useEnabledCurrenciesStore((s) => s.toggle);
  const setEnabledCodes = useEnabledCurrenciesStore((s) => s.setEnabledCodes);

  // `null` means "not configured, every currency is available everywhere"
  // (see `useEnabledCurrenciesStore`'s own doc comment) — starting a real
  // subset from scratch here, rather than reusing `toggle()`'s own
  // "base = every CURRENCIES code, then flip one" behavior, avoids
  // rendering all ~50 bundled currencies as removable chips just to add
  // the first one (and avoids the footgun of `toggle()` on an
  // already-implicitly-enabled code silently EXCLUDING it instead of
  // being a no-op).
  const addCode = (code: string) => {
    if (enabledCodes === null) {
      setEnabledCodes([code]);
      return;
    }
    if (enabledCodes.includes(code)) {
      toast(`${code} is already added.`);
      return;
    }
    toggle(code);
  };

  const removeCode = (code: string) => {
    if (!toggle(code)) toast('Keep at least one currency.');
  };

  return (
    <CollapsibleCard title={<h3 className="m-0">Currencies</h3>}>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 8 }}>
        Which currencies show up in a currency picker across the app. A currency your own data
        already uses always stays available, even if not added here.
      </p>
      {enabledCodes === null ? (
        <div className="text-muted" style={{ marginBottom: 8 }}>
          Every currency is currently available everywhere — add the one(s) you actually use
          below to narrow the pickers down to just those.
        </div>
      ) : (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {enabledCodes.map((code) => (
            <button key={code} className="chip active" title="Remove" onClick={() => removeCode(code)}>
              {code} <XIcon size={10} />
            </button>
          ))}
        </div>
      )}
      <div className="mt-sm">
        <CurrencyQuickAdd excludeCodes={enabledCodes ?? []} onAdd={addCode} />
      </div>
      <CurrencyRanking />
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
