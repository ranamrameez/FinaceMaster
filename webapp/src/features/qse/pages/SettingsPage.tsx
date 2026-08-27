import type { User } from 'firebase/auth';
import { useRef, useState } from 'react';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { LogInIcon } from '../../../components/icons';
import { Field, TextInput } from '../../../components/ui/Field';
import { ProfileEditor } from '../../../components/ProfileEditor';
import { signOutUser } from '../../../lib/firebase/auth';
import { firebaseReady } from '../../../lib/firebase/client';
import { requireSignIn } from '../../../components/SignInModal';
import { createEmptyWorkbook } from '../../../store/defaultWorkbook';
import { useWorkbookStore } from '../../../store/workbookStore';
import type { Workbook } from '../../../types/workbook';

function AccountSection({
  user,
  syncStatus,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const workbook = useWorkbookStore((s) => s.workbook);
  const localRowCount =
    workbook.transactions.length + workbook.transfers.length + workbook.adjustments.length;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseReady) {
    return <p className="footer-note">Cloud sync is unavailable — Firebase failed to load in this browser.</p>;
  }

  if (user) {
    return (
      <>
        <ProfileEditor user={user} />
        <p className="footer-note" style={{ marginTop: 8 }}>{syncStatus}</p>
        {cloudEmpty && (
          <Notice tone="warning" style={{ marginTop: 8 }}>
            <p style={{ marginTop: 0 }}>
              No data found in the cloud for this account. This app will <strong>not</strong> upload
              anything automatically — if you expected existing data here and don't see it, stop and
              investigate before uploading (see the on-screen notice from your last session, or ask
              for help) rather than overwriting.
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
                run(uploadLocalToCloud);
              }}
            >
              Upload local data to cloud ({localRowCount} rows)
            </button>
          </Notice>
        )}
        <button className="btn secondary" disabled={busy} onClick={() => run(signOutUser)} style={{ marginTop: 8 }}>
          Sign out
        </button>
      </>
    );
  }

  return (
    <>
      <p className="footer-note">{syncStatus}</p>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => requireSignIn()}>
        <LogInIcon />Sign in
      </button>
    </>
  );
}

function DataManagement() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const setWorkbook = useWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qse-workbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<Workbook>;
        setWorkbook({ ...createEmptyWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all local data?');
    if (!ok) return;
    setWorkbook(createEmptyWorkbook());
    toast('All data cleared.');
  };

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <button className="btn secondary" onClick={exportJSON}>
        Export JSON
      </button>
      <button className="btn secondary" onClick={() => fileInput.current?.click()}>
        Import JSON
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importJSON(file);
          e.target.value = '';
        }}
      />
      <button className="btn secondary" onClick={clearAll}>
        Clear all data
      </button>
    </div>
  );
}

function AmountSettings() {
  const settings = useWorkbookStore((s) => s.workbook.settings);
  const updateSettings = useWorkbookStore((s) => s.updateSettings);

  return (
    <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
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
  user,
  syncStatus,
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
            content: <AccountSection user={user} syncStatus={syncStatus} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />,
          },
          { key: 'data', label: 'Data management', content: <DataManagement /> },
          { key: 'amounts', label: 'Amount settings', content: <AmountSettings /> },
        ]}
      />
    </div>
  );
}
