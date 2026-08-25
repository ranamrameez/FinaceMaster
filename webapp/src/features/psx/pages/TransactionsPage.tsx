import { Fragment, useMemo, useState } from 'react';
import { PSX_TICKER_DATALIST_ID } from '../../../components/PSXTickerDatalist';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, ExportIcon, InfoIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { Tooltip } from '../../../components/Tooltip';
import { toast } from '../../../components/Toast';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { confirmAndDeleteLinkable, createLinkedTransfer, warnIfLinked } from '../../../lib/linkCascade';
import { getLastTransferSource, rememberTransferSource } from '../../../hooks/useLastTransferSource';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import type { LinkSideConfig } from '../../../types/interEntityTransfer';
import { isNettedLeg } from '../../../lib/calc/psxFees';
import { transferRunningBalance } from '../../../lib/calc/transferBalance';
import { FeeModeControl, feeModeFor } from '../../../components/ui/FeeModeControl';
import { IconButton } from '../../../components/ui/IconButton';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { defaultTimezoneForCurrency, defaultTimezoneForMarket } from '../../../lib/datetime';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { createEmptyPSXWorkbook } from '../../../store/defaultPsxWorkbook';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { Adjustment, Transaction, Transfer } from '../../../types/workbook';
import { DividendsSection } from '../components/DividendsSection';
import { usePSXDerived } from '../hooks/usePSXDerived';

const today = () => new Date().toISOString().slice(0, 10);

function emptyRow(): Transaction {
  return { date: today(), ticker: '', action: 'BUY', shares: 0, price: 0, timezone: defaultTimezoneForMarket('PSX') };
}

function TransactionRows() {
  const addTransactions = usePSXWorkbookStore((s) => s.addTransactions);
  const ensureSignedIn = useEnsureSignedIn();
  const [rows, setRows] = useState<Transaction[]>([emptyRow()]);

  const update = (i: number, patch: Partial<Transaction>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    const valid = rows.filter((r) => r.ticker && r.shares > 0 && r.price > 0);
    if (!valid.length) {
      toast('Fill in at least one complete row.');
      return;
    }
    if (!(await ensureSignedIn('Sign in to save your transactions.'))) return;
    addTransactions(valid.map((r) => ({ ...r, ticker: r.ticker.toUpperCase() })));
    toast(`Added ${valid.length} transaction${valid.length > 1 ? 's' : ''}.`);
    setRows([emptyRow()]);
  };

  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={r.date}
            onChange={(e) => update(i, { date: e.target.value })}
          />
          <input
            placeholder="Ticker"
            value={r.ticker}
            onChange={(e) => update(i, { ticker: e.target.value.toUpperCase() })}
            list={PSX_TICKER_DATALIST_ID}
            style={{ width: 80 }}
          />
          <select
            value={r.action}
            onChange={(e) => update(i, { action: e.target.value as 'BUY' | 'SELL' })}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <input
            type="number"
            placeholder="Shares"
            value={r.shares || ''}
            onChange={(e) => update(i, { shares: Number(e.target.value) })}
            style={{ width: 90 }}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price"
            value={r.price || ''}
            onChange={(e) => update(i, { price: Number(e.target.value) })}
            style={{ width: 90 }}
          />
          <FeeModeControl
            mode={feeModeFor(r)}
            onModeChange={(mode) => {
              if (mode === 'auto') update(i, { manualSameDay: undefined, feeOverride: undefined });
              else if (mode === 'semi') update(i, { manualSameDay: r.manualSameDay ?? false, feeOverride: undefined });
              else update(i, { manualSameDay: undefined, feeOverride: r.feeOverride ?? 0 });
            }}
            manualSameDay={!!r.manualSameDay}
            onManualSameDayChange={(v) => update(i, { manualSameDay: v })}
            feeOverride={r.feeOverride}
            onFeeOverrideChange={(v) => update(i, { feeOverride: v })}
          />
          <TimeZoneFields
            time={r.time}
            timezone={r.timezone}
            onTimeChange={(time) => update(i, { time })}
            onTimezoneChange={(timezone) => update(i, { timezone })}
          />
          <button className="btn secondary small" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
            <TrashIcon size={12} />Remove
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn secondary" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          <PlusIcon />Add row
        </button>
        <button className="btn" onClick={submit}>
          <SaveIcon />Save {rows.length > 1 ? `${rows.length} transactions` : 'transaction'}
        </button>
      </div>
      <p className="footer-note" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        Same-day round trips net automatically — the larger side pays full commission, the
        smaller side pays levies only.
        <Tooltip
          text={'The "Fee mode" dropdown per row controls how much you want to override that: Auto leaves it fully computed, Semi lets you flip whether this specific leg counts as netted (use when your statement shows a same-day netting the recorded date doesn\'t line up with, or when you already know a same-day sell is coming before you\'ve logged it), and Manual lets you type the exact fee from your statement, bypassing computation entirely. Auto is the right choice for most trades, including a same-day round trip — once both legs are logged, the correct side nets automatically.'}
        >
          <span style={{ cursor: 'pointer', color: 'var(--muted)', display: 'inline-flex' }}>
            <InfoIcon size={13} />
          </span>
        </Tooltip>
      </p>
    </div>
  );
}

/** README item 62 / Pending item 62's "check feasibility" ask: let PSX's own
 * Transfers form create a linked Bank/Cash transfer directly, instead of
 * needing the separate Transfers page for the exact case the user gave as
 * their own example ("PSX i can only use Zindagi Account for Deposits &
 * Withdrawals"). Prototyped here first, on one module, before deciding
 * whether it's worth generalizing to Rentals/Personal Loans/Funds/EMI too —
 * see this file's own README Done item for the reasoning. Reuses the exact
 * same `createLinkedTransfer`/`useLastTransferSource` machinery the
 * Transfers page itself uses, not a parallel implementation. Deliberately
 * simpler than the full Transfers page in one respect: both sides always
 * share the same amount (no "different amount on the other side" toggle) —
 * a real cross-currency conversion still belongs on the full Transfers page,
 * which already has that control; this shortcut is for the common
 * same-currency case its own worked example describes. */
function LinkedTransferFields({ date, type, gross, onLinked }: { date: string; type: Transfer['type']; gross: number; onLinked: () => void }) {
  const ensureSignedIn = useEnsureSignedIn();
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const psxSide: LinkSideConfig = { module: 'psx' };
  const remembered = getLastTransferSource(psxSide);
  const [otherModule, setOtherModule] = useState<'bank' | 'cash'>(remembered?.module === 'cash' ? 'cash' : 'bank');
  const [otherAccountId, setOtherAccountId] = useState(remembered?.ref ?? bankAccounts[0]?.id ?? '');

  const create = async () => {
    if (gross <= 0) return toast('Enter an amount first.');
    if (otherModule === 'bank' && !otherAccountId) return toast('Add a bank account on the Banking page first.');
    if (!(await ensureSignedIn('Sign in to save transfers.'))) return;
    const other: LinkSideConfig = otherModule === 'bank' ? { module: 'bank', ref: otherAccountId } : { module: 'cash', currencyCode: cashCurrency };
    // A PSX deposit means money flows FROM the other source INTO PSX; a
    // withdrawal is the reverse.
    const input = {
      date,
      fromAmount: gross,
      toAmount: gross,
      from: type === 'DEPOSIT' ? other : psxSide,
      to: type === 'DEPOSIT' ? psxSide : other,
    };
    const result = createLinkedTransfer(input);
    if ('error' in result) return toast(result.error);
    rememberTransferSource(psxSide, other);
    toast('Linked transfer added — also recorded on the other side.');
    onLinked();
  };

  return (
    <>
      <select value={otherModule} onChange={(e) => setOtherModule(e.target.value as 'bank' | 'cash')}>
        <option value="bank">Bank account</option>
        <option value="cash">Cash</option>
      </select>
      {otherModule === 'bank' && (
        bankAccounts.length ? (
          <select value={otherAccountId} onChange={(e) => setOtherAccountId(e.target.value)}>
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
          </select>
        ) : (
          <span className="footer-note">No bank accounts yet.</span>
        )
      )}
      <button className="btn" onClick={create}>
        <PlusIcon />Link &amp; add
      </button>
    </>
  );
}

function TransferForm() {
  const addTransfer = usePSXWorkbookStore((s) => s.addTransfer);
  const depositFee = usePSXWorkbookStore((s) => s.workbook.settings.depositFee);
  const currency = usePSXWorkbookStore((s) => s.workbook.settings.currency);
  const ensureSignedIn = useEnsureSignedIn();
  const [t, setT] = useState<Omit<Transfer, 'id'>>({ date: today(), type: 'DEPOSIT', gross: 0, fee: depositFee, timezone: defaultTimezoneForCurrency(currency) });
  const [linkMode, setLinkMode] = useState(false);

  const reset = () => setT({ date: today(), type: 'DEPOSIT', gross: 0, fee: depositFee, timezone: defaultTimezoneForCurrency(currency) });

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} />
        <select value={t.type} onChange={(e) => setT({ ...t, type: e.target.value as Transfer['type'] })}>
          <option value="DEPOSIT">Deposit</option>
          <option value="WITHDRAWAL">Withdrawal</option>
        </select>
        <input
          type="number"
          placeholder="Amount"
          value={t.gross || ''}
          onChange={(e) => setT({ ...t, gross: Number(e.target.value) })}
          style={{ width: 100 }}
        />
        {linkMode ? (
          <LinkedTransferFields date={t.date} type={t.type} gross={t.gross} onLinked={reset} />
        ) : (
          <>
            <input
              type="number"
              placeholder="Fee"
              value={t.fee || ''}
              onChange={(e) => setT({ ...t, fee: Number(e.target.value) })}
              style={{ width: 80 }}
            />
            <TimeZoneFields
              time={t.time}
              timezone={t.timezone}
              onTimeChange={(time) => setT({ ...t, time })}
              onTimezoneChange={(timezone) => setT({ ...t, timezone })}
            />
            <button
              className="btn"
              onClick={async () => {
                if (t.gross <= 0) return toast('Enter an amount.');
                if (!(await ensureSignedIn('Sign in to save transfers.'))) return;
                addTransfer({ ...t, id: crypto.randomUUID() });
                toast('Transfer added.');
                reset();
              }}
            >
              <PlusIcon />Add
            </button>
          </>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
        <input type="checkbox" checked={linkMode} onChange={(e) => setLinkMode(e.target.checked)} />
        Link this to a Bank account or Cash (creates a matching entry there too, instead of just here)
      </label>
    </div>
  );
}

function AdjustmentForm() {
  const addAdjustment = usePSXWorkbookStore((s) => s.addAdjustment);
  const currency = usePSXWorkbookStore((s) => s.workbook.settings.currency);
  const ensureSignedIn = useEnsureSignedIn();
  const emptyAdjustment = (): Adjustment => ({ date: today(), amount: 0, note: '', timezone: defaultTimezoneForCurrency(currency) });
  const [a, setA] = useState<Adjustment>(emptyAdjustment);

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <input type="date" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} />
      <input
        type="number"
        step="0.01"
        placeholder="Amount"
        value={a.amount || ''}
        onChange={(e) => setA({ ...a, amount: Number(e.target.value) })}
        style={{ width: 100 }}
      />
      <input placeholder="Note" value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} />
      <TimeZoneFields
        time={a.time}
        timezone={a.timezone}
        onTimeChange={(time) => setA({ ...a, time })}
        onTimezoneChange={(timezone) => setA({ ...a, timezone })}
      />
      <button
        className="btn"
        onClick={async () => {
          if (!a.amount) return toast('Enter an amount.');
          if (!(await ensureSignedIn('Sign in to save adjustments.'))) return;
          addAdjustment(a);
          toast('Adjustment added.');
          setA(emptyAdjustment());
        }}
      >
        <PlusIcon />Add
      </button>
    </div>
  );
}

type GroupBy = 'none' | 'ticker' | 'action' | 'month';

function groupKey(tx: Transaction, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'ticker': return tx.ticker;
    case 'action': return tx.action;
    case 'month': return tx.date.slice(0, 7);
    default: return '';
  }
}

function TransactionList() {
  const { workbook, calcFee, positions } = usePSXDerived();
  const deleteTransaction = usePSXWorkbookStore((s) => s.deleteTransaction);
  const updateTransaction = usePSXWorkbookStore((s) => s.updateTransaction);
  const currency = workbook.settings.currency;

  const [filterTicker, setFilterTicker] = useState('ALL');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);

  const indexed = workbook.transactions.map((tx, i) => ({ tx, i }));
  const tickers = useMemo(() => [...new Set(workbook.transactions.map((t) => t.ticker))].sort(), [workbook.transactions]);

  // Which tickers are currently open (nonzero shares) vs. fully closed —
  // user request: split the flat transaction log into two sections so
  // "stuff I'm still holding" and "stuff I've fully exited" aren't mixed
  // together the way the Portfolio page's own Holdings/History tabs
  // already separate them.
  const openTickers = useMemo(() => new Set(positions.filter((p) => p.shares > 0).map((p) => p.ticker)), [positions]);

  const filtered = filterTicker === 'ALL' ? indexed : indexed.filter((r) => r.tx.ticker === filterTicker);
  type TxCol = 'date' | 'ticker' | 'action' | 'shares' | 'price' | 'amount' | 'fee';
  const sortValue = (r: (typeof filtered)[number], col: TxCol): number | string => {
    switch (col) {
      case 'ticker': return r.tx.ticker;
      case 'action': return r.tx.action;
      case 'shares': return r.tx.shares;
      case 'price': return r.tx.price;
      case 'amount': return r.tx.shares * r.tx.price;
      case 'fee': return calcFee(r.tx.shares * r.tx.price, r.tx.action === 'BUY', { shares: r.tx.shares, tx: r.tx });
      default: return r.tx.date;
    }
  };
  const { sorted, Th } = useSortableRows(filtered, sortValue, 'date', 'desc');

  const openSorted = useMemo(() => sorted.filter((r) => openTickers.has(r.tx.ticker)), [sorted, openTickers]);
  const closedSorted = useMemo(() => sorted.filter((r) => !openTickers.has(r.tx.ticker)), [sorted, openTickers]);

  const groupRows = (rows: typeof sorted) => {
    if (groupBy === 'none') return [{ key: '', rows }];
    const map: Record<string, typeof sorted> = {};
    rows.forEach((r) => {
      const k = groupKey(r.tx, groupBy);
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, rows]) => ({ key, rows }));
  };
  const openGroups = useMemo(() => groupRows(openSorted), [openSorted, groupBy]);
  const closedGroups = useMemo(() => groupRows(closedSorted), [closedSorted, groupBy]);

  const startEdit = (i: number, tx: Transaction) => {
    setEditIndex(i);
    setEditRow({ ...tx });
  };
  const saveEdit = () => {
    if (editIndex === null || !editRow) return;
    updateTransaction(editIndex, editRow);
    toast('Transaction updated.');
    setEditIndex(null);
    setEditRow(null);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(workbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psx-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setWorkbook = usePSXWorkbookStore((s) => s.setWorkbook);
  const clearAll = async () => {
    const ok = await confirmDialog(
      'This clears all transactions, prices and watchlist entries in this browser.',
      'Clear all transaction data?',
    );
    if (!ok) return;
    setWorkbook({ ...createEmptyPSXWorkbook(), settings: workbook.settings });
    toast('All transaction data cleared.');
  };

  const renderTable = (groups: typeof openGroups, emptyMessage: string) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="date">Date</Th>
            <Th col="ticker">Ticker</Th>
            <Th col="action">Action</Th>
            <Th col="shares">Shares</Th>
            <Th col="price">Price</Th>
            <Th col="amount">Amount</Th>
            <Th col="fee">Fee</Th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key || 'ungrouped'}>
              {g.key && (
                <tr key={'hdr-' + g.key} style={{ background: 'var(--panel-2)' }}>
                  <td colSpan={8}>
                    <strong>{g.key}</strong> — {g.rows.length} txns ·{' '}
                    buys {fmt(g.rows.filter((r) => r.tx.action === 'BUY').reduce((s, r) => s + r.tx.shares, 0), 0)} ·{' '}
                    sells {fmt(g.rows.filter((r) => r.tx.action === 'SELL').reduce((s, r) => s + r.tx.shares, 0), 0)} ·{' '}
                    volume {fmtMoney(g.rows.reduce((s, r) => s + r.tx.shares * r.tx.price, 0), currency)} ·{' '}
                    fees {fmtMoney(g.rows.reduce((s, r) => s + calcFee(r.tx.shares * r.tx.price, r.tx.action === 'BUY', { shares: r.tx.shares, tx: r.tx }), 0), currency)}
                  </td>
                </tr>
              )}
              {g.rows.map(({ tx, i }) =>
                editIndex === i && editRow ? (
                  <tr key={i}>
                    <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                    <td><input value={editRow.ticker} onChange={(e) => setEditRow({ ...editRow, ticker: e.target.value.toUpperCase() })} style={{ width: 70 }} /></td>
                    <td>
                      <select value={editRow.action} onChange={(e) => setEditRow({ ...editRow, action: e.target.value as 'BUY' | 'SELL' })}>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </td>
                    <td><input type="number" value={editRow.shares} onChange={(e) => setEditRow({ ...editRow, shares: Number(e.target.value) })} style={{ width: 70 }} /></td>
                    <td><input type="number" step="0.01" value={editRow.price} onChange={(e) => setEditRow({ ...editRow, price: Number(e.target.value) })} style={{ width: 80 }} /></td>
                    <td>{fmtMoney(editRow.shares * editRow.price, currency)}</td>
                    <td>
                      <FeeModeControl
                        mode={feeModeFor(editRow)}
                        onModeChange={(mode) => {
                          if (mode === 'auto') setEditRow({ ...editRow, manualSameDay: undefined, feeOverride: undefined });
                          else if (mode === 'semi') setEditRow({ ...editRow, manualSameDay: editRow.manualSameDay ?? false, feeOverride: undefined });
                          else setEditRow({ ...editRow, manualSameDay: undefined, feeOverride: editRow.feeOverride ?? 0 });
                        }}
                        manualSameDay={!!editRow.manualSameDay}
                        onManualSameDayChange={(v) => setEditRow({ ...editRow, manualSameDay: v })}
                        feeOverride={editRow.feeOverride}
                        onFeeOverrideChange={(v) => setEditRow({ ...editRow, feeOverride: v })}
                      />
                    </td>
                    <td>
                      <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                      <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditIndex(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td>{tx.date}</td>
                    <td>{tx.ticker}</td>
                    <td className={tx.action === 'BUY' ? 'pill-buy' : 'pill-sell'}>{tx.action}</td>
                    <td>{fmt(tx.shares, 0)}</td>
                    <td>{fmtPrice(tx.price)}</td>
                    <td>{fmtMoney(tx.shares * tx.price, currency)}</td>
                    <td>
                      {fmtMoney(calcFee(tx.shares * tx.price, tx.action === 'BUY', { shares: tx.shares, tx }), currency)}
                      {tx.feeOverride !== undefined ? (
                        <Tooltip text="This fee was manually entered, overriding the computed value.">
                          <span className="footer-note" style={{ cursor: 'pointer' }}>{' '}(override)</span>
                        </Tooltip>
                      ) : (
                        isNettedLeg(workbook.transactions, tx) && (
                          <Tooltip
                            text={tx.manualSameDay ? 'Manually marked as a same-day netted leg — government levies only.' : 'Same-day round trip — netted, government levies only.'}
                          >
                            <span className="footer-note" style={{ cursor: 'pointer' }}>{' '}(netted{tx.manualSameDay ? ', manual' : ''})</span>
                          </Tooltip>
                        )
                      )}
                    </td>
                    <td>
                      <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(i, tx)} />{' '}
                      <IconButton
                        label="Delete"
                        icon={<TrashIcon size={13} />}
                        align="right"
                        onClick={async () => {
                          if (await confirmDialog('This cannot be undone.', `Delete ${tx.action} ${tx.shares} ${tx.ticker}?`)) deleteTransaction(i);
                        }}
                      />
                    </td>
                  </tr>
                ),
              )}
            </Fragment>
          ))}
          {!groups.some((g) => g.rows.length) && (
            <tr><td colSpan={8} className="footer-note">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={filterTicker} onChange={(e) => setFilterTicker(e.target.value)}>
          <option value="ALL">All tickers</option>
          {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
          <option value="none">No grouping</option>
          <option value="ticker">Group by ticker</option>
          <option value="action">Group by buy/sell</option>
          <option value="month">Group by month</option>
        </select>
        <IconButton label="Export JSON" icon={<ExportIcon size={14} />} className="btn secondary" align="right" onClick={exportJSON} />
        <IconButton label="Clear all" icon={<TrashIcon size={14} />} className="btn secondary" align="right" onClick={clearAll} />
      </div>

      <details open style={{ marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 8 }}>
          Open positions — {openSorted.length} txns
        </summary>
        {renderTable(openGroups, 'No transactions for a currently open position.')}
      </details>

      <details open>
        <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 8 }}>
          Closed positions — {closedSorted.length} txns
        </summary>
        {renderTable(closedGroups, 'No transactions for a fully closed position yet.')}
      </details>
    </div>
  );
}

function TransfersSection() {
  const workbook = usePSXWorkbookStore((s) => s.workbook);
  const updateTransfer = usePSXWorkbookStore((s) => s.updateTransfer);
  const deleteTransfer = usePSXWorkbookStore((s) => s.deleteTransfer);
  const currency = workbook.settings.currency;
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Transfer | null>(null);

  // Computed independently of the table's own sort order (which the user
  // can flip to any column) so "Balance" always reflects the true
  // chronological running total, not whatever order the rows happen to be
  // displayed in — same reasoning as the Trade Planner's leg-value resolution.
  const balances = useMemo(() => transferRunningBalance(workbook.transfers), [workbook.transfers]);

  type TransferCol = 'date' | 'type' | 'gross' | 'fee' | 'balance';
  const sortValue = (t: Transfer, col: TransferCol): number | string => {
    switch (col) {
      case 'type': return t.type;
      case 'gross': return t.gross;
      case 'fee': return t.fee;
      case 'balance': return balances.get(t.id) ?? 0;
      default: return t.date;
    }
  };
  const { sorted, Th } = useSortableRows(workbook.transfers, sortValue, 'date', 'desc');

  const startEdit = (t: Transfer) => { setEditId(t.id); setEditRow({ ...t }); };
  const saveEdit = async () => {
    if (editId === null || !editRow) return;
    if (!(await warnIfLinked('psx', editId))) return;
    updateTransfer(editId, editRow);
    toast('Transfer updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div>
      <TransferForm />
      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <Th col="date">Date</Th>
              <Th col="type">Type</Th>
              <Th col="gross">Gross</Th>
              <Th col="fee">Fee</Th>
              <Th col="balance">Balance</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) =>
              editId === t.id && editRow ? (
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
                  <td>{t.date}</td>
                  <td>{t.type}</td>
                  <td>{fmtMoney(t.gross, currency)}</td>
                  <td>{fmtMoney(t.fee, currency)}</td>
                  <td>
                    <Tooltip text="Running net cash contributed, in date order — deposits net of fee, minus withdrawals plus their fee. Doesn't include trading gains/losses; see Dashboard for total cash balance.">
                      <span>{fmtMoney(balances.get(t.id) ?? 0, currency)}</span>
                    </Tooltip>
                  </td>
                  <td>
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(t)} />{' '}
                    <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => confirmAndDeleteLinkable('psx', t.id, () => deleteTransfer(t.id))} />
                  </td>
                </tr>
              ),
            )}
            {!sorted.length && <tr><td colSpan={6} className="footer-note">No transfers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdjustmentsSection() {
  const workbook = usePSXWorkbookStore((s) => s.workbook);
  const updateAdjustment = usePSXWorkbookStore((s) => s.updateAdjustment);
  const deleteAdjustment = usePSXWorkbookStore((s) => s.deleteAdjustment);
  const currency = workbook.settings.currency;
  const indexed = workbook.adjustments.map((a, i) => ({ a, i }));
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Adjustment | null>(null);

  type AdjustmentCol = 'date' | 'amount' | 'note';
  const sortValue = (r: (typeof indexed)[number], col: AdjustmentCol): number | string => {
    switch (col) {
      case 'amount': return r.a.amount;
      case 'note': return r.a.note ?? '';
      default: return r.a.date;
    }
  };
  const { sorted, Th } = useSortableRows(indexed, sortValue, 'date', 'desc');

  const startEdit = (i: number, a: Adjustment) => { setEditIndex(i); setEditRow({ ...a }); };
  const saveEdit = () => {
    if (editIndex === null || !editRow) return;
    updateAdjustment(editIndex, editRow);
    toast('Adjustment updated.');
    setEditIndex(null);
    setEditRow(null);
  };

  return (
    <div>
      <AdjustmentForm />
      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <Th col="date">Date</Th>
              <Th col="amount">Amount</Th>
              <Th col="note">Note</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ a, i }) =>
              editIndex === i && editRow ? (
                <tr key={i}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td><input value={editRow.note ?? ''} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} /></td>
                  <td>
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditIndex(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td>{a.date}</td>
                  <td>{fmtMoney(a.amount, currency)}</td>
                  <td>{a.note}</td>
                  <td>
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(i, a)} />{' '}
                    <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => deleteAdjustment(i)} />
                  </td>
                </tr>
              ),
            )}
            {!sorted.length && <tr><td colSpan={4} className="footer-note">No adjustments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CashLedgerSection() {
  const { workbook, ledger } = usePSXDerived();
  const currency = workbook.settings.currency;

  type LedgerCol = 'date' | 'kind' | 'label' | 'amount' | 'balance';
  const sortValue = (e: (typeof ledger)[number], col: LedgerCol): number | string => {
    switch (col) {
      case 'kind': return e.kind;
      case 'label': return e.label;
      case 'amount': return e.amount;
      case 'balance': return e.balance;
      default: return e.date;
    }
  };
  const { sorted, Th } = useSortableRows(ledger, sortValue, 'date', 'desc');

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="date">Date</Th>
            <Th col="kind">Kind</Th>
            <Th col="label">Label</Th>
            <Th col="amount">Amount</Th>
            <Th col="balance">Balance</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e, i) => (
            <tr key={i}>
              <td>{e.date}</td>
              <td>{e.kind}</td>
              <td>{e.label}</td>
              <td className={e.amount >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(e.amount, currency)}</td>
              <td>{fmtMoney(e.balance, currency)}</td>
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={5} className="footer-note">Nothing recorded yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function TransactionsPage() {
  return (
    <div>
      <h1 className="pagetitle">PSX Trade Transactions</h1>
      <Tabs
        tabs={[
          { key: 'add', label: 'Add trades', content: <TransactionRows /> },
          { key: 'list', label: 'Trade list', content: <TransactionList /> },
          { key: 'transfers', label: 'Cash transfers', content: <TransfersSection /> },
          { key: 'adjustments', label: 'Rewards & adjustments', content: <AdjustmentsSection /> },
          { key: 'ledger', label: 'Cash ledger', content: <CashLedgerSection /> },
          { key: 'dividends', label: 'Dividends', content: <DividendsSection /> },
        ]}
      />
    </div>
  );
}
