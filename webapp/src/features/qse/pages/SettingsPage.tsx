import type { User } from 'firebase/auth';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { gridAutoStyle } from '../../../lib/gridStyle';
import { firebaseReady } from '../../../lib/firebase/client';
import { createEmptyWorkbook } from '../../../store/defaultWorkbook';
import { useWorkbookStore } from '../../../store/workbookStore';

// User-reported (2026-09-09, Pending item 121(b)): "many pages still have
// settings while asked to make them global & centralized" — this section
// used to duplicate the global /account hub's own Profile/Sign-in/Sign-out
// UI (Done item 213 built /account specifically to consolidate that).
// Trimmed to just the module-specific cloud-empty upload prompt, matching
// the pattern already applied to Cash/Funds/Rentals/Subscriptions.
function AccountSection({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const workbook = useWorkbookStore((s) => s.workbook);
  const localRowCount =
    workbook.transactions.length + workbook.transfers.length + workbook.adjustments.length;

  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <Notice tone="warning" className="mt-sm">
      <p className="mt-0">
        No data found in the cloud for this account's QSE workbook. This app will <strong>not</strong> upload
        anything automatically — if you expected existing data here and don't see it, stop and investigate
        before uploading (see the on-screen notice from your last session, or ask for help) rather than
        overwriting.
      </p>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={async () => {
          const ok = await confirmDialog(
            `This will overwrite anything currently in the cloud for this account (there is nothing there now, but confirming since this can't be undone).`,
            `Upload ${localRowCount} local row(s) to the cloud?`,
          );
          if (!ok) return;
          setBusy(true);
          try {
            await uploadLocalToCloud();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Something went wrong.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Upload local data to cloud ({localRowCount} rows)
      </button>
    </Notice>
  );
}

// User-requested (2026-09-16): "No need of settings in individual modules!"
// — Default currency and JSON export/import were per-module settings
// duplicating two already-unified hubs: currency is now driven app-wide by
// the Account page's Primary/Secondary/Other ranking (`usePrimaryCurrency`),
// and export/import lives at `/app-data` (Done item 177). Only "Clear all
// data" stays here — a real, destructive, module-scoped action `/app-data`
// has no equivalent for.
function DataManagement() {
  const setWorkbook = useWorkbookStore((s) => s.setWorkbook);

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all local data?');
    if (!ok) return;
    setWorkbook(createEmptyWorkbook());
    toast('All data cleared.');
  };

  return (
    <div>
      <p className="text-muted" style={{ marginTop: 0 }}>
        Currency preferences live on the <Link to="/account">Account page</Link>; whole-app JSON
        export/import lives on the <Link to="/app-data">Data page</Link>.
      </p>
      <div className="row gap-sm">
        <button className="btn secondary" onClick={clearAll}>
          Clear all data
        </button>
      </div>
    </div>
  );
}

// Added 2026-09-17, real financial-loss bug report — see
// `QSESettings.costBasisMethod`'s own doc comment. Mirrors PSX's identical
// card (`features/psx/pages/SettingsPage.tsx`'s `CostBasisSettings`)
// word-for-word except for the QSE-specific fee-model framing (QSE has no
// per-share fee tiering PSX has to worry about, hence "FIFO doesn't matter
// for fees here" — but it still matters for which lot's cost gets
// attributed to a sell, which is the actual bug).
//
// Copy corrected 2026-09-18: real-world research (prompted by the user's
// own "please study how exchanges handle the trades") found FIFO, not
// lowest-cost-first, is what matches a real broker statement — see
// webapp/README.md's "Cost-basis worked examples" section for the full
// citations, including PSX's own NCCPL-mandated FIFO CGT computation.
function CostBasisSettings() {
  const settings = useWorkbookStore((s) => s.workbook.settings);
  const updateSettings = useWorkbookStore((s) => s.updateSettings);
  const method = settings.costBasisMethod ?? 'average';

  return (
    <Card>
      <h3 className="mt-0">Cost basis method</h3>
      <p className="text-muted" style={{ marginTop: -4 }}>
        Average cost (the default, unchanged) blends every buy into one running average, so a sell
        can't be tied to a specific lot — this can make a real remaining loss look smaller (or
        even profitable) once you've deliberately closed out cheap lots, since the reduction gets
        spread across the whole blended position instead of really coming off the lot you sold.
        FIFO and Lowest cost first both track each buy as its own lot instead. <strong>Recommended:
        FIFO</strong> — it sells the oldest lot first, matching the global broker-standard
        convention (the same default the US IRS and major brokers use) and usually the closest
        match to a real broker statement's own Avg Buy Price. Lowest cost first sells the cheapest
        lot first instead — a deliberate "Trader Strategy" view (the same one the Trade Strategy
        page's Partial Trade Advisor always shows, regardless of this setting), not the recommended
        choice for your official numbers. Either mode still needs a manual "Sell this lot"/specific
        allocation for the common case of deliberately protecting one particular lot — see the
        Trade Strategy page. QSE's flat % fee means the fee itself is the same either way — the
        difference is purely which lot's cost gets attributed to a sell. Switching any of these
        immediately recomputes your whole historical P/L (realized P/L, invested amount) from your
        <em> entire</em> transaction history, not stored per-entry — not just future trades.
      </p>
      <Field label="Method" width={220}>
        <Select value={method} onChange={(e) => updateSettings({ costBasisMethod: e.target.value as 'average' | 'fifo' | 'lowestCostFirst' })}>
          <option value="average">Average cost (default)</option>
          <option value="fifo">FIFO lots (oldest first, recommended)</option>
          <option value="lowestCostFirst">Lowest cost first (Trader Strategy)</option>
        </Select>
      </Field>
    </Card>
  );
}

function AmountSettings() {
  const settings = useWorkbookStore((s) => s.workbook.settings);
  const updateSettings = useWorkbookStore((s) => s.updateSettings);

  return (
    <div className="grid-auto" style={{ ...gridAutoStyle(320, 16), alignItems: 'start' }}>
      <Card>
        <h3 className="mt-0">General</h3>
        <div className="row" style={{ gap: 12 }}>
          <Field label="Fee %" width={90}>
            <TextInput type="number" step="0.001" value={settings.feePct} onChange={(e) => updateSettings({ feePct: Number(e.target.value) })} />
          </Field>
          <Field label="Min fee" width={90}>
            <TextInput type="number" step="0.01" value={settings.minFee} onChange={(e) => updateSettings({ minFee: Number(e.target.value) })} />
          </Field>
          <Field label="Tick size" width={90}>
            <TextInput type="number" step="0.001" value={settings.tick} onChange={(e) => updateSettings({ tick: Number(e.target.value) })} />
          </Field>
          <Field label="Currency" width={70}>
            <TextInput value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })} />
          </Field>
          <Field label="Default deposit fee" width={90}>
            <TextInput type="number" step="0.01" value={settings.depositFee} onChange={(e) => updateSettings({ depositFee: Number(e.target.value) })} />
          </Field>
        </div>
      </Card>
      <CostBasisSettings />
    </div>
  );
}

export function SettingsPage({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  return (
    <div>
      <h1 className="pagetitle">Settings</h1>
      <Tabs
        tabs={[
          {
            key: 'account',
            label: 'Account',
            content: (
              <div>
                <p className="text-muted mt-0">
                  Sign-in, profile, appearance, and a whole-app backup live on the{' '}
                  <Link to="/account">Account page →</Link>. What's below is specific to QSE.
                </p>
                <AccountSection cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
              </div>
            ),
          },
          { key: 'data', label: 'Data management', content: <DataManagement /> },
          { key: 'amounts', label: 'Amount settings', content: <AmountSettings /> },
        ]}
      />
    </div>
  );
}
