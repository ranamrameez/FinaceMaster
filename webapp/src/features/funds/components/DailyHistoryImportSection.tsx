import { useRef, useState } from 'react';
import { Card, MoneyValue } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Notice } from '../../../components/Notice';
import { PlusIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import {
  averagePeriodPL,
  mergeDailyImportIntoWorkbook,
  parseDailyBalanceRows,
  reconstructFundDailyHistory,
  suggestFundMatch,
  type DailyBalanceRow,
  type DailyReconstructionResult,
  type FundDailyImportItem,
} from '../../../lib/calc/fundsDailyHistoryImport';
import { parseFundsSnapshotRows, type FundSnapshotRow } from '../../../lib/calc/fundsSnapshotImport';
import { parseXlsxWorkbook } from '../../../lib/xlsxReader';
import { CURRENCIES } from '../../../lib/currencies';
import { fmtMoney, fmtPrice } from '../../../lib/format';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import type { Fund } from '../../../types/fundsWorkbook';

const uid = () => crypto.randomUUID();
const CATEGORIES: Fund['category'][] = ['Equity', 'Debt', 'Hybrid', 'International', 'Other'];

interface SheetPlan {
  sheetName: string;
  dailyRows: DailyBalanceRow[];
  reconstruction: DailyReconstructionResult;
  lastBalance: number;
  matchedIdentity: FundSnapshotRow | null;
  include: boolean;
  targetFundId: string; // '' means "create new"
  newName: string;
  newCode: string;
  newPlatform: string;
}

/** Imports a *daily* balance-tracking workbook (one sheet per fund, a row
 * per day: Date/PrvBlc/NewBlc/Profit-Loss) — a fundamentally different,
 * richer source than the single-row-per-fund Snapshot Import CSV. See
 * `lib/calc/fundsDailyHistoryImport.ts` for the full reconstruction
 * design (real per-day BUY/SELL/NAV history instead of one synthetic
 * transaction, plus real average monthly/annual organic P&L). Matching a
 * sheet to an EXISTING fund REPLACES that fund's transactions wholesale —
 * the whole point of this importer over the Snapshot Import is that a
 * balance-only snapshot throws away the day-by-day path once it's
 * available, so this deliberately does not stack alongside a prior
 * snapshot-derived transaction. */
export function DailyHistoryImportSection() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const ensureSignedIn = useEnsureSignedIn();
  const [lastCurrency, setLastCurrency] = useLastCurrency('funds', 'USD');
  const fileInput = useRef<HTMLInputElement>(null);

  const [plans, setPlans] = useState<SheetPlan[] | null>(null);
  const [ignoredSheets, setIgnoredSheets] = useState<string[]>([]);
  const [currencyCode, setCurrencyCode] = useState(lastCurrency);
  const [defaultCategory, setDefaultCategory] = useState<Fund['category']>('Other');
  const [busy, setBusy] = useState(false);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      let sheets;
      try {
        sheets = parseXlsxWorkbook(buffer);
      } catch {
        toast('Could not read that file — is it a valid .xlsx workbook?');
        return;
      }

      let identities: FundSnapshotRow[] = [];
      const dailySheets: { name: string; rows: DailyBalanceRow[] }[] = [];
      const skipped: string[] = [];
      for (const sheet of sheets) {
        if (sheet.rows.length < 2) {
          skipped.push(sheet.name);
          continue;
        }
        const daily = parseDailyBalanceRows(sheet.rows[0], sheet.rows.slice(1));
        if (daily && daily.length) {
          dailySheets.push({ name: sheet.name, rows: daily });
          continue;
        }
        if (!identities.length) {
          const snapshot = parseFundsSnapshotRows(sheet.rows);
          if (snapshot.length) {
            identities = snapshot;
            continue;
          }
        }
        skipped.push(sheet.name);
      }

      if (!dailySheets.length) {
        toast('No daily balance sheets found — expected a Date/PrvBlc/NewBlc column header on at least one sheet.');
        return;
      }

      const newPlans: SheetPlan[] = dailySheets.map(({ name, rows }) => {
        const reconstruction = reconstructFundDailyHistory(rows);
        const lastBalance = rows[rows.length - 1].newBlc;
        const matchedIdentity = suggestFundMatch(lastBalance, identities);
        const existingByCode = matchedIdentity
          ? workbook.funds.filter((f) => f.code.toUpperCase() === matchedIdentity.code)
          : [];
        const targetFundId = existingByCode.length === 1 ? existingByCode[0].id : '';
        return {
          sheetName: name,
          dailyRows: rows,
          reconstruction,
          lastBalance,
          matchedIdentity,
          include: true,
          targetFundId,
          newName: matchedIdentity?.name ?? name,
          newCode: matchedIdentity?.code ?? '',
          newPlatform: matchedIdentity?.bank ?? '',
        };
      });

      setPlans(newPlans);
      setIgnoredSheets(skipped);
      toast(`Found ${newPlans.length} daily balance sheet(s)${identities.length ? ` and matched against ${identities.length} fund(s) from the Summary sheet` : ''}.`);
    };
    reader.readAsArrayBuffer(file);
  };

  const updatePlan = (i: number, patch: Partial<SheetPlan>) => {
    if (!plans) return;
    setPlans(plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const runImport = async () => {
    if (!plans) return;
    const active = plans.filter((p) => p.include);
    if (!active.length) return toast('Nothing selected to import.');
    const missingCode = active.find((p) => !p.targetFundId && !p.newCode.trim());
    if (missingCode) return toast(`Enter a fund code for "${missingCode.sheetName}" (or pick an existing fund to replace).`);

    const replacing = active.filter((p) => p.targetFundId);
    const creating = active.filter((p) => !p.targetFundId);
    const existingTxCount = replacing.reduce(
      (sum, p) => sum + workbook.transactions.filter((t) => t.ticker === p.targetFundId).length,
      0,
    );

    const parts: string[] = [];
    if (creating.length) parts.push(`create ${creating.length} new fund(s)`);
    if (replacing.length) parts.push(`REPLACE ${existingTxCount} existing transaction(s) across ${replacing.length} fund(s)`);
    const ok = await confirmDialog(
      `This will ${parts.join(' and ')} with the reconstructed daily history (${active.reduce((s, p) => s + p.reconstruction.transactions.length, 0)} new transactions total). This cannot be undone.`,
      'Import daily balance history?',
    );
    if (!ok) return;

    if (!(await ensureSignedIn('Sign in to import funds.'))) return;
    setBusy(true);
    try {
      const items: FundDailyImportItem[] = active.map((p) => {
        if (p.targetFundId) return { fundId: p.targetFundId, reconstruction: p.reconstruction };
        const fundId = uid();
        const newFund: Fund = {
          id: fundId,
          name: p.newName.trim() || p.sheetName,
          code: p.newCode.trim().toUpperCase(),
          platform: p.newPlatform.trim(),
          category: defaultCategory,
          currencyCode,
        };
        return { fundId, newFund, reconstruction: p.reconstruction };
      });
      const result = mergeDailyImportIntoWorkbook(items, workbook);
      setWorkbook({ ...workbook, ...result });
      setLastCurrency(currencyCode);
      toast(`Imported daily history for ${active.length} fund(s).`);
      setPlans(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        For a workbook that tracks each fund's balance day by day (one sheet per fund, a Date / PrvBlc / NewBlc row
        per update) rather than just a final snapshot. This reconstructs the real buy/sell/NAV path — separating
        actual deposits and withdrawals from organic growth — so average monthly and annual P&amp;L are computed
        from your real update history, not guessed from a single ending balance. Matching a sheet to a fund you
        already have <strong>replaces that fund's transactions entirely</strong> with the reconstructed history —
        the point of this importer is to stop discarding your day-by-day data, not add to what's already there.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn secondary" onClick={() => fileInput.current?.click()}>Choose XLSX file</button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
        {plans && (
          <>
            <Field label="Currency for new funds" width={140}>
              <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
            <Field label="Category for new funds" width={160}>
              <Select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value as Fund['category'])}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </>
        )}
      </div>

      {plans && ignoredSheets.length > 0 && (
        <Notice tone="info" style={{ marginBottom: 12 }}>
          Ignored {ignoredSheets.length} sheet(s) with no recognizable Date/PrvBlc/NewBlc or FundCode header:{' '}
          {ignoredSheets.join(', ')}.
        </Notice>
      )}

      {plans?.map((p, i) => {
        const avgMonthly = averagePeriodPL(p.reconstruction.monthlyPL);
        const avgYearly = averagePeriodPL(p.reconstruction.yearlyPL);
        const finalNav = p.reconstruction.navPoints.length
          ? p.reconstruction.navPoints[p.reconstruction.navPoints.length - 1].price
          : null;
        const deposits = p.reconstruction.transactions.filter((t) => t.action === 'BUY').length;
        const withdrawals = p.reconstruction.transactions.filter((t) => t.action === 'SELL').length;
        const finalUnits = p.reconstruction.transactions.reduce((s, t) => s + (t.action === 'BUY' ? t.shares : -t.shares), 0);
        const finalValue = finalNav !== null ? finalUnits * finalNav : 0;
        const existingFund = p.targetFundId ? workbook.funds.find((f) => f.id === p.targetFundId) : null;
        const existingTxCount = p.targetFundId ? workbook.transactions.filter((t) => t.ticker === p.targetFundId).length : 0;
        const currencyForDisplay = existingFund?.currencyCode ?? currencyCode;

        return (
          <Card key={p.sheetName} style={{ marginBottom: 16, opacity: p.include ? 1 : 0.55 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.sheetName}</div>
                <div className="footer-note">
                  {p.dailyRows[0]?.date} → {p.dailyRows[p.dailyRows.length - 1]?.date} · {p.dailyRows.length} updates ·{' '}
                  {deposits} deposit(s), {withdrawals} withdrawal(s)
                  {p.matchedIdentity && <> · matched Summary row "{p.matchedIdentity.name}" ({p.matchedIdentity.code})</>}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={p.include} onChange={(e) => updatePlan(i, { include: e.target.checked })} />
                Include
              </label>
            </div>

            {p.reconstruction.warnings.length > 0 && (
              <Notice tone="warning" style={{ marginTop: 8 }}>
                {p.reconstruction.warnings.map((w, wi) => <div key={wi}>{w}</div>)}
              </Notice>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8, marginTop: 12 }}>
              <div className="stat-card card"><div className="label">Reconstructed value</div><MoneyValue n={finalValue} currency={currencyForDisplay} /></div>
              {p.matchedIdentity && (
                <div className="stat-card card">
                  <div className="label">Reported balance</div>
                  <div className="value">{fmtMoney(p.matchedIdentity.currentBalance, currencyForDisplay)}</div>
                </div>
              )}
              <div className="stat-card card"><div className="label">Current NAV</div><div className="value">{finalNav !== null ? fmtPrice(finalNav) : '—'}</div></div>
              <div className="stat-card card"><div className="label">Avg monthly P&amp;L ({p.reconstruction.monthlyPL.length} mo.)</div><MoneyValue n={avgMonthly} currency={currencyForDisplay} /></div>
              <div className="stat-card card"><div className="label">Avg annual P&amp;L ({p.reconstruction.yearlyPL.length} yr.)</div><MoneyValue n={avgYearly} currency={currencyForDisplay} /></div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Field label="Import into" width={260}>
                <Select value={p.targetFundId} onChange={(e) => updatePlan(i, { targetFundId: e.target.value })}>
                  <option value="">Create new fund</option>
                  {workbook.funds.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
                </Select>
              </Field>
              {!p.targetFundId ? (
                <>
                  <Field label="Fund name" width={200}>
                    <TextInput value={p.newName} onChange={(e) => updatePlan(i, { newName: e.target.value })} />
                  </Field>
                  <Field label="Fund code" width={110}>
                    <TextInput value={p.newCode} onChange={(e) => updatePlan(i, { newCode: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Platform" width={160}>
                    <TextInput value={p.newPlatform} onChange={(e) => updatePlan(i, { newPlatform: e.target.value })} />
                  </Field>
                </>
              ) : (
                <Notice tone="warning" style={{ flex: 1, minWidth: 260 }}>
                  Will replace {existingTxCount} existing transaction(s) on "{existingFund?.name}" with{' '}
                  {p.reconstruction.transactions.length} reconstructed entries.
                </Notice>
              )}
            </div>
          </Card>
        );
      })}

      {plans && (
        <button className="btn" disabled={busy} onClick={runImport}>
          <PlusIcon />Import {plans.filter((p) => p.include).length} fund{plans.filter((p) => p.include).length === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
