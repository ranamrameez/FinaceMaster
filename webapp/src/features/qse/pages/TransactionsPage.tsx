import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QSE_TICKER_DATALIST_ID } from '../../../components/TickerDatalist';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, ExportIcon, PlusIcon, SaveIcon, TrashIcon, TransferIcon, XIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { FabPanel } from '../../../components/ui/Fab';
import { TransactionEntryModal } from '../../../components/TransactionEntryModal';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { computeClosedTrades } from '../../../lib/calc/closedTrades';
import { confirmAndDeleteLinkable, warnIfLinked } from '../../../lib/linkCascade';
import { transferRunningBalance } from '../../../lib/calc/transferBalance';
import { Field } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { defaultTimezoneForCurrency, defaultTimezoneForMarket } from '../../../lib/datetime';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { createEmptyWorkbook } from '../../../store/defaultWorkbook';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useInterEntityTransfersStore } from '../../../store/interEntityTransfersStore';
import { linkTargetPath } from '../../transfers/pages/TransferLinksPage';
import type { Adjustment, Transaction, Transfer } from '../../../types/workbook';
import { DividendsSection } from '../components/DividendsSection';
import { useQSEDerived } from '../hooks/useQSEDerived';

const today = () => new Date().toISOString().slice(0, 10);

function emptyRow(): Transaction {
  return { date: today(), ticker: '', action: 'BUY', shares: 0, price: 0, timezone: defaultTimezoneForMarket('QSE') };
}

function TransactionRows() {
  const addTransactions = useWorkbookStore((s) => s.addTransactions);
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
      {/* README item 10: enter multiple transactions at once, not just one row at a time. */}
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <Field label={i === 0 ? 'Date' : undefined}>
            <input type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
          </Field>
          <Field label={i === 0 ? 'Ticker' : undefined} required={i === 0}>
            <input
              placeholder="Ticker"
              value={r.ticker}
              onChange={(e) => update(i, { ticker: e.target.value.toUpperCase() })}
              list={QSE_TICKER_DATALIST_ID}
              style={{ width: 80 }}
            />
          </Field>
          <Field label={i === 0 ? 'Action' : undefined}>
            <select value={r.action} onChange={(e) => update(i, { action: e.target.value as 'BUY' | 'SELL' })}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </Field>
          <Field label={i === 0 ? 'Shares' : undefined} required={i === 0}>
            <input
              type="number"
              placeholder="Shares"
              value={r.shares || ''}
              onChange={(e) => update(i, { shares: Number(e.target.value) })}
              style={{ width: 90 }}
            />
          </Field>
          <Field label={i === 0 ? 'Price' : undefined} required={i === 0}>
            <input
              type="number"
              step="0.001"
              placeholder="Price"
              value={r.price || ''}
              onChange={(e) => update(i, { price: Number(e.target.value) })}
              style={{ width: 90 }}
            />
          </Field>
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
    </div>
  );
}

/** User-requested (2026-08-28): the module's own "Transfers" FAB, replacing
 * the old always-visible add-transfer form — opens the shared
 * `TransactionEntryModal` defaulted to this exchange's own workbook. */
function TransfersFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabPanel actions={[{ label: 'Transfers', icon: <TransferIcon />, onClick: () => setOpen(true) }]} />
      {open && <TransactionEntryModal defaultFinance={{ module: 'qse' }} onClose={() => setOpen(false)} />}
    </>
  );
}

function AdjustmentForm() {
  const addAdjustment = useWorkbookStore((s) => s.addAdjustment);
  const currency = useWorkbookStore((s) => s.workbook.settings.currency);
  const ensureSignedIn = useEnsureSignedIn();
  const emptyAdjustment = (): Adjustment => ({ date: today(), amount: 0, note: '', timezone: defaultTimezoneForCurrency(currency) });
  const [a, setA] = useState<Adjustment>(emptyAdjustment);

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <Field label="Date">
        <input type="date" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} />
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
  const { workbook, calcFee, positions } = useQSEDerived();
  const deleteTransaction = useWorkbookStore((s) => s.deleteTransaction);
  const updateTransaction = useWorkbookStore((s) => s.updateTransaction);
  const currency = workbook.settings.currency;

  const [filterTicker, setFilterTicker] = useState('ALL');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);

  const indexed = workbook.transactions.map((tx, i) => ({ tx, i }));
  const tickers = useMemo(() => [...new Set(workbook.transactions.map((t) => t.ticker))].sort(), [workbook.transactions]);

  // Which tickers are currently open (nonzero shares) vs. fully closed —
  // user request: split the flat transaction log into two sections, same
  // as PSX (see that file for the full reasoning).
  const openTickers = useMemo(() => new Set(positions.filter((p) => p.shares > 0).map((p) => p.ticker)), [positions]);

  const filtered = filterTicker === 'ALL' ? indexed : indexed.filter((r) => r.tx.ticker === filterTicker);
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key || 'ungrouped'}>
              {g.key && (
                <tr key={'hdr-' + g.key} style={{ background: 'var(--panel-2)' }}>
                  <td colSpan={7}>
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
                    <td>
                      <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                      <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditIndex(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td>{tx.date}</td>
                    <td><Link to={`/stock/${tx.ticker}`}>{tx.ticker}</Link></td>
                    <td className={tx.action === 'BUY' ? 'pill-buy' : 'pill-sell'}>{tx.action}</td>
                    <td>{fmt(tx.shares, 0)}</td>
                    <td>{fmtPrice(tx.price)}</td>
                    <td>{fmtMoney(tx.shares * tx.price, currency)}</td>
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
            <tr><td colSpan={7} className="footer-note">{emptyMessage}</td></tr>
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

      <details style={{ marginTop: 16 }}>
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
              </tr>
            </thead>
            <tbody>
              {sortedClosedTrades.map((t, i) => (
                <tr key={i}>
                  <td><Link to={`/stock/${t.ticker}`}>{t.ticker}</Link></td>
                  <td>{t.buyDate}</td>
                  <td>{fmtPrice(t.buyPrice)}</td>
                  <td>{t.sellDate}</td>
                  <td>{fmtPrice(t.sellPrice)}</td>
                  <td>{fmt(t.shares, 0)}</td>
                  <td>{fmtMoney(t.buyFee, currency)}</td>
                  <td>{fmtMoney(t.sellFee, currency)}</td>
                  <td className={t.netPL >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(t.netPL, currency)}</td>
                  <td>{t.holdingDays}</td>
                </tr>
              ))}
              {!sortedClosedTrades.length && (
                <tr><td colSpan={10} className="footer-note">No closed round-trips yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TransfersSection() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const updateTransfer = useWorkbookStore((s) => s.updateTransfer);
  const deleteTransfer = useWorkbookStore((s) => s.deleteTransfer);
  const currency = workbook.settings.currency;
  const links = useInterEntityTransfersStore((s) => s.workbook.entries);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Transfer | null>(null);

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
    if (!(await warnIfLinked('qse', editId))) return;
    updateTransfer(editId, editRow);
    toast('Transfer updated.');
    setEditId(null);
    setEditRow(null);
  };

  return (
    <div>
      <TransfersFab />
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
            {sorted.map((t) => {
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
                  <td>{t.date}</td>
                  <td>
                    {t.type}
                    {otherSide && (
                      <Link to={linkTargetPath(otherSide)} className="pill-info" style={{ marginLeft: 6, textDecoration: 'none' }} title="Linked — go to the other side">
                        🔗 Linked
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
            {!sorted.length && <tr><td colSpan={6} className="footer-note">No transfers yet.</td></tr>}
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
            {!sorted.length && <tr><td colSpan={4} className="footer-note">No adjustments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CashLedgerSection() {
  const { workbook, ledger } = useQSEDerived();
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
      <h1 className="pagetitle">Trade Transactions</h1>
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
