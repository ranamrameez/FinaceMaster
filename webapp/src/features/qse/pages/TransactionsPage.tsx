import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QSE_TICKER_DATALIST_ID } from '../../../components/TickerDatalist';
import { TickerLogo } from '../../../components/TickerLogo';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { CheckIcon, EditIcon, ExportIcon, PlusIcon, SaveIcon, TrashIcon, TransferIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { RecordDetailModal } from '../../../components/RecordDetailModal';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { usePageFabActions } from '../../../hooks/usePageFabActions';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { closedPLBySellTxId, computeClosedTrades } from '../../../lib/calc/closedTrades';
import { computeFIFOPositions, type FIFOLot } from '../../../lib/calc/fifoPositions';
import { confirmAndDeleteLinkable, warnIfLinked } from '../../../lib/linkCascade';
import { transferRunningBalance } from '../../../lib/calc/transferBalance';
import { Field, Select } from '../../../components/ui/Field';
import { AmountInput } from '../../../components/ui/AmountInput';
import { IconButton } from '../../../components/ui/IconButton';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { defaultTimeForDate, defaultTimezoneForCurrency, defaultTimezoneForMarket, nowTime } from '../../../lib/datetime';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { ReorderButtons } from '../../../components/ui/ReorderButtons';
import { PendingToggle } from '../../../components/ui/PendingToggle';
import { dateOnlyMs } from '../../../lib/datetime';
import { createEmptyWorkbook } from '../../../store/defaultWorkbook';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath, useLinkSideLabel } from '../../transfers/pages/TransferLinksPage';
import type { Adjustment, Transaction, Transfer } from '../../../types/workbook';
import { DividendsSection } from '../components/DividendsSection';
import { useQSEDerived } from '../hooks/useQSEDerived';

const today = () => new Date().toISOString().slice(0, 10);

function emptyRow(): Transaction {
  return { date: today(), ticker: '', action: 'BUY', shares: 0, price: 0, time: nowTime(defaultTimezoneForMarket('QSE')), timezone: defaultTimezoneForMarket('QSE') };
}

export function TransactionRows() {
  const addTransactions = useWorkbookStore((s) => s.addTransactions);
  const ensureSignedIn = useEnsureSignedIn();
  const [rows, setRows] = useState<Transaction[]>([emptyRow()]);
  // Tracks, per queued row, whether the user has actually edited Time
  // themselves — see `defaultTimeForDate()`'s own doc comment. Index-
  // aligned with `rows`; rows are only ever appended/removed, never
  // reordered, so plain array indices stay valid throughout this
  // component's lifecycle (same convention the rest of this app uses for
  // per-row local UI state).
  const [timeTouched, setTimeTouched] = useState<boolean[]>([false]);

  const update = (i: number, patch: Partial<Transaction>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateDate = (i: number, date: string) =>
    update(i, timeTouched[i] ? { date } : { date, time: defaultTimeForDate(date, rows[i].timezone) });
  const touchTime = (i: number) => setTimeTouched((ts) => ts.map((t, idx) => (idx === i ? true : t)));

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
    setTimeTouched([false]);
  };

  return (
    <div>
      {/* README item 10: enter multiple transactions at once, not just one row at a time. */}
      {rows.map((r, i) => (
        <div key={i} className="row entry-row" style={{ gap: 8 }}>
          <Field label={i === 0 ? 'Date' : undefined}>
            <input type="date" value={r.date} onChange={(e) => updateDate(i, e.target.value)} />
          </Field>
          <Field label={i === 0 ? 'Ticker' : undefined} required={i === 0}>
            <input
              placeholder="Ticker"
              value={r.ticker}
              onChange={(e) => update(i, { ticker: e.target.value.toUpperCase() })}
              list={QSE_TICKER_DATALIST_ID}
            />
          </Field>
          <Field label={i === 0 ? 'Action' : undefined}>
            <select value={r.action} onChange={(e) => update(i, { action: e.target.value as 'BUY' | 'SELL' })}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </Field>
          <Field label={i === 0 ? 'Shares' : undefined} required={i === 0} title={i === 0 ? 'You can type a math expression here too, e.g. 100+50.' : undefined}>
            <AmountInput placeholder="Shares" value={r.shares} onChange={(shares) => update(i, { shares })} />
          </Field>
          <Field label={i === 0 ? 'Price' : undefined} required={i === 0} title={i === 0 ? 'You can type a math expression here too, e.g. 10.5+5.' : undefined}>
            <AmountInput placeholder="Price" value={r.price} onChange={(price) => update(i, { price })} />
          </Field>
          <TimeZoneFields
            time={r.time}
            timezone={r.timezone}
            onTimeChange={(time) => { update(i, { time }); touchTime(i); }}
            onTimezoneChange={(timezone) => update(i, { timezone })}
          />
          <Field label={i === 0 ? 'Order' : undefined} as="div">
            <PendingToggle
              checked={!!r.isPending}
              onChange={(v) => update(i, { isPending: v })}
              title="Placed but not yet filled — excluded from your shares/cash balance until it clears."
            />
          </Field>
          <button
            className="btn secondary small ml-auto align-end"
            onClick={() => {
              setRows((rs) => rs.filter((_, idx) => idx !== i));
              setTimeTouched((ts) => ts.filter((_, idx) => idx !== i));
            }}
          >
            <TrashIcon size={12} />Remove
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn secondary"
          onClick={() => { setRows((rs) => [...rs, emptyRow()]); setTimeTouched((ts) => [...ts, false]); }}
        >
          <PlusIcon />Add row
        </button>
      </div>
      <div className="d-flex justify-center" style={{ marginTop: 16 }}>
        <button className="btn" style={{ minWidth: 220 }} onClick={submit}>
          <SaveIcon />Save {rows.length > 1 ? `${rows.length} transactions` : 'transaction'}
        </button>
      </div>
    </div>
  );
}

/** User-requested (2026-08-28): the module's own "Transfers" FAB, replacing
 * the old always-visible add-transfer form — opens the shared
 * `TransactionEntryModal` defaulted to this exchange's own workbook.
 *
 * 2026-09-07: registers via `usePageFabActions` instead of rendering its
 * own `FabPanel` — the globally-mounted `CalculatorLauncher` already
 * renders one `FabPanel` for every Stock Exchanges route, and two separate
 * `position:fixed` panels at the same corner was exactly the "overlapping/
 * blocking instead of grouping" bug reported. */
function TransfersFab() {
  const [open, setOpen] = useState(false);
  const actions = useMemo(() => [{ label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen(true) }], []);
  usePageFabActions(actions);
  return open ? <TransactionEntryModal defaultFinance={{ module: 'qse' }} onClose={() => setOpen(false)} /> : null;
}

function AdjustmentForm() {
  const addAdjustment = useWorkbookStore((s) => s.addAdjustment);
  const currency = useWorkbookStore((s) => s.workbook.settings.currency);
  const ensureSignedIn = useEnsureSignedIn();
  const emptyAdjustment = (): Adjustment => ({ date: today(), amount: 0, note: '', time: nowTime(defaultTimezoneForCurrency(currency)), timezone: defaultTimezoneForCurrency(currency) });
  const [a, setA] = useState<Adjustment>(emptyAdjustment);
  const [timeTouched, setTimeTouched] = useState(false);

  return (
    <div className="row" style={{ gap: 8 }}>
      <Field label="Date">
        <input
          type="date"
          value={a.date}
          onChange={(e) => {
            const date = e.target.value;
            setA(timeTouched ? { ...a, date } : { ...a, date, time: defaultTimeForDate(date, a.timezone) });
          }}
        />
      </Field>
      <Field label="Amount">
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={a.amount || ''}
          onChange={(e) => setA({ ...a, amount: Number(e.target.value) })}
          style={{ width: 100 }}
        />
      </Field>
      <Field label="Note">
        <input placeholder="Note" value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} />
      </Field>
      <TimeZoneFields
        time={a.time}
        timezone={a.timezone}
        onTimeChange={(time) => { setA({ ...a, time }); setTimeTouched(true); }}
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
          setTimeTouched(false);
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
  const { workbook, calcFee, positions } = useQSEDerived();
  const deleteTransaction = useWorkbookStore((s) => s.deleteTransaction);
  const updateTransaction = useWorkbookStore((s) => s.updateTransaction);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;

  const [filterTicker, setFilterTicker] = useState('ALL');
  const [filterAction, setFilterAction] = useState<'ALL' | Transaction['action']>('ALL');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  const indexed = workbook.transactions.map((tx, i) => ({ tx, i }));
  const tickers = useMemo(() => [...new Set(workbook.transactions.map((t) => t.ticker))].sort(), [workbook.transactions]);

  // Which tickers are currently open (nonzero shares) vs. fully closed —
  // user request: split the flat transaction log into two sections, same
  // as PSX (see that file for the full reasoning).
  const openTickers = useMemo(() => new Set(positions.filter((p) => p.shares > 0).map((p) => p.ticker)), [positions]);

  const filtered = indexed
    .filter((r) => filterTicker === 'ALL' || r.tx.ticker === filterTicker)
    .filter((r) => filterAction === 'ALL' || r.tx.action === filterAction);
  type TxCol = 'date' | 'ticker' | 'action' | 'shares' | 'price' | 'amount';
  const sortValue = (r: (typeof filtered)[number], col: TxCol): number | string => {
    switch (col) {
      case 'ticker': return r.tx.ticker;
      case 'action': return r.tx.action;
      case 'shares': return r.tx.shares;
      case 'price': return r.tx.price;
      case 'amount': return r.tx.shares * r.tx.price;
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

  // User's own words: "Individual stock should be marker as open/close with
  // its own buy & selling price, B&S taxes, net Buy/sale, so that sold/
  // closed shares do not ruin the calcs." The Open/Closed split above still
  // groups by ticker — a ticker with an open position shows every past
  // transaction (including old, already-closed round trips) under "Open".
  // This ledger instead reconstructs each individual closed round-trip via
  // FIFO matching, with its own buy price/sell price/fees/net P&L, entirely
  // independent of the aggregate position calc (computeClosedTrades never
  // feeds back into computePositions).
  const closedTrades = useMemo(
    () =>
      computeClosedTrades(
        filterTicker === 'ALL' ? workbook.transactions : workbook.transactions.filter((t) => t.ticker === filterTicker),
        calcFee,
      ),
    [workbook.transactions, calcFee, filterTicker],
  );
  type CTCol = 'ticker' | 'buyDate' | 'buyPrice' | 'sellDate' | 'sellPrice' | 'shares' | 'buyFee' | 'sellFee' | 'netPL' | 'holdingDays';
  const ctSortValue = (t: (typeof closedTrades)[number], col: CTCol): number | string => {
    switch (col) {
      case 'ticker': return t.ticker;
      case 'buyPrice': return t.buyPrice;
      case 'sellDate': return t.sellDate;
      case 'sellPrice': return t.sellPrice;
      case 'shares': return t.shares;
      case 'buyFee': return t.buyFee;
      case 'sellFee': return t.sellFee;
      case 'netPL': return t.netPL;
      case 'holdingDays': return t.holdingDays;
      default: return t.buyDate;
    }
  };
  const { sorted: sortedClosedTrades, Th: CTTh } = useSortableRows(closedTrades, ctSortValue, 'sellDate', 'desc');

  // User's own ask (2026-09-08): "show the sold price and PL w.r.t. that
  // lot's buy price... inline in the main trade row." Computed from the
  // WHOLE workbook (not `filterTicker`-scoped like `closedTrades` above) so
  // a row's own P&L figure never changes just because the ticker filter is
  // narrowed to something else.
  const sellPLById = useMemo(
    () => closedPLBySellTxId(computeClosedTrades(workbook.transactions, calcFee)),
    [workbook.transactions, calcFee],
  );

  // User's own words: "make separate sections for open and closed trades...
  // it gets difficult to know the sold status and price of a lot." Same
  // FIFO-lot view as `computeClosedTrades` above, just the still-held half
  // of it (`computeFIFOPositions`'s own `lotsByTicker`) — a pure reporting
  // ledger, independent of QSE's own weighted-average position calc.
  const openLots = useMemo(() => {
    const txs = filterTicker === 'ALL' ? workbook.transactions : workbook.transactions.filter((t) => t.ticker === filterTicker);
    const { lotsByTicker } = computeFIFOPositions(txs, calcFee);
    const flat: (FIFOLot & { ticker: string })[] = [];
    for (const [ticker, lots] of Object.entries(lotsByTicker)) {
      for (const lot of lots) flat.push({ ticker, ...lot });
    }
    return flat;
  }, [workbook.transactions, calcFee, filterTicker]);
  type OLCol = 'ticker' | 'buyDate' | 'buyPrice' | 'shares' | 'invested' | 'buyFeeTotal';
  const olSortValue = (l: (typeof openLots)[number], col: OLCol): number | string => {
    switch (col) {
      case 'ticker': return l.ticker;
      case 'buyPrice': return l.buyPrice;
      case 'shares': return l.remainingShares;
      case 'invested': return l.remainingShares * l.buyPrice;
      case 'buyFeeTotal': return l.buyFeeTotal;
      default: return l.buyDate;
    }
  };
  const { sorted: sortedOpenLots, Th: OLTh } = useSortableRows(openLots, olSortValue, 'buyDate', 'desc');

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
    a.download = `qse-workbook-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setWorkbook = useWorkbookStore((s) => s.setWorkbook);
  const clearAll = async () => {
    const ok = await confirmDialog(
      'This clears all transactions, prices and watchlist entries in this browser.',
      'Clear all transaction data?',
    );
    if (!ok) return;
    setWorkbook({ ...createEmptyWorkbook(), settings: workbook.settings, appearance: workbook.appearance });
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
            <th>
              <Tooltip text="Realized profit/loss for a SELL row, matched FIFO against your oldest still-open buy lot(s) for this ticker — the same figure as the Closed trades section below, shown per-row here. Blank on a BUY row (nothing realized yet).">
                P/L
              </Tooltip>
            </th>
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
                    fees {fmtMoney(g.rows.reduce((s, r) => s + calcFee(r.tx.shares * r.tx.price, r.tx.action === 'BUY'), 0), currency)}
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
                    <td><input type="number" step="0.001" value={editRow.price} onChange={(e) => setEditRow({ ...editRow, price: Number(e.target.value) })} style={{ width: 80 }} /></td>
                    <td>{fmtMoney(editRow.shares * editRow.price, currency)}</td>
                    <td></td>
                    <td>
                      <PendingToggle
                        checked={!!editRow.isPending}
                        onChange={(v) => setEditRow({ ...editRow, isPending: v })}
                        title="Placed but not yet filled — excluded from shares/cash balance until cleared."
                      />{' '}
                      <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                      <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditIndex(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={i} onClick={() => setDetailTx(tx)} className="clickable">
                    <td>{tx.date}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <TickerLogo ticker={tx.ticker} size="sm" exchange="qse" /><Link to={`/stock/${tx.ticker}`}>{tx.ticker}</Link>
                      {tx.isPending && (
                        <Tooltip text="Order placed but not yet filled — excluded from your shares/cash balance until cleared.">
                          <span className="pill-warn" style={{ marginLeft: 6 }}>Pending</span>
                        </Tooltip>
                      )}
                    </td>
                    <td className={tx.action === 'BUY' ? 'pill-positive' : 'pill-negative'}>{tx.action}</td>
                    <td>{fmt(tx.shares, 0)}</td>
                    <td>{fmtPrice(tx.price)}</td>
                    <td>{fmtMoney(tx.shares * tx.price, currency)}</td>
                    <td className={tx.id && sellPLById[tx.id] ? (sellPLById[tx.id].netPL >= 0 ? 'pill-positive' : 'pill-negative') : undefined}>
                      {tx.id && sellPLById[tx.id] ? fmtMoney(sellPLById[tx.id].netPL, currency) : '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {tx.isPending && (
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
            <tr><td colSpan={8} className="text-muted">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <select value={filterTicker} onChange={(e) => setFilterTicker(e.target.value)}>
          <option value="ALL">All tickers</option>
          {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value as typeof filterAction)}>
          <option value="ALL">Buy &amp; sell</option>
          <option value="BUY">Buy only</option>
          <option value="SELL">Sell only</option>
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

      <details open style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 8 }}>
          <Tooltip text="Each buy lot that hasn't been fully sold yet, FIFO-matched against your real sells — the mirror image of Closed trades below, so it's always clear which shares are still open vs. already sold.">
            Open trades (not yet sold)
          </Tooltip>{' '}
          — {sortedOpenLots.length}
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <OLTh col="ticker">Ticker</OLTh>
                <OLTh col="buyDate">Buy date</OLTh>
                <OLTh col="buyPrice">Buy price</OLTh>
                <OLTh col="shares">Shares</OLTh>
                <OLTh col="invested">Invested</OLTh>
                <OLTh col="buyFeeTotal">Buy fee</OLTh>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedOpenLots.map((l, i) => (
                <tr key={i}>
                  <td><TickerLogo ticker={l.ticker} size="sm" exchange="qse" /><Link to={`/stock/${l.ticker}`}>{l.ticker}</Link></td>
                  <td>{l.buyDate}</td>
                  <td>{fmtPrice(l.buyPrice)}</td>
                  <td>{fmt(l.remainingShares, 0)}</td>
                  <td>{fmtMoney(l.remainingShares * l.buyPrice, currency)}</td>
                  <td>{fmtMoney(l.buyFeeTotal, currency)}</td>
                  <td><span className="pill pill-info">Open</span></td>
                </tr>
              ))}
              {!sortedOpenLots.length && (
                <tr><td colSpan={7} className="text-muted">No open lots — everything bought so far has been sold.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <details open style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 8 }}>
          <Tooltip text="Each fully or partially closed round-trip, matched buy-to-sell via FIFO, with its own buy price, sell price, fees on both legs, and net P/L — so a closed trade's own numbers stay separate from whatever the currently-open position shows.">
            Closed trades (realized round-trips)
          </Tooltip>{' '}
          — {sortedClosedTrades.length}
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <CTTh col="ticker">Ticker</CTTh>
                <CTTh col="buyDate">Buy date</CTTh>
                <CTTh col="buyPrice">Buy price</CTTh>
                <CTTh col="sellDate">Sell date</CTTh>
                <CTTh col="sellPrice">Sell price</CTTh>
                <CTTh col="shares">Shares</CTTh>
                <CTTh col="buyFee">Buy fee</CTTh>
                <CTTh col="sellFee">Sell fee</CTTh>
                <CTTh col="netPL">Net P/L</CTTh>
                <CTTh col="holdingDays">Days held</CTTh>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedClosedTrades.map((t, i) => (
                <tr key={i}>
                  <td><TickerLogo ticker={t.ticker} size="sm" exchange="qse" /><Link to={`/stock/${t.ticker}`}>{t.ticker}</Link></td>
                  <td>{t.buyDate}</td>
                  <td>{fmtPrice(t.buyPrice)}</td>
                  <td>{t.sellDate}</td>
                  <td>{fmtPrice(t.sellPrice)}</td>
                  <td>{fmt(t.shares, 0)}</td>
                  <td>{fmtMoney(t.buyFee, currency)}</td>
                  <td>{fmtMoney(t.sellFee, currency)}</td>
                  <td className={t.netPL >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(t.netPL, currency)}</td>
                  <td>{t.holdingDays}</td>
                  <td><span className="pill pill-info">Closed</span></td>
                </tr>
              ))}
              {!sortedClosedTrades.length && (
                <tr><td colSpan={11} className="text-muted">No closed round-trips yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      {detailTx && (
        <RecordDetailModal
          title={`${detailTx.action} ${detailTx.ticker}`}
          onClose={() => setDetailTx(null)}
          fields={[
            { label: 'Date', value: detailTx.date },
            { label: 'Time', value: detailTx.time ?? '— (defaults to noon)' },
            { label: 'Timezone', value: detailTx.timezone ?? '—' },
            { label: 'Ticker', value: detailTx.ticker },
            { label: 'Action', value: detailTx.action },
            { label: 'Shares', value: fmt(detailTx.shares, 0) },
            { label: 'Price', value: fmtPrice(detailTx.price) },
            { label: 'Amount', value: fmtMoney(detailTx.shares * detailTx.price, currency) },
            ...(detailTx.id && sellPLById[detailTx.id]
              ? [{ label: 'Realized P/L', value: fmtMoney(sellPLById[detailTx.id].netPL, currency) }]
              : []),
            { label: 'Status', value: detailTx.isPending ? 'Pending (not yet cleared)' : 'Cleared' },
          ]}
        />
      )}
    </div>
  );
}

/** User-requested (2026-09-03): "add filters to other tables as well" —
 * extends the Type/Category filter treatment Cash's statement tables got
 * (README Done item 224) to QSE's own Transfers table. */
function TransfersSection() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const updateTransfer = useWorkbookStore((s) => s.updateTransfer);
  const deleteTransfer = useWorkbookStore((s) => s.deleteTransfer);
  const currency = workbook.settings.currency;
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const ensureSignedIn = useEnsureSignedIn();
  const sideLabel = useLinkSideLabel();
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Transfer | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | Transfer['type']>('all');

  const linkByRecordId = useMemo(() => {
    const map = new Map<string, (typeof links)[number]>();
    for (const l of links) {
      if (l.from.module === 'qse') map.set(l.fromRecordId, l);
      if (l.to.module === 'qse') map.set(l.toRecordId, l);
    }
    return map;
  }, [links]);

  // Computed independently of the table's own sort order (which the user
  // can flip to any column) so "Balance" always reflects the true
  // chronological running total, not whatever order the rows happen to be
  // displayed in — same reasoning as the Trade Planner's leg-value resolution.
  const balances = useMemo(() => transferRunningBalance(workbook.transfers), [workbook.transfers]);

  const filteredTransfers = useMemo(
    () => (typeFilter === 'all' ? workbook.transfers : workbook.transfers.filter((t) => t.type === typeFilter)),
    [workbook.transfers, typeFilter],
  );

  // User-reported (2026-09-06): "we may stop sorting options for
  // chronologically important tables (only sequence-aware tables) to
  // avoid the disordered mess" — same reasoning as Bank's/Cash's/Personal
  // Loans' own ledger tables (Done item 235): the Balance column only
  // makes sense in real chronological+sequence order, so free column
  // sorting is gone here, replaced by `ReorderButtons` for the one thing
  // that genuinely needs fixing (two same-instant transfers in the wrong
  // relative order).
  const instantOf = (t: Transfer) => dateOnlyMs(t.date);
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
    if (!(await warnIfLinked('qse', editId))) return;
    updateTransfer(editId, editRow);
    toast('Transfer updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <Field label="Type" width={140}>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
            <option value="all">All</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
          </Select>
        </Field>
      </div>
      <div className="table-scroll">
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
              const otherSide = link ? (link.from.module === 'qse' && link.fromRecordId === t.id ? link.to : link.from) : undefined;
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
                    <Tooltip text="Running net cash contributed, in date order — deposits net of fee, minus withdrawals plus their fee. Doesn't include trading gains/losses; see Dashboard for total cash balance.">
                      <span>{fmtMoney(balances.get(t.id) ?? 0, currency)}</span>
                    </Tooltip>
                  </td>
                  <td>
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(t)} />{' '}
                    <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => confirmAndDeleteLinkable('qse', t.id, () => deleteTransfer(t.id))} />
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

function AdjustmentsSection() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const updateAdjustment = useWorkbookStore((s) => s.updateAdjustment);
  const deleteAdjustment = useWorkbookStore((s) => s.deleteAdjustment);
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
            {!sorted.length && <tr><td colSpan={4} className="text-muted">No adjustments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** User-requested (2026-09-03): "add filters to other tables as well." */
function CashLedgerSection() {
  const { workbook, ledger } = useQSEDerived();
  const currency = workbook.settings.currency;
  const [kindFilter, setKindFilter] = useState<'all' | (typeof ledger)[number]['kind']>('all');

  const filtered = useMemo(
    () => (kindFilter === 'all' ? ledger : ledger.filter((e) => e.kind === kindFilter)),
    [ledger, kindFilter],
  );

  // User-reported (2026-09-06): "we may stop sorting options for
  // chronologically important tables (only sequence-aware tables) to
  // avoid the disordered mess" — a merged trades+transfers+adjustments
  // ledger's Balance column only makes sense in `buildCashLedger`'s own
  // real chronological order (which also enforces the domain rule that a
  // transfer settles before a same-instant trade — see that function's
  // own doc comment), so free column sorting is gone here. Unlike
  // Bank/Cash/Personal Loans/Transfers above, this merged view has no
  // `ReorderButtons` of its own: each row here is DERIVED from a real
  // trade/transfer/adjustment record living in its own native table
  // (Trade Transactions / the Transfers section just above / Adjustments)
  // — reordering happens there, and flows through to this view
  // automatically since it's fully computed from the same `seq` fields.
  const sorted = [...filtered].reverse();

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <Field label="Kind" width={140}>
          <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}>
            <option value="all">All</option>
            <option value="trade">Trade</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
          </Select>
        </Field>
      </div>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Kind</th>
            <th>Label</th>
            <th>Amount</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e, i) => (
            <tr key={i}>
              <td>{e.date}</td>
              <td>{e.kind}</td>
              <td>{e.label}</td>
              <td className={e.amount >= 0 ? 'pill-positive' : 'pill-negative'}>{fmtMoney(e.amount, currency)}</td>
              <td>{fmtMoney(e.balance, currency)}</td>
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={5} className="text-muted">Nothing recorded yet.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export function TransactionsPage() {
  return (
    <div>
      <h1 className="pagetitle">Trade Transactions</h1>
      {/* User-reported (2026-08-28, real audit after "you're ignoring what's
         asked for"): the Transfers FAB used to live inside `TransfersSection`
         — content of the "Cash transfers" tab below, which `CollapsibleCard`
         doesn't even mount into the DOM until that specific tab is expanded
         (see `Card.tsx`: `{open && <div>{children}</div>}`, not a CSS hide).
         Since `TransfersFab` is a `position:fixed` floating button, that
         meant it silently didn't exist at all until the user happened to
         open that one tab — every other module has it always visible from
         page load. Moved to the page's own top level so it's mounted
         unconditionally, matching every other module. */}
      <TransfersFab />
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
