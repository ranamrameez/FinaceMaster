import type { User } from 'firebase/auth';
import { useRef, useState } from 'react';
import { Card } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { LogInIcon, SaveIcon } from '../../../components/icons';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { signOutUser } from '../../../lib/firebase/auth';
import { firebaseReady } from '../../../lib/firebase/client';
import { saveProfile } from '../../../lib/firebase/profile';
import { useProfile } from '../../../lib/firebase/useProfile';
import { requireSignIn } from '../../../components/SignInModal';
import { createEmptyPSXWorkbook } from '../../../store/defaultPsxWorkbook';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { PSXWorkbook } from '../../../types/psxWorkbook';

function ProfileEditor({ user }: { user: User }) {
  const profile = useProfile(user);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarEmoji, setAvatarEmoji] = useState(profile.avatarEmoji);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  if (!dirty && (displayName !== profile.displayName || avatarEmoji !== profile.avatarEmoji)) {
    setDisplayName(profile.displayName);
    setAvatarEmoji(profile.avatarEmoji);
  }

  const initial = (displayName || user.email || user.phoneNumber || '?').charAt(0).toUpperCase();

  const save = async () => {
    setBusy(true);
    try {
      await saveProfile(user, { displayName: displayName.trim(), avatarEmoji: avatarEmoji.trim() });
      toast('Profile saved.');
      setDirty(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--on-accent-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 40px', fontSize: 18,
        }}
      >
        {avatarEmoji || initial}
      </div>
      <input
        placeholder="Display name"
        value={displayName}
        onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
        style={{ width: 160 }}
      />
      <input
        placeholder="Avatar emoji"
        value={avatarEmoji}
        maxLength={4}
        onChange={(e) => { setAvatarEmoji(e.target.value); setDirty(true); }}
        style={{ width: 90 }}
        title="Pick one or two emoji as your avatar"
      />
      <button className="btn secondary small" disabled={busy || !dirty} onClick={save}>
        <SaveIcon size={12} />Save profile
      </button>
      <span className="footer-note">{user.email || user.phoneNumber || user.uid}</span>
    </div>
  );
}

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
  const workbook = usePSXWorkbookStore((s) => s.workbook);
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
              No data found in the cloud for this account's PSX workbook. This app will <strong>not</strong>{' '}
              upload anything automatically — if you expected existing data here and don't see it, stop and
              investigate before uploading rather than overwriting.
            </p>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={async () => {
                const ok = await confirmDialog(
                  `This will overwrite anything currently in the cloud for this account's PSX data (there is nothing there now, but confirming since this can't be undone).`,
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
  const workbook = usePSXWorkbookStore((s) => s.workbook);
  const setWorkbook = usePSXWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psx-workbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<PSXWorkbook>;
        setWorkbook({ ...createEmptyPSXWorkbook(), ...parsed });
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
    setWorkbook(createEmptyPSXWorkbook());
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

function FeeSettings() {
  const settings = usePSXWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePSXWorkbookStore((s) => s.updateSettings);

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Commission &amp; fees</h3>
      <p className="footer-note" style={{ marginTop: -4 }}>
        Government levies (PSX/NCCPL/SECP/CVT) default to 0 since they vary by broker — check your
        account statement and fill in what your broker actually charges.
      </p>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Commission %" width={90}>
          <TextInput type="number" step="0.001" value={settings.feePct} onChange={(e) => updateSettings({ feePct: Number(e.target.value) })} />
        </Field>
        <Field label="Low-price threshold" width={110}>
          <TextInput type="number" step="0.01" value={settings.lowPriceThreshold} onChange={(e) => updateSettings({ lowPriceThreshold: Number(e.target.value) })} />
        </Field>
        <Field label="Low-price fee (PKR/share)" width={110}>
          <TextInput type="number" step="0.01" value={settings.lowPriceFee} onChange={(e) => updateSettings({ lowPriceFee: Number(e.target.value) })} />
        </Field>
        <Field label="SST %" width={80}>
          <TextInput type="number" step="0.01" value={settings.sstPct} onChange={(e) => updateSettings({ sstPct: Number(e.target.value) })} />
        </Field>
        <Field label="SST included in commission" width={110}>
          <Select value={settings.sstIncludedInCommission ? 'yes' : 'no'} onChange={(e) => updateSettings({ sstIncludedInCommission: e.target.value === 'yes' })}>
            <option value="no">No — added separately</option>
            <option value="yes">Yes — already included</option>
          </Select>
        </Field>
        <Field label="PSX fee %" width={80}>
          <TextInput type="number" step="0.0001" value={settings.psxFeePct} onChange={(e) => updateSettings({ psxFeePct: Number(e.target.value) })} />
        </Field>
        <Field label="NCCPL fee %" width={80}>
          <TextInput type="number" step="0.0001" value={settings.nccplFeePct} onChange={(e) => updateSettings({ nccplFeePct: Number(e.target.value) })} />
        </Field>
        <Field label="SECP levy %" width={80}>
          <TextInput type="number" step="0.0001" value={settings.secpLevyPct} onChange={(e) => updateSettings({ secpLevyPct: Number(e.target.value) })} />
        </Field>
        <Field label="CDC (PKR/share)" width={100}>
          <TextInput type="number" step="0.0001" value={settings.cdcPerShare} onChange={(e) => updateSettings({ cdcPerShare: Number(e.target.value) })} />
        </Field>
        <Field label="CVT % (buy-side)" width={90}>
          <TextInput type="number" step="0.0001" value={settings.cvtPct} onChange={(e) => updateSettings({ cvtPct: Number(e.target.value) })} />
        </Field>
        <Field label="Min fee" width={90}>
          <TextInput type="number" step="0.01" value={settings.minFee} onChange={(e) => updateSettings({ minFee: Number(e.target.value) })} />
        </Field>
      </div>
    </Card>
  );
}

function CGTSettings() {
  const settings = usePSXWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePSXWorkbookStore((s) => s.updateSettings);

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Capital gains tax</h3>
      <p className="footer-note" style={{ marginTop: -4 }}>
        Applied to gains only (a loss generates neither a charge nor a rebate) — shown as an
        estimate on stock pages and the trade calculator, not deducted from realized P/L automatically.
      </p>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Filer status" width={110}>
          <Select value={settings.filerStatus} onChange={(e) => updateSettings({ filerStatus: e.target.value as 'filer' | 'nonfiler' })}>
            <option value="filer">Filer</option>
            <option value="nonfiler">Non-filer</option>
          </Select>
        </Field>
        <Field label="Filer CGT %" width={90}>
          <TextInput type="number" step="0.1" value={settings.cgtFilerPct} onChange={(e) => updateSettings({ cgtFilerPct: Number(e.target.value) })} />
        </Field>
        <Field label="Non-filer CGT %" width={110}>
          <TextInput type="number" step="0.1" value={settings.cgtNonFilerPct} onChange={(e) => updateSettings({ cgtNonFilerPct: Number(e.target.value) })} />
        </Field>
      </div>
    </Card>
  );
}

function CostBasisSettings() {
  const settings = usePSXWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePSXWorkbookStore((s) => s.updateSettings);

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Cost basis method</h3>
      <p className="footer-note" style={{ marginTop: -4 }}>
        Average cost blends every buy into one running average, so a sell can't be tied to a
        specific lot. FIFO tracks each buy as its own lot and sells the oldest one first — more
        accurate, but everything (realized P/L, invested amount, CGT) is recalculated from your
        <em> entire</em> transaction history on every load, not stored per-entry — so switching
        this immediately recomputes your whole historical P/L under the new method, not just
        future trades.
      </p>
      <Field label="Method" width={220}>
        <Select value={settings.costBasisMethod} onChange={(e) => updateSettings({ costBasisMethod: e.target.value as 'average' | 'fifo' })}>
          <option value="average">Average cost (default)</option>
          <option value="fifo">FIFO lots</option>
        </Select>
      </Field>
    </Card>
  );
}

function AmountSettings() {
  const settings = usePSXWorkbookStore((s) => s.workbook.settings);
  const updateSettings = usePSXWorkbookStore((s) => s.updateSettings);

  // README Pending item 63: these 4 sub-cards used to stack full-width one
  // under another (each is just a handful of fields, nowhere near needing
  // the full page width) — a responsive grid lets 2 sit side by side on a
  // wide viewport instead, same pattern the Net Worth page's own two
  // summary cards already established. `FeeSettings` has the most fields
  // by far, so it's left spanning both columns on its own row rather than
  // forced narrow next to a 3-field card.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <FeeSettings />
      </div>
      <CGTSettings />
      <CostBasisSettings />
      <Card>
        <h3 style={{ marginTop: 0 }}>General</h3>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="Tick size" width={90}>
            <TextInput type="number" step="0.01" value={settings.tick} onChange={(e) => updateSettings({ tick: Number(e.target.value) })} />
          </Field>
          <Field label="Currency" width={70}>
            <TextInput value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })} />
          </Field>
          <Field label="Default deposit fee" width={90}>
            <TextInput type="number" step="0.01" value={settings.depositFee} onChange={(e) => updateSettings({ depositFee: Number(e.target.value) })} />
          </Field>
        </div>
      </Card>
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
      <h1 className="pagetitle">PSX Settings</h1>
      <Tabs
        tabs={[
          {
            key: 'account',
            label: 'Account',
            content: <AccountSection user={user} syncStatus={syncStatus} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />,
          },
          { key: 'data', label: 'Data management', content: <DataManagement /> },
          { key: 'amounts', label: 'Fees & amounts', content: <AmountSettings /> },
        ]}
      />
    </div>
  );
}
