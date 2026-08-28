import type { User } from 'firebase/auth';
import { useRef, useState } from 'react';
import { Card } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { LogInIcon } from '../../../components/icons';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { ProfileEditor } from '../../../components/ProfileEditor';
import { signOutUser } from '../../../lib/firebase/auth';
import { firebaseReady } from '../../../lib/firebase/client';
import { requireSignIn } from '../../../components/SignInModal';
import { createEmptyPSXWorkbook } from '../../../store/defaultPsxWorkbook';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { PSXWorkbook } from '../../../types/psxWorkbook';

function AccountSection({
  user,
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
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
    <button className="btn" style={{ marginTop: 8 }} onClick={() => requireSignIn()}>
      <LogInIcon />Sign in
    </button>
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
  const feeMode = settings.feeMode ?? 'itemized';

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Commission &amp; fees</h3>
      {/* User-requested 2026-08-27: an alternative to reconciling several
          itemized fields by hand — one all-in % you've observed from your
          own statement, applied automatically (same-day netting still
          auto-detected from Buy/Sell/date, same as itemized mode). */}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Field label="Fee calculation" width={160}>
          <Select value={feeMode} onChange={(e) => updateSettings({ feeMode: e.target.value as 'itemized' | 'simple' })}>
            <option value="itemized">Itemized (commission + SST + levies)</option>
            <option value="simple">Simple (one all-in %)</option>
          </Select>
        </Field>
        {feeMode === 'simple' && (
          <Field label="All-in commission %" width={130} title="Your broker's total effective rate — commission, SST, and levies combined into one number, applied to the charged side of every trade. The netted side of a same-day pair pays nothing extra.">
            <TextInput type="number" step="0.001" value={settings.allInFeePct ?? 0} onChange={(e) => updateSettings({ allInFeePct: Number(e.target.value) })} />
          </Field>
        )}
      </div>
      {feeMode === 'simple' ? (
        <p className="footer-note" style={{ marginTop: -4 }}>
          Simple mode replaces the itemized fields below — they're kept (and used again) if you
          switch back to Itemized, but have no effect while Simple is selected.
        </p>
      ) : (
        <p className="footer-note" style={{ marginTop: -4 }}>
          Government levies (PSX/NCCPL/SECP/CVT) default to 0 since they vary by broker — check your
          account statement and fill in what your broker actually charges.
        </p>
      )}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', opacity: feeMode === 'simple' ? 0.5 : 1 }}>
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
            content: <AccountSection user={user} cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />,
          },
          { key: 'data', label: 'Data management', content: <DataManagement /> },
          { key: 'amounts', label: 'Fees & amounts', content: <AmountSettings /> },
        ]}
      />
    </div>
  );
}
