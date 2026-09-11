import type { User } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Doughnut, Line } from 'react-chartjs-2';
import { Card, CollapsibleCard, EntityCard, MoneyValue } from '../../../components/Card';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Notice';
import { TickerLogo } from '../../../components/TickerLogo';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { ArchiveIcon, CheckIcon, EditIcon, PlusIcon, RestoreIcon, SaveIcon, StarIcon, TransferIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { PendingToggle } from '../../../components/ui/PendingToggle';
import { IconButton } from '../../../components/ui/IconButton';
import { FabPanel } from '../../../components/ui/Fab';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { RecordDetailModal } from '../../../components/RecordDetailModal';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { defaultTimeForDate, defaultTimezoneForCurrency, nowTime } from '../../../lib/datetime';
import { useEnabledCurrencies } from '../../../hooks/useEnabledCurrencies';
import { useLastCurrency } from '../../../hooks/useLastCurrency';
import { getMarketPrice } from '../../../lib/calc';
import { pendingShareDeltaByTicker } from '../../../lib/calc/positions';
import { allocationByCategory, balanceUpdateHistory, brokerTotalsByCurrency, contributionVsValueSeries, expectedPLRate, fundCategoryLabel, fundNetProfit, projectInvestmentReturn } from '../../../lib/calc/fundsModule';
import { CategorySelect } from '../../../components/CategorySelect';
import { useCategoryStore } from '../../../store/categoryStore';
import { UNCATEGORIZED_ID } from '../../../lib/categories';
import { impliedFundNav } from '../../../lib/calc/fundsDailyHistoryImport';
import {
  buildFundsImportPlan,
  materializeFundsImport,
  parseFundsSnapshotCSV,
  type FundSnapshotPlanRow,
  type FundSnapshotRow,
} from '../../../lib/calc/fundsSnapshotImport';
import { toCSV } from '../../../lib/csv';
import { getDailyPriceHistory } from '../../../lib/calc/priceHistory';
import { transferRunningBalance } from '../../../lib/calc/transferBalance';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { dlDoughnut, dlLine } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { cssVar, tickerColor } from '../../../lib/cssVar';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { ReorderButtons } from '../../../components/ui/ReorderButtons';
import { dateOnlyMs } from '../../../lib/datetime';
import { firebaseReady } from '../../../lib/firebase/client';
import { confirmAndDeleteLinkable, propagateLinkedEdit, resolveLinkedEdit } from '../../../lib/linkCascade';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { createEmptyFundsWorkbook } from '../../../store/defaultFundsWorkbook';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath, useLinkSideLabel } from '../../transfers/pages/TransferLinksPage';
import type { Broker, Fund, FundsWorkbook } from '../../../types/fundsWorkbook';
import type { Transaction, Transfer } from '../../../types/workbook';
import { useFundsDerived } from '../hooks/useFundsDerived';
import { ChartCard } from '../../qse/components/ChartCard';
import { gridAutoStyle } from '../../../lib/gridStyle';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

function emptyFund(defaultCurrency: string, brokerId?: string): Fund {
  return { id: '', name: '', code: '', platform: '', currencyCode: defaultCurrency, brokerId };
}

/* ============================== Add fund ============================== */

/** Floating "add a fund" button (user feedback 2026-08-27: "who adds
 * Funds... daily? [entity add/edit] isn't a routine task, use FABs" — same
 * round-FAB + popup pattern already established for EMI/Banking/Cash/Bank
 * Planning, README Done items 166/170). */
/** User-reported (2026-08-28, real audit after "you're ignoring what's
 * asked for"): Bank's and EMI's landing FABs shipped with Transfers
 * alongside "Add [entity]," but Funds/Rentals/Personal Loans only ever got
 * Transfers on a specific record's own detail view — contradicting the
 * original ask for one Transfers button reachable everywhere. Matches
 * Bank's/EMI's landing-FAB shape exactly now: Transfers with no `ref`
 * pre-filled, still choosable from `SideFields`' own dropdown inside the
 * modal. */
function AddFundFab() {
  const [open, setOpen] = useState<'fund' | 'transfer' | 'helper' | 'broker' | null>(null);
  const defaultCurrency = useFundsWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const ensureSignedIn = useEnsureSignedIn();
  const [brokerName, setBrokerName] = useState('');
  const submitBroker = async () => {
    if (!brokerName.trim()) return toast('Enter a broker name.');
    if (!(await ensureSignedIn('Sign in to save a broker.'))) return;
    setWorkbook({ ...workbook, brokers: [...workbook.brokers, { id: uid(), name: brokerName.trim() }] });
    toast('Broker added.');
    setBrokerName('');
    setOpen(null);
  };
  return (
    <>
      <FabPanel
        actions={[
          { label: 'Add a fund', icon: <PlusIcon />, onClick: () => setOpen('fund') },
          { label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen('transfer') },
          { label: 'Investment helper', icon: <span>🧮</span>, onClick: () => setOpen('helper') },
          // Pending item 115(b): grouped here rather than a second floating
          // button, same "don't stack a second FAB" rule Bank's own "Add a
          // bank" action already follows (Done item 239).
          { label: 'Add a broker', icon: <PlusIcon />, onClick: () => setOpen('broker') },
        ]}
      />
      {open === 'fund' && (
        <Modal title="Add a fund" onClose={() => setOpen(null)}>
          <AddFundForm onSaved={() => setOpen(null)} />
        </Modal>
      )}
      {open === 'transfer' && <TransactionEntryModal defaultFinance={{ module: 'funds', currencyCode: defaultCurrency }} onClose={() => setOpen(null)} />}
      {open === 'helper' && <InvestmentHelperModal onClose={() => setOpen(null)} />}
      {open === 'broker' && (
        <Modal title="Add a broker" onClose={() => setOpen(null)}>
          <Field label="Broker name" width={220} required>
            <TextInput value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="e.g. Al Rajhi Capital" />
          </Field>
          <div className="d-flex justify-center" style={{ marginTop: 16 }}>
            <button className="btn" onClick={submitBroker}><SaveIcon />Save</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Pending item 115(b): "Same should happen with Funds... i want to see my
 * amounts with each broker/investment firm." Mirrors Bank's `BanksList`
 * exactly (Pending item 115(a)) — a collapsed-by-default `CollapsibleCard`
 * above the plain `FundList` below (rule 1: additive, doesn't restructure
 * that already-tested view). A Broker is purely optional grouping, so a
 * workbook with no brokers created yet shows nothing extra here. */
function BrokersList({ onSelect }: { onSelect: (broker: Broker) => void }) {
  const brokers = useFundsWorkbookStore((s) => s.workbook.brokers);
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(() => brokers.filter((b) => b.isActive === false).length, [brokers]);
  const visibleBrokers = useMemo(
    () => (showArchived ? brokers : brokers.filter((b) => b.isActive !== false)).sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite)),
    [brokers, showArchived],
  );
  if (!brokers.length) return null;
  return (
    <CollapsibleCard title="Brokers" defaultOpen={false}>
      {archivedCount > 0 && (
        <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hide' : 'Show'} closed ({archivedCount})
        </button>
      )}
      <div className="entity-card-grid">
        {visibleBrokers.map((b) => {
          const totals = brokerTotalsByCurrency(b.id, funds, workbook.transactions, workbook.marketPrices);
          const currencies = Object.keys(totals);
          const fundCount = funds.filter((f) => f.brokerId === b.id).length;
          return (
            <EntityCard
              key={b.id}
              title={b.name}
              subtitle={`${fundCount} fund${fundCount === 1 ? '' : 's'}`}
              badge={b.isActive === false ? <span className="pill-warn" style={{ fontSize: 10 }}>Closed</span> : undefined}
              statLabel={currencies.length > 1 ? 'Total (by currency)' : 'Total'}
              stat={
                currencies.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {currencies.map((c) => <MoneyValue key={c} n={totals[c]} currency={c} />)}
                  </div>
                ) : (
                  <span className="text-muted">No funds yet</span>
                )
              }
              onClick={() => onSelect(b)}
            />
          );
        })}
      </div>
    </CollapsibleCard>
  );
}

/** Pending item 115(b)'s own detail view — mirrors `BankDetailPage`'s
 * read-only+Edit-icon convention, inline (via `selectedBroker` state at the
 * `FundsPage` level) rather than a routed page, matching how `FundDetail`
 * itself already works on this module (Funds never adopted per-record
 * routes the way Banking did). Lists every fund linked to this Broker
 * (reusing `EntityCard`) with an "Add fund" FAB that pre-fills `brokerId`. */
function BrokerDetail({ broker, onBack, onSelectFund }: { broker: Broker; onBack: () => void; onSelectFund: (fund: Fund) => void }) {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const { positions } = useFundsDerived();
  const ensureSignedIn = useEnsureSignedIn();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: broker.name, notes: broker.notes ?? '' });
  const linkedFunds = useMemo(() => workbook.funds.filter((f) => f.brokerId === broker.id), [workbook.funds, broker.id]);
  const totals = useMemo(() => brokerTotalsByCurrency(broker.id, workbook.funds, workbook.transactions, workbook.marketPrices), [broker.id, workbook.funds, workbook.transactions, workbook.marketPrices]);
  const [addOpen, setAddOpen] = useState(false);

  const startEdit = () => {
    setDraft({ name: broker.name, notes: broker.notes ?? '' });
    setEditing(true);
  };
  const save = async () => {
    if (!draft.name.trim()) return toast('Enter a broker name.');
    if (!(await ensureSignedIn('Sign in to save broker details.'))) return;
    setWorkbook({ ...workbook, brokers: workbook.brokers.map((b) => (b.id === broker.id ? { ...b, name: draft.name.trim(), notes: draft.notes.trim() || undefined } : b)) });
    toast('Broker updated.');
    setEditing(false);
  };
  const remove = async () => {
    if (!(await confirmDialog(`Delete "${broker.name}"? Its funds stay, just no longer grouped under this broker.`))) return;
    if (!(await ensureSignedIn('Sign in to delete this broker.'))) return;
    setWorkbook({
      ...workbook,
      brokers: workbook.brokers.filter((b) => b.id !== broker.id),
      funds: workbook.funds.map((f) => (f.brokerId === broker.id ? { ...f, brokerId: undefined } : f)),
    });
    toast('Broker deleted.');
    onBack();
  };

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All funds</button>
      <CollapsibleCard
        title={editing ? 'Edit broker' : broker.name}
        defaultOpen
        headerExtra={
          !editing && (
            <>
              <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={startEdit} />
              <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={remove} />
            </>
          )
        }
      >
        {editing ? (
          <div>
            <Field label="Broker name" width={220} required>
              <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Notes (optional)" width={220}>
              <TextInput value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            <div className="row gap-sm mt-sm">
              <button className="btn" onClick={save}><SaveIcon />Save</button>
              <button className="btn secondary" onClick={() => setEditing(false)}><XIcon />Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            {broker.notes && <p className="text-muted mt-0">{broker.notes}</p>}
            <div className="row" style={{ gap: 16 }}>
              {Object.keys(totals).length ? (
                Object.entries(totals).map(([c, n]) => (
                  <div key={c} className="stat-card card" style={hueStyle('var(--accent)')}>
                    <div className="label">Total ({c})</div>
                    <MoneyValue n={n} currency={c} />
                  </div>
                ))
              ) : (
                <p className="text-muted">No funds linked yet.</p>
              )}
            </div>
          </div>
        )}
      </CollapsibleCard>
      <div style={{ marginTop: 16 }}>
        <div className="entity-card-grid">
          {linkedFunds.map((f) => {
            const nav = getMarketPrice(f.id, workbook.marketPrices, workbook.transactions);
            const position = positions.find((p) => p.ticker === f.id);
            const value = (position?.shares ?? 0) * nav;
            return (
              <EntityCard
                key={f.id}
                title={f.name}
                subtitle={f.code}
                statLabel="Value"
                stat={<MoneyValue n={value} currency={f.currencyCode} />}
                onClick={() => onSelectFund(f)}
              />
            );
          })}
        </div>
        {!linkedFunds.length && <p className="text-muted">No funds linked to this broker yet.</p>}
      </div>
      <FabButtonAddFund brokerId={broker.id} open={addOpen} setOpen={setAddOpen} />
    </div>
  );
}

/** Small wrapper so `BrokerDetail` doesn't need its own `FabButton` import
 * duplication — a scoped "Add fund" FAB pre-filling `brokerId`, same
 * pattern as `BankDetailPage`'s own scoped "Add account" FAB. */
function FabButtonAddFund({ brokerId, open, setOpen }: { brokerId: string; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <>
      <FabPanel actions={[{ label: 'Add fund', icon: <PlusIcon />, onClick: () => setOpen(true) }]} />
      {open && (
        <Modal title="Add a fund" onClose={() => setOpen(false)}>
          <AddFundForm initialBrokerId={brokerId} onSaved={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

/** User-requested (2026-09-07): "Investment helper calculator amount to
 * invest in a fund and expected returns on it. allow comparison b/w 2
 * funds there as well/ may use POPUP." Confirmed via AskUserQuestion
 * before building: the rate basis is each fund's OWN historical rate (the
 * same `expectedPLRate()` already powering the "Expected daily/monthly
 * P/L" stat cards elsewhere on this page, via the new `projectInvestment
 * Return()` — no new "manual assumed rate" or XIRR-based path), and the
 * horizon is a fixed Day/Month/Year set shown at once rather than a
 * custom-duration field.
 *
 * A single shared "Amount to invest" applies to BOTH fund slots — an
 * apples-to-apples comparison ("if I put the same $X into either of
 * these, which fares better"), not two independently-typed amounts.
 * Fund B starts unset ("— Compare with another fund —"); picking one adds
 * a second result panel next to Fund A's.
 *
 * Only ACTIVE funds (`isActive !== false`) are offered here — same "hide
 * from pickers for NEW activity, never from totals" convention every other
 * "pick where new money goes" picker in this app already follows (see
 * `SideFields`' own entity lists) — this is squarely a "what if I put NEW
 * money in" tool, not a historical report, so it fits that rule exactly.
 * A fund with fewer than 2 price-history points has no rate to project
 * from at all (`expectedPLRate` returns `null`) — shown as a plain message
 * rather than a broken/zeroed panel. */
function InvestmentHelperModal({ onClose }: { onClose: () => void }) {
  const allFunds = useFundsWorkbookStore((s) => s.workbook.funds);
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const funds = useMemo(() => allFunds.filter((f) => f.isActive !== false), [allFunds]);
  const [amount, setAmount] = useState(1000);
  const [fundAId, setFundAId] = useState(funds[0]?.id ?? '');
  const [fundBId, setFundBId] = useState('');

  const fundA = funds.find((f) => f.id === fundAId);
  const fundB = funds.find((f) => f.id === fundBId);

  const panel = (fund: Fund | undefined) => {
    if (!fund) return null;
    const rate = expectedPLRate(fund.id, workbook.transactions, workbook.priceHistory);
    const projected = rate ? projectInvestmentReturn(amount, rate) : null;
    return (
      <div key={fund.id} className="card" style={{ padding: 12, flex: 1, minWidth: 220 }}>
        <div className="text-muted" style={{ marginBottom: 6 }}>{fund.name} ({fund.currencyCode})</div>
        {!projected ? (
          <p className="text-muted" style={{ margin: 0 }}>Not enough price history yet to project returns for this fund.</p>
        ) : (
          <div className="grid-auto" style={gridAutoStyle(90, 8)}>
            <div className="stat-card card" style={hueStyle(projected.dailyAmount >= 0 ? 'var(--profit)' : 'var(--loss)')}>
              <div className="label">Day</div>
              <MoneyValue n={projected.dailyValue} currency={fund.currencyCode} after={` (${projected.dailyAmount >= 0 ? '+' : ''}${fmtMoney(projected.dailyAmount, fund.currencyCode)})`} />
            </div>
            <div className="stat-card card" style={hueStyle(projected.monthlyAmount >= 0 ? 'var(--profit)' : 'var(--loss)')}>
              <div className="label">Month</div>
              <MoneyValue n={projected.monthlyValue} currency={fund.currencyCode} after={` (${projected.monthlyAmount >= 0 ? '+' : ''}${fmtMoney(projected.monthlyAmount, fund.currencyCode)})`} />
            </div>
            <div className="stat-card card" style={hueStyle(projected.yearlyAmount >= 0 ? 'var(--profit)' : 'var(--loss)')}>
              <div className="label">Year</div>
              <MoneyValue n={projected.yearlyValue} currency={fund.currencyCode} after={` (${projected.yearlyAmount >= 0 ? '+' : ''}${fmtMoney(projected.yearlyAmount, fund.currencyCode)})`} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal title="Investment helper" onClose={onClose}>
      <Tooltip text="Projects what a hypothetical investment might return, based on each fund's own real historical average daily/monthly growth rate — the same rate already shown as 'Expected daily/monthly P/L' elsewhere on this page. Not a promise of future returns.">
        <p className="text-muted" style={{ marginTop: 0, cursor: 'pointer' }}>How this works</p>
      </Tooltip>
      {!funds.length ? (
        <p className="text-muted">No open funds yet — add one first.</p>
      ) : (
        <>
          <div className="row gap-sm">
            <Field label="Amount to invest" width={150} required>
              <TextInput type="number" step="0.01" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
            </Field>
            <Field label="Fund A" width={200}>
              <Select value={fundAId} onChange={(e) => setFundAId(e.target.value)}>
                {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </Field>
            <Field label="Fund B (optional)" width={220}>
              <Select value={fundBId} onChange={(e) => setFundBId(e.target.value)}>
                <option value="">— Compare with another fund —</option>
                {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="row" style={{ gap: 12, marginTop: 12 }}>
            {panel(fundA)}
            {panel(fundB)}
          </div>
        </>
      )}
    </Modal>
  );
}

function AddFundForm({ onSaved, initialBrokerId }: { onSaved?: () => void; initialBrokerId?: string } = {}) {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const addTransaction = useFundsWorkbookStore((s) => s.addTransaction);
  const [lastCurrency, setLastCurrency] = useLastCurrency('funds', 'USD');
  const ensureSignedIn = useEnsureSignedIn();
  const [f, setF] = useState<Fund>(() => emptyFund(lastCurrency, initialBrokerId));
  const currencyOptions = useEnabledCurrencies(f.currencyCode);
  const brokers = useFundsWorkbookStore((s) => s.workbook.brokers);
  const visibleBrokers = useMemo(() => brokers.filter((b) => b.isActive !== false), [brokers]);
  const [initialDate, setInitialDate] = useState(today());
  const [initialAmount, setInitialAmount] = useState(0);
  const [initialNav, setInitialNav] = useState(1);

  const submit = async () => {
    if (!f.name.trim()) return toast('Enter a fund name.');
    if (!f.code.trim()) return toast('Enter a fund code.');
    if (!(await ensureSignedIn('Sign in to save funds.'))) return;
    const id = uid();
    setWorkbook({ ...workbook, funds: [...workbook.funds, { ...f, id, name: f.name.trim(), code: f.code.trim().toUpperCase(), platform: f.platform.trim() }] });
    if (initialAmount > 0 && initialNav > 0) {
      addTransaction({ date: initialDate, ticker: id, action: 'BUY', shares: initialAmount / initialNav, price: initialNav });
    }
    toast(`Fund "${f.name.trim()}" added.`);
    setF(emptyFund(f.currencyCode, initialBrokerId));
    setInitialAmount(0);
    onSaved?.();
  };

  return (
    <div>
      <div className="row gap-sm">
        <Field label="Fund name" width={200} required>
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Vanguard Total World Stock ETF" />
        </Field>
        <Field label="Fund code" width={100} required>
          <TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="e.g. VT" />
        </Field>
        <Field label="Invested via" width={140}>
          <TextInput value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} placeholder="e.g. Fidelity" />
        </Field>
        <Field label="Category" width={160}>
          <CategorySelect value={f.categoryID ?? UNCATEGORIZED_ID} onChange={(categoryID) => setF({ ...f, categoryID })} />
        </Field>
        <Field label="Currency" width={100} required>
          <Select value={f.currencyCode} onChange={(e) => { setF({ ...f, currencyCode: e.target.value }); setLastCurrency(e.target.value); }}>
            {currencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
        {/* Pending item 115(b): grouping under a real Broker entity is
           optional — "no broker yet" is a completely valid state, same
           rule Bank's own account↔Bank picker already follows. */}
        {visibleBrokers.length > 0 && (
          <Field label="Broker (optional)" width={180} title="Group this fund under a Broker entity to see a combined total for everything with that broker.">
            <Select value={f.brokerId ?? ''} onChange={(e) => setF({ ...f, brokerId: e.target.value || undefined })}>
              <option value="">No broker</option>
              {visibleBrokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <p className="text-muted mt-sm">Optional initial investment (leave amount blank to just add the fund with no transactions yet):</p>
      <div className="row gap-sm">
        <Field label="Date">
          <TextInput type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} />
        </Field>
        <Field label="Amount invested" width={130}>
          <TextInput type="number" step="0.01" value={initialAmount || ''} onChange={(e) => setInitialAmount(Number(e.target.value))} />
        </Field>
        <Field label="NAV per unit" width={110}>
          <TextInput type="number" step="0.0001" value={initialNav || ''} onChange={(e) => setInitialNav(Number(e.target.value))} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
        <PlusIcon />Add fund
      </button>
    </div>
  );
}

/* ============================== Fund list ============================== */

/** Overall stats across every fund, shown on the landing view before any
 * fund is opened — user feedback: every module needs an at-a-glance
 * accumulative summary, not just per-fund detail. Aggregate XIRR isn't
 * meaningful to sum/average across funds bought at different times, so
 * this only totals invested/value/profit, same convention as every other
 * module's currency-grouped totals (never blended across currencies). */
function OverallSummary() {
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const { positions, workbook } = useFundsDerived();

  const totals: Record<string, { invested: number; value: number; profit: number; expDaily: number; expMonthly: number }> = {};
  funds.forEach((fund) => {
    const p = positions.find((pos) => pos.ticker === fund.id);
    const invested = p?.invested ?? 0;
    const units = p?.shares ?? 0;
    const nav = getMarketPrice(fund.id, workbook.marketPrices, workbook.transactions);
    const value = units * nav;
    if (!totals[fund.currencyCode]) totals[fund.currencyCode] = { invested: 0, value: 0, profit: 0, expDaily: 0, expMonthly: 0 };
    totals[fund.currencyCode].invested += invested;
    totals[fund.currencyCode].value += value;
    totals[fund.currencyCode].profit += fundNetProfit(p, value);
    // User-reported (2026-09-07): "Expected monthly P/L and others should
    // not count closed positions for future/prediction!" — Expected daily/
    // monthly P/L is a FORWARD-LOOKING projection (see `expectedPLRate`'s
    // own doc comment: "an average of what already happened," extrapolated
    // ahead), which makes no sense for a fund that's explicitly closed
    // (`isActive === false`) or fully withdrawn (`units === 0`) — there's
    // no ongoing position left to keep earning/losing on. Net
    // profit/Invested/Current value above are historical totals, not
    // predictions, so they correctly keep including a closed fund's real
    // past numbers (its realized P/L doesn't stop being real just because
    // the fund is now closed) — only this projection is scoped down.
    if (fund.isActive !== false && units > 0) {
      const rate = expectedPLRate(fund.id, workbook.transactions, workbook.priceHistory);
      totals[fund.currencyCode].expDaily += rate?.dailyAmount ?? 0;
      totals[fund.currencyCode].expMonthly += rate?.monthlyAmount ?? 0;
    }
  });
  const codes = Object.keys(totals);
  if (!codes.length) return null;

  return (
    <div className="grid-auto" style={{ ...gridAutoStyle(150, 8), marginBottom: 16 }}>
      {codes.map((code) => {
        const t = totals[code];
        const profitPct = t.invested > 0 ? (t.profit / t.invested) * 100 : 0;
        const expDailyPct = t.invested > 0 ? (t.expDaily / t.invested) * 100 : 0;
        const expMonthlyPct = t.invested > 0 ? (t.expMonthly / t.invested) * 100 : 0;
        return (
          <div key={code} className="card" style={{ padding: 12 }}>
            <div className="text-muted" style={{ marginBottom: 6 }}>{code}</div>
            <div className="grid-auto" style={gridAutoStyle(110, 8)}>
              <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Invested</div><MoneyValue n={t.invested} currency={code} /></div>
              <div className="stat-card card" style={hueStyle(HUES[6])}><div className="label">Current value</div><MoneyValue n={t.value} currency={code} /></div>
              <div className="stat-card card" style={hueStyle(t.profit >= 0 ? 'var(--profit)' : 'var(--loss)')}><div className="label">Net profit</div><MoneyValue n={t.profit} currency={code} after={` (${profitPct.toFixed(1)}%)`} /></div>
              <div className="stat-card card" style={hueStyle(t.expDaily >= 0 ? 'var(--profit)' : 'var(--loss)')}>
                <Tooltip text="An average of what your funds actually earned/lost per day, based on their real NAV/balance history — not a promise of future returns.">
                  <div className="label clickable">Expected daily P/L</div>
                </Tooltip>
                <MoneyValue n={t.expDaily} currency={code} after={` (${expDailyPct.toFixed(2)}%)`} />
              </div>
              <div className="stat-card card" style={hueStyle(t.expMonthly >= 0 ? 'var(--profit)' : 'var(--loss)')}>
                <Tooltip text="The same average daily rate, scaled to a typical calendar month.">
                  <div className="label clickable">Expected monthly P/L</div>
                </Tooltip>
                <MoneyValue n={t.expMonthly} currency={code} after={` (${expMonthlyPct.toFixed(2)}%)`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** User-requested (2026-09-03): "Funds can also be closed!" — closed funds
 * hidden from this default list behind a "Show closed" toggle, same
 * archive/restore pattern as `AccountsList` (see `Fund.isActive`'s doc
 * comment); their positions still contribute to every total unchanged. */
// Converted from a sortable table to an EntityCard grid (2026-09-09) — a
// real gap found while re-checking README Pending item 114's own scope:
// Done item 270 converted Funds' BrokersList (a secondary list) but never
// this file's own PRIMARY entity list, unlike every other module in that
// rollout. Per UI rule 1/3: entity items belong on cards in a wrap-flex
// grid — dropped this list's own `useSortableRows` usage (its only caller
// in the file) in favor of favorite-first ordering, matching every other
// converted list. Category/Units columns dropped from the card's own
// visible summary (still available on the fund's detail page) — the
// card shows Name+logo, Code, Value, and Net P/L (with XIRR folded into
// the subtitle), same "group related figures, don't drop them" pattern
// as every other converted list's own regrouping.
function FundList({ onSelect }: { onSelect: (fund: Fund) => void }) {
  const allFunds = useFundsWorkbookStore((s) => s.workbook.funds);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const ensureSignedIn = useEnsureSignedIn();
  const { positions, fundXIRR, workbook } = useFundsDerived();
  const categoryRegistry = useCategoryStore((s) => s.workbook.categories);
  const [showClosed, setShowClosed] = useState(false);
  const closedCount = useMemo(() => allFunds.filter((f) => f.isActive === false).length, [allFunds]);
  const funds = useMemo(() => (showClosed ? allFunds : allFunds.filter((f) => f.isActive !== false)), [allFunds, showClosed]);

  // Pending item 115(c): "favorite an entity, to view it on top." Fund CRUD
  // goes through `setWorkbook` directly (no dedicated `updateFund` store
  // action — see this file's own earlier comment on that), same pattern
  // already used for the Archive/Reopen toggle on `FundDetail`.
  const toggleFavorite = async (fund: Fund) => {
    if (!(await ensureSignedIn(fund.isFavorite ? 'Sign in to unfavorite this fund.' : 'Sign in to favorite this fund.'))) return;
    setWorkbook({ ...workbook, funds: workbook.funds.map((f) => (f.id === fund.id ? { ...f, isFavorite: !f.isFavorite } : f)) });
  };

  // Index/Sr# column, user-requested (2026-09-03) — the fund's own stable
  // position in `allFunds` (creation order), independent of the grid's own
  // favorite-first ordering (a re-sorted list shouldn't renumber what
  // fund "#3" is every time favorite status changes).
  type Row = { idx: number; fund: Fund; units: number; invested: number; value: number; profit: number; profitPct: number; xirrPct: number | null };
  const rows: Row[] = funds.map((fund) => {
    const p = positions.find((pos) => pos.ticker === fund.id);
    const units = p?.shares ?? 0;
    const invested = p?.invested ?? 0;
    const nav = getMarketPrice(fund.id, workbook.marketPrices, workbook.transactions);
    const value = units * nav;
    const profit = fundNetProfit(p, value);
    const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
    const rate = fundXIRR(fund.id);
    const idx = allFunds.findIndex((f) => f.id === fund.id) + 1;
    return { idx, fund, units, invested, value, profit, profitPct, xirrPct: rate !== null ? rate * 100 : null };
  });

  const sorted = useMemo(
    () => [...rows].sort((a, b) => Number(!!b.fund.isFavorite) - Number(!!a.fund.isFavorite)),
    [rows],
  );

  return (
    <div>
      {closedCount > 0 && (
        <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={() => setShowClosed((v) => !v)}>
          {showClosed ? 'Hide' : 'Show'} closed ({closedCount})
        </button>
      )}
      {!sorted.length ? (
        <p className="text-muted">
          {allFunds.length ? 'Every fund is closed — click "Show closed" above to see them.' : 'No funds yet — add one above.'}
        </p>
      ) : (
        <div className="entity-card-grid">
          {sorted.map((r) => (
            <EntityCard
              key={r.fund.id}
              title={
                <span className="flex-center-gap4">
                  <span className="text-muted entity-card-sr">#{r.idx}</span>
                  {/* Funds has no known logo CDN of its own (README item 118) — passing
                   * exchange="psx" reuses TickerLogo's "no remote CDN, local-drop-in or
                   * colored-initials fallback only" path rather than QSE's own CDN, which
                   * would 404 for every fund code and burn a wasted network round trip. */}
                  <TickerLogo ticker={r.fund.code} exchange="psx" size="sm" />
                  {r.fund.name}
                </span>
              }
              subtitle={
                <>
                  {r.fund.code} · {fundCategoryLabel(r.fund, categoryRegistry)}
                  {r.xirrPct !== null && <> · XIRR {r.xirrPct.toFixed(1)}%</>}
                </>
              }
              badge={r.fund.isActive === false ? <span className="pill-warn" style={{ fontSize: 10 }}>Closed</span> : undefined}
              statLabel="Value"
              stat={
                <>
                  <MoneyValue n={r.value} currency={r.fund.currencyCode} />
                  <div className="sub">
                    <span className={r.profit >= 0 ? 'pill-positive' : 'pill-negative'}>
                      {fmtMoney(r.profit, r.fund.currencyCode)} ({r.profitPct.toFixed(1)}%)
                    </span>
                  </div>
                </>
              }
              hue={r.profit >= 0 ? 'var(--profit)' : 'var(--loss)'}
              onClick={() => onSelect(r.fund)}
              actions={
                <IconButton
                  label={r.fund.isFavorite ? 'Unfavorite' : 'Favorite'}
                  icon={<StarIcon size={13} filled={r.fund.isFavorite} />}
                  align="right"
                  onClick={() => toggleFavorite(r.fund)}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== Import ============================== */

/* ============================== Snapshot import ============================== */

/** Imports a "portfolio snapshot" CSV — one row per fund with aggregate
 * Total Invested / Withdrawn / Current Balance, as opposed to a dated
 * transaction log (see `lib/calc/fundsSnapshotImport.ts` for the full
 * reasoning and the real-data test that validates it). Deliberately a
 * separate flow from Bank/Cash's "map these columns" statement importer —
 * this source format's columns are fixed, and there's no per-row date to
 * map, only one shared "as of" date for the whole batch. */
function SnapshotImportSection() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const addTransactions = useFundsWorkbookStore((s) => s.addTransactions);
  const setMarketPrice = useFundsWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const [lastCurrency, setLastCurrency] = useLastCurrency('funds', 'USD');
  const fileInput = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<FundSnapshotRow[] | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(today());
  const [currencyCode, setCurrencyCode] = useState(lastCurrency);
  const currencyOptions = useEnabledCurrencies(currencyCode);
  const [defaultCategoryID, setDefaultCategoryID] = useState<string>(UNCATEGORIZED_ID);
  const [busy, setBusy] = useState(false);

  const plan: FundSnapshotPlanRow[] = useMemo(
    () => (rows ? buildFundsImportPlan(rows, workbook.funds) : []),
    [rows, workbook.funds],
  );

  const duplicateCodes = useMemo(() => {
    if (!rows) return [];
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.code, (counts.get(r.code) ?? 0) + 1));
    return [...counts.entries()].filter(([, n]) => n > 1).map(([code]) => code);
  }, [rows]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseFundsSnapshotCSV(String(reader.result));
      if (!parsed.length) {
        toast('No fund rows found — expected a "FundCode" column header.');
        return;
      }
      setRows(parsed);
      toast(`Parsed ${parsed.length} fund row(s) — review below before importing.`);
    };
    reader.readAsText(file);
  };

  const editRow = (i: number, patch: Partial<FundSnapshotRow>) => {
    if (!rows) return;
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const runImport = async () => {
    if (!plan.length) return;
    if (!(await ensureSignedIn('Sign in to import funds.'))) return;
    setBusy(true);
    try {
      const { newFunds, transactions, navUpdates } = materializeFundsImport(plan, {
        snapshotDate,
        currencyCode,
        defaultCategoryID: defaultCategoryID === UNCATEGORIZED_ID ? undefined : defaultCategoryID,
      });
      if (newFunds.length) setWorkbook({ ...workbook, funds: [...workbook.funds, ...newFunds] });
      if (transactions.length) addTransactions(transactions);
      navUpdates.forEach((u) => setMarketPrice(u.ticker, u.price));
      setLastCurrency(currencyCode);
      toast(`Imported ${plan.length} fund(s): ${newFunds.length} new, ${transactions.length} transaction(s).`);
      setRows(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        For a spreadsheet that tracks Total Invested / Withdrawn / Current Balance per fund rather than individual
        dated trades. Since there's no real transaction history in that shape, this reconstructs a buy (and, if
        withdrawn, a sell) dated on the single "as of" date below, at whatever NAV reproduces your reported balances
        exactly — it's an approximation of your real trade history, not a replay of it. Re-importing a fund that
        already has transactions here adds another entry rather than replacing anything, so this is best used once,
        as a starting point.
      </p>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button className="btn secondary" onClick={() => fileInput.current?.click()}>Choose CSV file</button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
        {rows && (
          <>
            <Field label="As-of date" width={140}>
              <TextInput type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} />
            </Field>
            <Field label="Currency" width={100}>
              <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                {currencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
            <Field label="Category for new funds" width={180}>
              <CategorySelect value={defaultCategoryID} onChange={setDefaultCategoryID} />
            </Field>
          </>
        )}
      </div>

      {rows && duplicateCodes.length > 0 && (
        <Notice tone="warning" style={{ marginBottom: 12 }}>
          Fund code{duplicateCodes.length > 1 ? 's' : ''} {duplicateCodes.join(', ')} appear{duplicateCodes.length === 1 ? 's' : ''} more
          than once — each row below still becomes its own fund. If a row is actually a mistake (wrong platform/code
          typed into the wrong line), fix it in the table below before importing rather than after.
        </Notice>
      )}

      {rows && (
        <>
          <div className="table-scroll" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Platform</th><th>Code</th><th>Name</th><th>Invested</th><th>Withdrawn</th><th>Current balance</th><th>Status</th><th>New NAV</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p, i) => (
                  <tr key={i}>
                    <td><TextInput value={p.row.bank} onChange={(e) => editRow(i, { bank: e.target.value })} style={{ width: 140 }} /></td>
                    <td><TextInput value={p.row.code} onChange={(e) => editRow(i, { code: e.target.value.toUpperCase() })} style={{ width: 90 }} /></td>
                    <td><TextInput value={p.row.name} onChange={(e) => editRow(i, { name: e.target.value })} style={{ width: 200 }} /></td>
                    <td>{fmtMoney(p.row.totalInvested, currencyCode)}</td>
                    <td>{fmtMoney(p.row.withdrawn, currencyCode)}</td>
                    <td>{fmtMoney(p.row.currentBalance, currencyCode)}</td>
                    <td className={p.closed ? 'pill-negative' : 'pill-positive'}>{p.closed ? 'Closed' : 'Open'}</td>
                    <td>{p.navUpdate !== null ? fmtPrice(p.navUpdate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" disabled={busy} onClick={runImport}>
            <PlusIcon />Import {plan.length} fund{plan.length === 1 ? '' : 's'}
          </button>
        </>
      )}
    </div>
  );
}

/* ============================== Fund detail ============================== */

function FundDetail({ fund, onBack }: { fund: Fund; onBack: () => void }) {
  const { positions, fundXIRR, workbook } = useFundsDerived();
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const addTransaction = useFundsWorkbookStore((s) => s.addTransaction);
  const updateTransaction = useFundsWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = useFundsWorkbookStore((s) => s.deleteTransaction);
  const setMarketPrice = useFundsWorkbookStore((s) => s.setMarketPrice);
  const updatePricePoint = useFundsWorkbookStore((s) => s.updatePricePoint);
  const deletePricePoint = useFundsWorkbookStore((s) => s.deletePricePoint);
  const ensureSignedIn = useEnsureSignedIn();
  const categoryRegistry = useCategoryStore((s) => s.workbook.categories);

  const [editingFund, setEditingFund] = useState(false);
  const [editFund, setEditFund] = useState<Fund>(fund);
  const editFundCurrencyOptions = useEnabledCurrencies(editFund.currencyCode);
  const brokers = useFundsWorkbookStore((s) => s.workbook.brokers);
  const visibleEditBrokers = useMemo(() => brokers.filter((b) => b.isActive !== false), [brokers]);
  const [navInput, setNavInput] = useState('');
  const [balanceInput, setBalanceInput] = useState('');
  const [txAction, setTxAction] = useState<'BUY' | 'SELL'>('BUY');
  const [txDate, setTxDate] = useState(today());
  const [txUnits, setTxUnits] = useState(0);
  const [txNav, setTxNav] = useState(0);
  // User-reported (2026-08-28): "I only have info of the amount, not
  // NAV/units — what should I do?" A third, string-backed Amount field
  // (same 3-way-linked pattern already established by RiskCalculator's
  // Target buy price/shares/amount trio) lets a transaction be entered from
  // whichever two of {units, NAV, amount} are actually known; editing any
  // one recomputes the third from NAV. Kept as a string, not a number, for
  // the same reason RiskCalculator's targetAmountInput is — a controlled
  // number input re-formats on every keystroke and fights typing.
  const [txAmountInput, setTxAmountInput] = useState('');
  const [txTime, setTxTime] = useState<string | undefined>(() => nowTime(defaultTimezoneForCurrency(fund.currencyCode)));
  const [txTimeTouched, setTxTimeTouched] = useState(false);
  const [txTimezone, setTxTimezone] = useState<string | undefined>(() => defaultTimezoneForCurrency(fund.currencyCode));
  const [txPending, setTxPending] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'BUY' | 'SELL'>('all');
  // User-requested (2026-09-08): "Also show a pending share-count delta" —
  // same reasoning/mechanism as QSE/PSX's Dashboard (Done item 243), reused
  // as-is since Funds shares the exact same Transaction type.
  const pendingUnitDelta = useMemo(() => pendingShareDeltaByTicker(workbook.transactions)[fund.id] || 0, [workbook.transactions, fund.id]);

  // Balance Update History — user-requested (2026-09-03): "ability to see
  // balance updates," then (same day) "missing crucial data. Add all data
  // like Index, Date, prv balnce + NAV, new balance + NAV, change + %age,
  // Actions etc." `balanceUpdateHistory()` computes the real before/after
  // balance+NAV pair and the change between them for every update on
  // record — same "recent 8 + show all" + raw-array-index-resolution
  // pattern already established for QSE/PSX's PositionDetail (Done items
  // 203/208), just backed by richer per-row data.
  const balanceRows = useMemo(
    () => balanceUpdateHistory(fund.id, workbook.transactions, workbook.priceHistory),
    [fund.id, workbook.transactions, workbook.priceHistory],
  );
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const updateRows = showAllUpdates ? [...balanceRows].reverse() : balanceRows.slice(-8).reverse();
  const rawPriceHistory = workbook.priceHistory[fund.id] ?? [];
  const [editUpdateIndex, setEditUpdateIndex] = useState<number | null>(null);
  const [editUpdateRow, setEditUpdateRow] = useState<{ date: string; price: number } | null>(null);

  const startEditUpdate = (rawIndex: number, point: { date: string; price: number }) => {
    setEditUpdateIndex(rawIndex);
    setEditUpdateRow({ ...point });
  };
  const saveEditUpdate = async () => {
    if (editUpdateIndex === null || !editUpdateRow) return;
    if (!editUpdateRow.price || editUpdateRow.price <= 0) return toast('Enter a valid NAV.');
    if (!(await ensureSignedIn('Sign in to edit balance/NAV history.'))) return;
    updatePricePoint(fund.id, editUpdateIndex, editUpdateRow);
    toast('Update edited.');
    setEditUpdateIndex(null);
    setEditUpdateRow(null);
  };
  const removeUpdate = async (rawIndex: number) => {
    if (!(await confirmDialog('Delete this balance/NAV update? This cannot be undone.'))) return;
    if (!(await ensureSignedIn('Sign in to edit balance/NAV history.'))) return;
    deletePricePoint(fund.id, rawIndex);
    toast('Update deleted.');
  };
  const exportBalanceHistory = () => {
    const header = ['Index', 'Date', 'Prev Balance', 'Prev NAV', 'New Balance', 'New NAV', 'Change', 'Change %'];
    const body = balanceRows.map((r) => [
      r.index,
      r.time ? new Date(r.time).toLocaleString() : r.date,
      r.prevBalance,
      r.prevNav,
      r.newBalance,
      r.newNav,
      r.change,
      r.changePct.toFixed(2),
    ]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fund.code || fund.name.replace(/\s+/g, '_')}_balance_history.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Balance history downloaded.');
  };
  // User-reported (2026-09-07): "Expected monthly P/L and others should not
  // count closed positions for future/prediction!" — same reasoning as
  // `OverallSummary`'s own fix: a forward-looking projection makes no sense
  // once this fund is closed or fully withdrawn, so it's only computed for
  // an actually-open position. `position`/`units` (previously derived
  // further down, after this point) are computed here instead so this gate
  // can use them.
  const position = positions.find((p) => p.ticker === fund.id);
  const units = position?.shares ?? 0;
  const plRate = fund.isActive !== false && units > 0
    ? expectedPLRate(fund.id, workbook.transactions, workbook.priceHistory)
    : null;

  // User-requested (2026-09-03): "Fund INfo card: add a chart to view
  // periodic growth with balance & PL indications over time." Reuses the
  // exact same {date, invested, value} series and Invested-vs-Value line
  // pair the Analytics tab's own "Contribution vs. value" chart already
  // shows — the vertical gap between the two lines IS the P&L indication
  // at each point, so a second dataset does the job rather than a
  // separate P&L-only series. Charts read CSS-var-derived colors, so this
  // subscribes to appearance the same way every other chart-bearing page
  // does, to re-render (and recompute those colors) on a live theme switch.
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const contribution = useMemo(
    () => contributionVsValueSeries(fund.id, workbook.transactions, workbook.priceHistory),
    [fund.id, workbook.transactions, workbook.priceHistory],
  );

  const invested = position?.invested ?? 0;
  const avgNav = units > 0 ? invested / units : 0;
  const currentNav = getMarketPrice(fund.id, workbook.marketPrices, workbook.transactions);
  const currentValue = units * currentNav;
  const profit = fundNetProfit(position, currentValue);
  const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
  const rate = fundXIRR(fund.id);

  // Prefills the Add-transaction NAV field with this fund's own last known
  // price once, so a user who only knows today's AMOUNT (not NAV) gets
  // units auto-computed from a reasonable default with zero extra typing —
  // still fully editable if the real NAV differs. Only fires while the NAV
  // field is untouched (0), so it never clobbers what the user typed.
  useEffect(() => {
    if (currentNav > 0 && txNav === 0) setTxNav(currentNav);
  }, [currentNav, txNav]);

  const allTxs = workbook.transactions.map((t, i) => ({ t, i })).filter((r) => r.t.ticker === fund.id);
  // User-requested (2026-09-03): "add filters to other tables as well" —
  // a Type filter on the transaction table (export below stays unfiltered
  // by type, matching its own existing "whole statement for a date range"
  // behavior).
  const txs = (typeFilter === 'all' ? allTxs : allTxs.filter((r) => r.t.action === typeFilter))
    .sort((a, b) => b.t.date.localeCompare(a.t.date));

  /** README item 40: extends Banking's statement-export pattern (Done
   * item 58) to this module's own primary record — a fund's "statement"
   * is its buy/sell transaction history. */
  const exportStatement = () => {
    const rows = allTxs
      .sort((a, b) => b.t.date.localeCompare(a.t.date))
      .filter((r) => (!fromDate || r.t.date >= fromDate) && (!toDate || r.t.date <= toDate))
      .slice()
      .reverse();
    const header = ['Date', 'Type', 'Units', 'NAV', 'Amount'];
    const body = rows.map((r) => [r.t.date, r.t.action === 'BUY' ? 'Invested' : 'Withdrew', r.t.shares, r.t.price, r.t.shares * r.t.price]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'now'}` : '';
    a.download = `${fund.code || fund.name.replace(/\s+/g, '_')}_statement${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Statement downloaded.');
  };

  const saveFund = () => {
    setWorkbook({ ...workbook, funds: workbook.funds.map((f) => (f.id === fund.id ? editFund : f)) });
    toast('Fund updated.');
    setEditingFund(false);
  };

  const deleteFund = async () => {
    if (!(await confirmDialog('This deletes the fund and all its transactions.', `Delete fund "${fund.name}"?`))) return;
    setWorkbook({
      ...workbook,
      funds: workbook.funds.filter((f) => f.id !== fund.id),
      transactions: workbook.transactions.filter((t) => t.ticker !== fund.id),
    });
    onBack();
  };

  // User-requested (2026-09-03): "Funds can also be closed!" — a safer,
  // reversible alternative to Delete, same pattern as `BankAccount.isActive`
  // (see that field's own doc comment). Archiving only hides the fund from
  // the default list and from "add a NEW transaction into" pickers; its
  // position/value keep counting toward every total unchanged.
  const toggleArchived = async () => {
    if (!(await ensureSignedIn(fund.isActive === false ? 'Sign in to reopen this fund.' : 'Sign in to close this fund.'))) return;
    setWorkbook({ ...workbook, funds: workbook.funds.map((f) => (f.id === fund.id ? { ...f, isActive: f.isActive === false ? true : false } : f)) });
    toast(fund.isActive === false ? 'Fund reopened.' : 'Fund closed.');
  };

  const commitNav = async () => {
    const val = parseFloat(navInput);
    if (!val || val <= 0) return;
    if (!(await ensureSignedIn('Sign in to save NAV updates.'))) return;
    setMarketPrice(fund.id, val);
    toast(`${fund.code} NAV saved: ${fmtPrice(val)}`);
    setNavInput('');
  };

  /** User-reported, urgent (2026-08-27): "I only have info of daily balance
   * update rather than NAV. so give me an option to update fund balance
   * other than deposit and withdraw." Some funds are only ever tracked by
   * their total balance (matches the Daily History Import's own per-row
   * shape, Done item 151) — this is the same math as that importer's
   * per-row NAV point (`newBlc / units`) for the no-cash-flow case, just as
   * a single quick entry instead of a full spreadsheet: given today's total
   * balance and the units already held, the implied per-unit NAV is
   * `balance / units`, assuming no deposit/withdrawal happened since the
   * last update (a real cash flow still goes through the existing Invest/
   * Withdraw form below, same as today). Reuses `setMarketPrice` exactly
   * as `commitNav` does — no new store action needed, since this only
   * changes how the NAV number itself is computed, not how it's saved. */
  const commitBalance = async () => {
    const val = parseFloat(balanceInput);
    if (!val || val <= 0) return toast('Enter a valid balance.');
    const impliedNav = impliedFundNav(val, units);
    if (impliedNav === null) return toast('Add an initial investment first — there are no units to divide this balance across yet.');
    if (!(await ensureSignedIn('Sign in to save balance updates.'))) return;
    setMarketPrice(fund.id, impliedNav);
    toast(`${fund.code} balance saved: ${fmtMoney(val, fund.currencyCode)} → implied NAV ${fmtPrice(impliedNav)}`);
    setBalanceInput('');
  };

  const submitTx = async () => {
    if (!txNav) return toast('Enter a NAV (or an amount, once a NAV is known).');
    if (!txUnits) return toast('Enter units, or an amount to compute them from the NAV.');
    if (!(await ensureSignedIn('Sign in to save this transaction.'))) return;
    addTransaction({
      date: txDate, ticker: fund.id, action: txAction, shares: txUnits, price: txNav, time: txTime, timezone: txTimezone,
      isPending: txPending || undefined,
    });
    toast(`${txAction === 'BUY' ? 'Invested' : 'Withdrew'} logged.`);
    setTxUnits(0);
    setTxAmountInput('');
    setTxTime(undefined);
    setTxPending(false);
  };

  const startEdit = (i: number, t: Transaction) => { setEditIndex(i); setEditRow({ ...t }); };
  const saveEdit = () => {
    if (editIndex === null || !editRow) return;
    updateTransaction(editIndex, editRow);
    toast('Transaction updated.');
    setEditIndex(null);
    setEditRow(null);
  };

  return (
    <div>
      <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={onBack}>← All funds</button>

      <Card className="mb-md">
            {editingFund ? (
              <div>
                <div className="row gap-sm">
                  <TextInput value={editFund.name} onChange={(e) => setEditFund({ ...editFund, name: e.target.value })} />
                  <TextInput value={editFund.code} onChange={(e) => setEditFund({ ...editFund, code: e.target.value.toUpperCase() })} />
                  <TextInput value={editFund.platform} onChange={(e) => setEditFund({ ...editFund, platform: e.target.value })} />
                  <CategorySelect value={editFund.categoryID ?? UNCATEGORIZED_ID} onChange={(categoryID) => setEditFund({ ...editFund, categoryID })} />
                  <Select value={editFund.currencyCode} onChange={(e) => setEditFund({ ...editFund, currencyCode: e.target.value })}>
                    {editFundCurrencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </Select>
                  {visibleEditBrokers.length > 0 && (
                    <Select value={editFund.brokerId ?? ''} onChange={(e) => setEditFund({ ...editFund, brokerId: e.target.value || undefined })}>
                      <option value="">No broker</option>
                      {visibleEditBrokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  )}
                </div>
                <div className="row gap-sm mt-sm">
                  <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveFund} />
                  <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditingFund(false)} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TickerLogo ticker={fund.code} exchange="psx" size="lg" />
                    {fund.name}
                    {fund.isActive === false && <span className="pill-warn" style={{ fontSize: 11 }}>Closed</span>}
                  </div>
                  <div className="text-muted">{fund.code} · {fund.platform} · {fundCategoryLabel(fund, categoryRegistry)} · {fund.currencyCode}</div>
                </div>
                <div className="row gap-sm">
                  <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => { setEditFund(fund); setEditingFund(true); }} />
                  <IconButton
                    label={fund.isActive === false ? 'Reopen' : 'Close'}
                    icon={fund.isActive === false ? <RestoreIcon size={13} /> : <ArchiveIcon size={13} />}
                    align="right"
                    onClick={toggleArchived}
                  />
                  <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={deleteFund} />
                </div>
              </div>
            )}
            <div className="grid-auto" style={{ ...gridAutoStyle(120, 8), marginTop: 12 }}>
              <div className="stat-card card">
                <div className="label">Units held</div>
                <div className="value">{fmt(units, 2)}</div>
                {!!pendingUnitDelta && (
                  <div className="sub" title="Placed but not yet settled orders for this fund — units will change by this much once they clear.">
                    {pendingUnitDelta > 0 ? '+' : ''}{fmt(pendingUnitDelta, 2)} pending
                  </div>
                )}
              </div>
              <div className="stat-card card">
                <Tooltip text="NAV = Net Asset Value, the price of one unit of this fund. This is the average price you paid per unit across all your purchases.">
                  <div className="label clickable">Avg NAV cost</div>
                </Tooltip>
                <div className="value">{fmtPrice(avgNav)}</div>
              </div>
              <div className="stat-card card"><div className="label">Invested</div><MoneyValue n={invested} currency={fund.currencyCode} /></div>
              <div className="stat-card card"><div className="label">Current value</div><MoneyValue n={currentValue} currency={fund.currencyCode} /></div>
              <div className="stat-card card" style={hueStyle(profit >= 0 ? 'var(--profit)' : 'var(--loss)')}>
                <Tooltip text="Realized profit from every past withdrawal/sell, plus unrealized profit on units still held — your true total gain, not just what's sitting in the fund right now.">
                  <div className="label clickable">Net profit</div>
                </Tooltip>
                <MoneyValue n={profit} currency={fund.currencyCode} after={` (${profitPct.toFixed(1)}%)`} />
              </div>
              <div className="stat-card card">
                <Tooltip text="XIRR: your annualized rate of return, accounting for the exact dates and amounts of every purchase — a fairer comparison than a flat percentage when you've invested at different times.">
                  <div className="label clickable">XIRR</div>
                </Tooltip>
                <div className="value">{rate !== null ? `${(rate * 100).toFixed(1)}%` : '—'}</div>
              </div>
              {/* User-requested (2026-09-03): "Display expected daily/monthly
                  PL+PL%age... on each item page." */}
              <div className="stat-card card" style={hueStyle(plRate && plRate.dailyAmount < 0 ? 'var(--loss)' : 'var(--profit)')}>
                <Tooltip text="An average of what this fund actually earned/lost per day, based on its real NAV/balance history — not a promise of future returns.">
                  <div className="label clickable">Expected daily P/L</div>
                </Tooltip>
                <div className="value">{plRate ? <>{fmtMoney(plRate.dailyAmount, fund.currencyCode)} <span style={{ fontSize: 12 }}>({plRate.dailyPct.toFixed(2)}%)</span></> : '—'}</div>
              </div>
              <div className="stat-card card" style={hueStyle(plRate && plRate.monthlyAmount < 0 ? 'var(--loss)' : 'var(--profit)')}>
                <Tooltip text="The same average daily rate, scaled to a typical calendar month.">
                  <div className="label clickable">Expected monthly P/L</div>
                </Tooltip>
                <div className="value">{plRate ? <>{fmtMoney(plRate.monthlyAmount, fund.currencyCode)} <span style={{ fontSize: 12 }}>({plRate.monthlyPct.toFixed(2)}%)</span></> : '—'}</div>
              </div>
            </div>
            {/* User-requested (2026-09-03): "add a chart to view periodic
                growth with balance & PL indications over time." */}
            <div style={{ marginTop: 12 }}>
              <ChartCard title="Growth over time" empty={!contribution.length}>
                <Line
                  data={{
                    labels: contribution.map((c) => c.date),
                    datasets: [
                      { label: 'Invested', data: contribution.map((c) => c.invested), borderColor: cssVar('--warn') || '#e8a23d', backgroundColor: 'transparent', tension: 0.2 },
                      { label: 'Value', data: contribution.map((c) => c.value), borderColor: cssVar('--profit') || '#3ecf8e', backgroundColor: 'transparent', tension: 0.2 },
                    ],
                  }}
                  options={{ plugins: { datalabels: dlLine((v) => fmtMoney(v, fund.currencyCode)) } }}
                />
              </ChartCard>
            </div>
      </Card>

      <h3>Add transaction</h3>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <Field label="Action">
          <Select value={txAction} onChange={(e) => setTxAction(e.target.value as 'BUY' | 'SELL')}>
            <option value="BUY">Invest</option>
            <option value="SELL">Withdraw</option>
          </Select>
        </Field>
        <Field label="Date">
          <TextInput
            type="date"
            value={txDate}
            onChange={(e) => {
              setTxDate(e.target.value);
              if (!txTimeTouched) setTxTime(defaultTimeForDate(e.target.value, txTimezone));
            }}
          />
        </Field>
        <Field label="NAV">
          <TextInput
            type="number"
            step="0.0001"
            value={txNav || ''}
            onChange={(e) => {
              const nav = Number(e.target.value);
              setTxNav(nav);
              if (txUnits) setTxAmountInput(nav > 0 ? (txUnits * nav).toFixed(2) : '');
            }}
            style={{ width: 100 }}
          />
        </Field>
        <Field label="Units">
          <TextInput
            type="number"
            value={txUnits || ''}
            onChange={(e) => {
              const u = Number(e.target.value);
              setTxUnits(u);
              setTxAmountInput(txNav > 0 && u ? (u * txNav).toFixed(2) : '');
            }}
            style={{ width: 100 }}
          />
        </Field>
        <Field label="or Amount" title="Only know the amount, not the units? Enter it here — units are computed automatically from the NAV above (pre-filled with this fund's last known NAV, editable if today's is different).">
          <TextInput
            type="number"
            step="0.01"
            value={txAmountInput}
            onChange={(e) => {
              setTxAmountInput(e.target.value);
              setTxUnits(txNav > 0 ? Number(e.target.value) / txNav : 0);
            }}
            style={{ width: 110 }}
          />
        </Field>
        <TimeZoneFields
          time={txTime}
          timezone={txTimezone}
          onTimeChange={(t) => { setTxTime(t); setTxTimeTouched(true); }}
          onTimezoneChange={setTxTimezone}
        />
        <Field label="Order">
          <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Placed but not yet settled — excluded from your units/value until it clears.">
            <input type="checkbox" checked={txPending} onChange={(e) => setTxPending(e.target.checked)} />
            Pending
          </label>
        </Field>
        <button className="btn" onClick={submitTx}><PlusIcon />Add</button>
      </div>

      {/* User-requested (2026-09-03): "I asked to stack update Balance +
          OR update NAV and stacked below Add transaction form" — corrects
          the earlier round's right-rail placement (also removed: a
          "Transfers" card here, redundant with the Transactions table
          right below). Two stacked options, "OR" between them, not two
          side-by-side rows. */}
      <Card className="mb-md">
        <h3 className="mt-0">Update balance or NAV</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row gap-sm">
            <Field label="Update NAV" width={140}>
              <TextInput type="number" step="0.0001" value={navInput} onChange={(e) => setNavInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitNav()} />
            </Field>
            <button className="btn secondary small" onClick={commitNav}><SaveIcon size={12} />Save NAV</button>
            <span className="text-muted">Current NAV: {currentNav ? fmtPrice(currentNav) : '—'}</span>
          </div>
          <div className="text-muted" style={{ textAlign: 'center' }}>OR</div>
          <div className="row gap-sm">
            <Field label="Update balance" width={150} title="Don't know the per-unit NAV? Enter your fund's current total balance instead — the app computes the implied NAV from the units you already hold, assuming no deposit/withdrawal happened since your last update.">
              <TextInput type="number" step="0.01" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitBalance()} disabled={units <= 0} />
            </Field>
            <button className="btn secondary small" onClick={commitBalance} disabled={units <= 0}><SaveIcon size={12} />Save balance</button>
          </div>
        </div>
      </Card>

      <CollapsibleCard
        title={<h3 style={{ margin: 0 }}>Transactions</h3>}
        headerExtra={
          txs.length > 0 ? (
            <div className="row gap-sm">
              <Field label="From (optional)">
                <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label="To (optional)">
                <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <button className="btn secondary" onClick={exportStatement}>Export CSV</button>
            </div>
          ) : undefined
        }
      >
      <div className="row gap-sm mb-sm">
        <Field label="Type" width={140}>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
            <option value="all">All</option>
            <option value="BUY">Invested</option>
            <option value="SELL">Withdrew</option>
          </Select>
        </Field>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Units</th><th>NAV</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {txs.map(({ t, i }) =>
              editIndex === i && editRow ? (
                <tr key={i}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td>
                    <select value={editRow.action} onChange={(e) => setEditRow({ ...editRow, action: e.target.value as 'BUY' | 'SELL' })}>
                      <option value="BUY">Invest</option>
                      <option value="SELL">Withdraw</option>
                    </select>
                  </td>
                  <td><input type="number" value={editRow.shares} onChange={(e) => setEditRow({ ...editRow, shares: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td><input type="number" step="0.0001" value={editRow.price} onChange={(e) => setEditRow({ ...editRow, price: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td>{fmtMoney(editRow.shares * editRow.price, fund.currencyCode)}</td>
                  <td>
                    <PendingToggle
                      checked={!!editRow.isPending}
                      onChange={(v) => setEditRow({ ...editRow, isPending: v })}
                      title="Not yet settled — excluded from units/value until unchecked."
                    />{' '}
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditIndex(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={i} onClick={() => setDetailTx(t)} className="clickable">
                  <td>
                    {t.date}
                    {t.isPending && (
                      <Tooltip text="Order placed but not yet settled — excluded from units/value until cleared.">
                        <span className="pill-warn" style={{ marginLeft: 6 }}>Pending</span>
                      </Tooltip>
                    )}
                  </td>
                  <td className={t.action === 'BUY' ? 'pill-positive' : 'pill-negative'}>{t.action === 'BUY' ? 'Invested' : 'Withdrew'}</td>
                  <td>{fmt(t.shares, 2)}</td>
                  <td>{fmtPrice(t.price)}</td>
                  <td>{fmtMoney(t.shares * t.price, fund.currencyCode)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {t.isPending && (
                      <IconButton
                        label="Mark cleared"
                        icon={<CheckIcon size={13} />}
                        align="right"
                        onClick={async () => {
                          if (!(await ensureSignedIn('Sign in to update this transaction.'))) return;
                          updateTransaction(i, { isPending: false });
                          toast('Marked cleared.');
                        }}
                      />
                    )}{' '}
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(i, t)} />{' '}
                    <IconButton
                      label="Delete"
                      icon={<TrashIcon size={13} />}
                      align="right"
                      onClick={async () => {
                        if (await confirmDialog('This cannot be undone.', 'Delete this transaction?')) deleteTransaction(i);
                      }}
                    />
                  </td>
                </tr>
              ),
            )}
            {!txs.length && (
              <tr>
                <td colSpan={6} className="text-muted">
                  {allTxs.length ? 'No transactions match this filter.' : 'No transactions for this fund yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </CollapsibleCard>

      {/* User-requested (2026-09-03): "ability to see balance updates,"
          then "missing crucial data. Add all data like Index, Date, prv
          balnce + NAV, new balance + NAV, change + %age, Actions etc." */}
      <CollapsibleCard
        title={<h3 style={{ margin: 0 }}>Balance Update History</h3>}
        style={{ marginTop: 16 }}
        headerExtra={balanceRows.length > 0 ? <button className="btn secondary" onClick={exportBalanceHistory}>Export CSV</button> : undefined}
      >
        {!balanceRows.length && <p className="text-muted">No balance/NAV updates recorded yet — use "Update balance or NAV" above.</p>}
        {balanceRows.length > 0 && (
          <>
            {balanceRows.length > 8 && (
              <button className="btn secondary small" style={{ marginBottom: 8 }} onClick={() => setShowAllUpdates((v) => !v)}>
                {showAllUpdates ? 'Show recent 8 only' : `Show all ${balanceRows.length} updates`}
              </button>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Date</th><th>Prev Balance</th><th>Prev NAV</th><th>New Balance</th><th>New NAV</th><th>Change</th><th>%</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {updateRows.map((r) => {
                    const rawIndex = rawPriceHistory.indexOf(r.point);
                    return editUpdateIndex === rawIndex && editUpdateRow ? (
                      <tr key={rawIndex}>
                        <td className="text-muted">{r.index}</td>
                        <td><input type="date" value={editUpdateRow.date} onChange={(e) => setEditUpdateRow({ ...editUpdateRow, date: e.target.value })} style={{ width: 130 }} /></td>
                        <td>{fmtMoney(r.prevBalance, fund.currencyCode)}</td>
                        <td>{fmtPrice(r.prevNav)}</td>
                        <td className="text-muted">—</td>
                        <td><input type="number" step="0.0001" value={editUpdateRow.price} onChange={(e) => setEditUpdateRow({ ...editUpdateRow, price: Number(e.target.value) })} style={{ width: 90 }} /></td>
                        <td className="text-muted">—</td>
                        <td className="text-muted">—</td>
                        <td>
                          <IconButton label="Save" icon={<SaveIcon size={12} />} align="right" onClick={saveEditUpdate} />
                          <IconButton label="Cancel" icon={<XIcon size={12} />} align="right" onClick={() => { setEditUpdateIndex(null); setEditUpdateRow(null); }} />
                        </td>
                      </tr>
                    ) : (
                      <tr key={rawIndex}>
                        <td className="text-muted">{r.index}</td>
                        <td>{r.time ? new Date(r.time).toLocaleString() : r.date}</td>
                        <td>{fmtMoney(r.prevBalance, fund.currencyCode)}</td>
                        <td>{fmtPrice(r.prevNav)}</td>
                        <td>{fmtMoney(r.newBalance, fund.currencyCode)}</td>
                        <td>{fmtPrice(r.newNav)}</td>
                        <td className={r.change >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(r.change, fund.currencyCode)}</td>
                        <td className={r.change >= 0 ? 'pill-positive' : 'pill-negative'}>{r.changePct.toFixed(2)}%</td>
                        <td>
                          <IconButton label="Edit" icon={<EditIcon size={12} />} align="right" onClick={() => startEditUpdate(rawIndex, r.point)} />
                          <IconButton label="Delete" icon={<TrashIcon size={12} />} align="right" onClick={() => removeUpdate(rawIndex)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CollapsibleCard>
      {detailTx && (
        <RecordDetailModal
          title={detailTx.action === 'BUY' ? 'Invested' : 'Withdrew'}
          onClose={() => setDetailTx(null)}
          fields={[
            { label: 'Date', value: detailTx.date },
            { label: 'Time', value: detailTx.time ?? '— (defaults to noon)' },
            { label: 'Timezone', value: detailTx.timezone ?? '—' },
            { label: 'Type', value: detailTx.action === 'BUY' ? 'Invested' : 'Withdrew' },
            { label: 'Units', value: fmt(detailTx.shares, 2) },
            { label: 'NAV', value: fmtPrice(detailTx.price) },
            { label: 'Amount', value: fmtMoney(detailTx.shares * detailTx.price, fund.currencyCode) },
            { label: 'Status', value: detailTx.isPending ? 'Pending (not yet settled)' : 'Cleared' },
          ]}
        />
      )}
    </div>
  );
}

/* ============================== Transfers ============================== */

/** Funds' `transfers` field is inherited from the shared `createWorkbookStore`
 * factory (same shape as QSE/PSX's own Transfer, since Funds reuses that
 * factory wholesale) but was never given a native add/edit UI — real
 * deposits/withdrawals of cash into or out of a Funds account (as opposed
 * to buying/selling fund units) had nowhere to go except the standalone
 * Transfers page's generic linking form. This closes that gap, and folds
 * in Pending item 62's direct-link shortcut at the same time — same
 * pattern already built for QSE/PSX/Rentals/Personal Loans. */

/** User-requested (2026-08-28): Funds' own "Transfers" FAB, replacing the
 * old always-visible add-form AND its bank/cash-only `FundsLinkedTransferFields`
 * shortcut — the shared `TransactionEntryModal` supersedes both. */
/** User-reported (2026-08-28, real audit after "you're ignoring what's
 * asked for"): this per-section Transfers FAB lived inside the "Transfers"
 * tab's own content, which `CollapsibleCard` doesn't mount into the DOM
 * until that tab is expanded — the same bug found on QSE/PSX. Since Funds'
 * landing FAB (`AddFundFab`, on the always-open first tab) now offers the
 * exact same Transfers action with the identical `defaultFinance`, this
 * was purely a redundant, buggy duplicate — removed rather than fixed in
 * place, since fixing its placement too would leave two floating "+"
 * buttons stacked in the same corner whenever both were mounted. */
function FundsTransfersSection() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const updateTransfer = useFundsWorkbookStore((s) => s.updateTransfer);
  const deleteTransfer = useFundsWorkbookStore((s) => s.deleteTransfer);
  const currency = workbook.settings.defaultCurrency;
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Transfer | null>(null);
  // User-requested (2026-09-06): "although we are removing sorting, we
  // must add all fields as filters in all tables" — QSE's/PSX's own
  // Transfers sections already had this Type filter; Funds' copy was
  // missing it.
  const [typeFilter, setTypeFilter] = useState<'all' | Transfer['type']>('all');

  const balances = useMemo(() => transferRunningBalance(workbook.transfers), [workbook.transfers]);
  const linkByRecordId = useMemo(() => {
    const map = new Map<string, (typeof links)[number]>();
    for (const l of links) {
      if (l.from.module === 'funds') map.set(l.fromRecordId, l);
      if (l.to.module === 'funds') map.set(l.toRecordId, l);
    }
    return map;
  }, [links]);

  // User-reported (2026-09-06): "we may stop sorting options for
  // chronologically important tables (only sequence-aware tables) to
  // avoid the disordered mess" — same reasoning as QSE/PSX's own
  // Transfers sections (Done item 235): Balance only makes sense in real
  // chronological+sequence order, so free column sorting is gone here,
  // replaced by `ReorderButtons` for the one thing that genuinely needs
  // fixing (two same-instant transfers in the wrong relative order).
  const ensureSignedIn = useEnsureSignedIn();
  const sideLabel = useLinkSideLabel();
  const instantOf = (t: Transfer) => dateOnlyMs(t.date);
  const filteredTransfers = useMemo(
    () => (typeFilter === 'all' ? workbook.transfers : workbook.transfers.filter((t) => t.type === typeFilter)),
    [workbook.transfers, typeFilter],
  );
  const sorted = useMemo(
    () => [...filteredTransfers].sort((a, b) => instantOf(b) - instantOf(a) || (b.seq ?? 0) - (a.seq ?? 0)),
    [filteredTransfers],
  );
  const reorderTransfer = async (pair: [{ id: string; order: number }, { id: string; order: number }]) => {
    if (!(await ensureSignedIn('Sign in to reorder transfers.'))) return;
    for (const p of pair) updateTransfer(p.id, { seq: p.order });
  };

  const startEdit = (t: Transfer) => { setEditId(t.id); setEditRow({ ...t }); };
  const saveEdit = async () => {
    if (editId === null || !editRow) return;
    const choice = await resolveLinkedEdit('funds', editId);
    if (choice === 'cancel') return;
    updateTransfer(editId, editRow);
    let msg = 'Transfer updated.';
    if (choice === 'both') {
      const result = propagateLinkedEdit('funds', editId, { date: editRow.date, amount: editRow.gross });
      if (result.error) msg = result.error;
      else if (result.message) msg = result.message;
    }
    toast(msg);
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Cash moved into or out of this Funds account, separate from buying/selling fund units —
        e.g. topping up before a purchase, or withdrawing after a redemption.
      </p>
      <div className="row gap-sm mb-sm">
        <Field label="Type" width={140}>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
            <option value="all">All</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
          </Select>
        </Field>
      </div>
      <div className="table-scroll mt-sm">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Gross</th>
              <th>Fee</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const link = linkByRecordId.get(t.id);
              const otherSide = link ? (link.from.module === 'funds' && link.fromRecordId === t.id ? link.to : link.from) : undefined;
              return editId === t.id && editRow ? (
                <tr key={t.id}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td>
                    <select value={editRow.type} onChange={(e) => setEditRow({ ...editRow, type: e.target.value as Transfer['type'] })}>
                      <option value="DEPOSIT">Deposit</option>
                      <option value="WITHDRAWAL">Withdrawal</option>
                    </select>
                  </td>
                  <td><input type="number" value={editRow.gross} onChange={(e) => setEditRow({ ...editRow, gross: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td><input type="number" value={editRow.fee} onChange={(e) => setEditRow({ ...editRow, fee: Number(e.target.value) })} style={{ width: 70 }} /></td>
                  <td></td>
                  <td>
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td>
                    {t.date}{' '}
                    <ReorderButtons
                      rows={sorted}
                      index={i}
                      instantOf={instantOf}
                      idOf={(row) => row.id}
                      orderOf={(row) => row.seq}
                      onMove={reorderTransfer}
                    />
                  </td>
                  <td>
                    {t.type}
                    {link && (
                      <Link to={linkTargetPath(otherSide!)} className="pill-info" style={{ marginLeft: 6, textDecoration: 'none' }} title="Linked — go to the other side">
                        🔗 {sideLabel(link.from)} → {sideLabel(link.to)}
                      </Link>
                    )}
                  </td>
                  <td>{fmtMoney(t.gross, currency)}</td>
                  <td>{fmtMoney(t.fee, currency)}</td>
                  <td>
                    <Tooltip text="Running net cash contributed, in date order.">
                      <span>{fmtMoney(balances.get(t.id) ?? 0, currency)}</span>
                    </Tooltip>
                  </td>
                  <td>
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(t)} />{' '}
                    <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => confirmAndDeleteLinkable('funds', t.id, () => deleteTransfer(t.id))} />
                  </td>
                </tr>
              );
            })}
            {!sorted.length && <tr><td colSpan={6} className="text-muted">No transfers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== Analytics ============================== */

function AnalyticsTab() {
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const { workbook } = useFundsDerived();
  const categoryRegistry = useCategoryStore((s) => s.workbook.categories);
  // Charts read CSS-var-derived colors — subscribe so this re-renders (and
  // recomputes those colors) on a live theme switch, same pattern as every
  // other chart-bearing page in this app.
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const currencies = useMemo(() => [...new Set(funds.map((f) => f.currencyCode))].sort(), [funds]);
  const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
  const effectiveCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? currency);

  const [fundId, setFundId] = useState(funds[0]?.id ?? '');
  const selectedFund = funds.find((f) => f.id === fundId) ?? funds[0] ?? null;

  const allocation = useMemo(
    () => allocationByCategory(funds, workbook.transactions, workbook.marketPrices, effectiveCurrency, categoryRegistry),
    [funds, workbook.transactions, workbook.marketPrices, effectiveCurrency, categoryRegistry],
  );
  const categories = Object.keys(allocation);

  const navHistory = useMemo(
    () => (selectedFund ? getDailyPriceHistory(selectedFund.id, workbook.priceHistory) : []),
    [selectedFund, workbook.priceHistory],
  );
  const contribution = useMemo(
    () => (selectedFund ? contributionVsValueSeries(selectedFund.id, workbook.transactions, workbook.priceHistory) : []),
    [selectedFund, workbook.transactions, workbook.priceHistory],
  );

  if (!funds.length) {
    return <p className="text-muted">Add a fund first (Funds tab) to see charts here.</p>;
  }

  return (
    <div>
      <div className="row gap-sm">
        {currencies.length > 1 && (
          <Field label="Currency" width={120}>
            <Select value={effectiveCurrency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Fund" width={220}>
          <Select value={selectedFund?.id ?? ''} onChange={(e) => setFundId(e.target.value)}>
            {funds.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid-auto" style={{ ...gridAutoStyle(320, 16), marginTop: 12 }}>
        <ChartCard title="Allocation by category" empty={!categories.length}>
          <Doughnut
            data={{
              labels: categories,
              datasets: [{ data: categories.map((c) => allocation[c]), backgroundColor: categories.map((c) => tickerColor(c)) }],
            }}
            options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => fmtMoney(v, effectiveCurrency)) } }}
          />
        </ChartCard>
        {selectedFund && (
          <>
            <ChartCard title={`NAV over time — ${selectedFund.code}`} empty={!navHistory.length}>
              <Line
                data={{
                  labels: navHistory.map((p) => p.date),
                  datasets: [{ label: 'NAV', data: navHistory.map((p) => p.price), borderColor: '#5aa9c9', backgroundColor: '#5aa9c933', fill: true, tension: 0.2 }],
                }}
                options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmtPrice(v)) } }}
              />
            </ChartCard>
            <ChartCard title={`Contribution vs. value — ${selectedFund.code}`} empty={!contribution.length}>
              <Line
                data={{
                  labels: contribution.map((c) => c.date),
                  datasets: [
                    { label: 'Invested', data: contribution.map((c) => c.invested), borderColor: cssVar('--warn') || '#e8a23d', backgroundColor: 'transparent', tension: 0.2 },
                    { label: 'Value', data: contribution.map((c) => c.value), borderColor: cssVar('--profit') || '#3ecf8e', backgroundColor: 'transparent', tension: 0.2 },
                  ],
                }}
                options={{ plugins: { datalabels: dlLine((v) => fmtMoney(v, selectedFund.currencyCode)) } }}
              />
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================== Settings ============================== */

// User-reported (2026-08-27, then again 2026-08-28): duplicated the global
// /account hub's own Sync status section — dropped the status text/heading
// here, same fix already applied app-wide (see BankPage.tsx for the
// fullest write-up).
function AccountSection({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const [busy, setBusy] = useState(false);

  if (!firebaseReady || !cloudEmpty) return null;
  return (
    <Card className="mb-md">
      {cloudEmpty && (
        <Notice tone="warning" style={{ marginTop: 8 }}>
          <p className="mt-0">No data found in the cloud for this account's Funds workbook. This won't upload automatically.</p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog(
                'This will overwrite anything currently in the cloud (there is nothing there now, but confirming since this can\'t be undone).',
                `Upload ${funds.length} local fund(s) to the cloud?`,
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
            Upload local data to cloud ({funds.length} funds)
          </button>
        </Notice>
      )}
    </Card>
  );
}

function DataManagement() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);
  const setWorkbook = useFundsWorkbookStore((s) => s.setWorkbook);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funds-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<FundsWorkbook>;
        setWorkbook({ ...createEmptyFundsWorkbook(), ...parsed });
        toast('Workbook imported.');
      } catch {
        toast('That file is not valid workbook JSON.');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    const ok = await confirmDialog('This cannot be undone (export a backup first if unsure).', 'Clear all funds data?');
    if (!ok) return;
    setWorkbook(createEmptyFundsWorkbook());
    toast('All funds data cleared.');
  };

  return (
    <Card>
      <h3 className="mt-0">Data management</h3>
      <div className="row gap-sm">
        <button className="btn secondary" onClick={exportJSON}>Export JSON</button>
        <button className="btn secondary" onClick={() => fileInput.current?.click()}>Import JSON</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importJSON(file);
            e.target.value = '';
          }}
        />
        <button className="btn secondary" onClick={clearAll}><TrashIcon size={12} />Clear all data</button>
      </div>
    </Card>
  );
}

export function FundsPage({
  cloudEmpty,
  uploadLocalToCloud,
}: {
  user: User | null;
  syncStatus: string;
  cloudEmpty: boolean;
  uploadLocalToCloud: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Fund | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const funds = useFundsWorkbookStore((s) => s.workbook.funds);
  const brokers = useFundsWorkbookStore((s) => s.workbook.brokers);
  const liveSelected = selected ? funds.find((f) => f.id === selected.id) ?? null : null;
  const liveSelectedBroker = selectedBroker ? brokers.find((b) => b.id === selectedBroker.id) ?? null : null;

  return (
    <div>
      <h1 className="pagetitle">Funds</h1>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Mutual fund unit holdings and performance — buy/sell units at a NAV per unit, same shape as a stock
        trade. Returns are shown as XIRR, which accounts for when each investment happened, not just totals.
      </p>
      {liveSelected ? (
        <FundDetail fund={liveSelected} onBack={() => setSelected(null)} />
      ) : liveSelectedBroker ? (
        <BrokerDetail
          broker={liveSelectedBroker}
          onBack={() => setSelectedBroker(null)}
          onSelectFund={(f) => { setSelectedBroker(null); setSelected(f); }}
        />
      ) : (
        <Tabs
          tabs={[
            {
              key: 'funds',
              label: 'Funds',
              content: (
                <div>
                  <OverallSummary />
                  <BrokersList onSelect={setSelectedBroker} />
                  <FundList onSelect={setSelected} />
                  <AddFundFab />
                </div>
              ),
            },
            { key: 'transfers', label: 'Transfers', content: <FundsTransfersSection /> },
            { key: 'import', label: 'Import', content: <SnapshotImportSection /> },
            { key: 'analytics', label: 'Analytics', content: <AnalyticsTab /> },
            {
              key: 'settings',
              label: 'Settings',
              content: (
                <div>
                  <p className="text-muted mt-0">
                    Sign-in, profile, appearance, and a whole-app backup live on the{' '}
                    <Link to="/account">Account page →</Link>. What's below is specific to Funds.
                  </p>
                  <AccountSection cloudEmpty={cloudEmpty} uploadLocalToCloud={uploadLocalToCloud} />
                  <DataManagement />
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
