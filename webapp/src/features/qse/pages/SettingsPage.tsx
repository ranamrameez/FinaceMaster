import type { User } from 'firebase/auth';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, TextInput } from '../../../components/ui/Field';
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

function AmountSettings() {
  const settings = useWorkbookStore((s) => s.workbook.settings);
  const updateSettings = useWorkbookStore((s) => s.updateSettings);

  return (
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
