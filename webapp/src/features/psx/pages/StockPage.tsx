import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { RiskCalculator } from '../../../components/RiskCalculator';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { Field, TextInput } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { TimeZoneFields } from '../../../components/ui/TimeZoneFields';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { defaultTimezoneForMarket } from '../../../lib/datetime';
import { toCSV } from '../../../lib/csv';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { isNettedLeg } from '../../../lib/calc/psxFees';
import { FeeModeControl, feeModeFor, type FeeMode } from '../../../components/ui/FeeModeControl';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { Transaction } from '../../../types/workbook';
import { PositionDetail } from '../components/PositionDetail';
import { usePSXDerived } from '../hooks/usePSXDerived';
import { usePSXStockData } from '../hooks/usePSXStockData';

const today = () => new Date().toISOString().slice(0, 10);

function TickerTransactions({ ticker }: { ticker: string }) {
  const { workbook, calcFee } = usePSXDerived();
  const updateTransaction = usePSXWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = usePSXWorkbookStore((s) => s.deleteTransaction);
  const addTransaction = usePSXWorkbookStore((s) => s.addTransaction);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;

  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [date, setDate] = useState(today());
  const [sharesInput, setSharesInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  // Auto by default — the real same-day auto-detection in psxFees.ts
  // correctly nets whichever side should be netted once both legs of a
  // same-day round trip exist, with no manual flag needed. An earlier
  // version of this form pre-checked "Same-day override" for every fresh
  // BUY dated today, on the theory that it's "probably about to close
  // same-day" — this was a real bug, confirmed against a real user's
  // trade history: PSX's own same-day rule ties go to BUY (the side that
  // should pay FULL commission), so pre-marking the BUY as netted made
  // BOTH legs of the most common same-day pattern (buy some, sell it all
  // same day) come out netted, silently under-charging real fees and
  // overstating cash balance. There's also no way to know in advance
  // whether a fresh buy will end up being the charged or netted side —
  // that depends on the SELL's quantity, which doesn't exist yet. The
  // checkbox stays available for its original, narrower purpose (the
  // recorded date not lining up with the real same-day trade), just no
  // longer pre-checked.
  const [feeMode, setFeeMode] = useState<FeeMode>('auto');
  const [manualSameDay, setManualSameDay] = useState(false);
  const [feeOverrideInput, setFeeOverrideInput] = useState<number | undefined>(undefined);
  const [time, setTime] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string | undefined>(defaultTimezoneForMarket('PSX'));
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);

  const filteredRows = workbook.transactions
    .map((tx, i) => ({ tx, i }))
    .filter((r) => r.tx.ticker === ticker);

  type Col = 'date' | 'action' | 'shares' | 'price' | 'cost' | 'fee';
  const sortValue = (r: (typeof filteredRows)[number], col: Col): number | string => {
    switch (col) {
      case 'action': return r.tx.action;
      case 'shares': return r.tx.shares;
      case 'price': return r.tx.price;
      case 'cost': return r.tx.shares * r.tx.price;
      case 'fee': return calcFee(r.tx.shares * r.tx.price, r.tx.action === 'BUY', { shares: r.tx.shares, tx: r.tx });
      default: return r.tx.date;
    }
  };
  const { sorted: rows, Th } = useSortableRows(filteredRows, sortValue, 'date', 'desc');

  const submit = async () => {
    const shares = Number(sharesInput);
    const price = Number(priceInput);
    if (!shares || !price) return toast('Enter shares and price.');
    if (!(await ensureSignedIn('Sign in to save this transaction.'))) return;
    addTransaction({
      date, ticker, action, shares, price, time, timezone,
      manualSameDay: feeMode === 'semi' ? manualSameDay : undefined,
      feeOverride: feeMode === 'manual' ? feeOverrideInput : undefined,
    });
    toast(`${action} ${shares} ${ticker} @ ${fmtPrice(price)} logged.`);
    setSharesInput('');
    setPriceInput('');
  };

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

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={action} onChange={(e) => setAction(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="number" placeholder="Shares" value={sharesInput} onChange={(e) => setSharesInput(e.target.value)} style={{ width: 90 }} />
        <input type="number" step="0.01" placeholder="Price" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} style={{ width: 90 }} />
        <FeeModeControl
          mode={feeMode}
          onModeChange={setFeeMode}
          manualSameDay={manualSameDay}
          onManualSameDayChange={setManualSameDay}
          feeOverride={feeOverrideInput}
          onFeeOverrideChange={setFeeOverrideInput}
        />
        <TimeZoneFields time={time} timezone={timezone} onTimeChange={setTime} onTimezoneChange={setTimezone} />
        <button className="btn" onClick={submit}>Add {action === 'BUY' ? 'buy' : 'sell'}</button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><Th col="date">Date</Th><Th col="action">Action</Th><Th col="shares">Shares</Th><Th col="price">Price</Th><Th col="cost">Cost</Th><Th col="fee">Fee</Th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(({ tx, i }) =>
              editIndex === i && editRow ? (
                <tr key={i}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
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
                          text={tx.manualSameDay ? 'Manually marked as a same-day netted leg — government levies only.' : 'Same-day round trip — commission charged on the other leg, this one pays only government levies.'}
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
                        if (await confirmDialog('This cannot be undone.', `Delete ${tx.action} ${tx.shares} ${ticker}?`)) deleteTransaction(i);
                      }}
                    />
                  </td>
                </tr>
              ),
            )}
            {!rows.length && <tr><td colSpan={7} className="footer-note">No transactions for {ticker} yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Pending item 58's remainder: this button used to sit inside
 * `TickerTransactions`'s own content, one level below where every other
 * module's equivalent export button lives (Done item 121's `headerExtra`
 * rollout) — `Tabs` had no per-tab `headerExtra` slot to hoist it into
 * until now. Lifted out into its own hook so `StockPage` can build the
 * header control at the `Tabs` call site while `TickerTransactions` keeps
 * its own add/edit/delete concerns unchanged. Fee included since PSX fees
 * are variable (same-day netting, overrides) unlike QSE's flat rate. */
function useTickerExport(ticker: string) {
  const { workbook, calcFee } = usePSXDerived();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const rows = workbook.transactions.filter((tx) => tx.ticker === ticker);

  const exportStatement = () => {
    const exportRows = rows
      .filter((tx) => (!fromDate || tx.date >= fromDate) && (!toDate || tx.date <= toDate))
      .sort((a, b) => a.date.localeCompare(b.date));
    const header = ['Date', 'Action', 'Shares', 'Price', 'Cost', 'Fee'];
    const body = exportRows.map((tx) => [tx.date, tx.action, tx.shares, tx.price, tx.shares * tx.price, calcFee(tx.shares * tx.price, tx.action === 'BUY', { shares: tx.shares, tx })]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'now'}` : '';
    a.download = `${ticker}_statement${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Statement downloaded.');
  };

  return { fromDate, setFromDate, toDate, setToDate, exportStatement, hasRows: rows.length > 0 };
}

export function StockPage() {
  const { ticker: rawTicker } = useParams();
  const ticker = (rawTicker || '').toUpperCase();
  const { tickerNames } = usePSXStockData();
  const name = tickerNames[ticker];
  const { fromDate, setFromDate, toDate, setToDate, exportStatement, hasRows } = useTickerExport(ticker);
  const { workbook, rows, calcFee, positions } = usePSXDerived();
  const isOpen = (positions.find((p) => p.ticker === ticker)?.shares || 0) > 0;

  return (
    <div>
      <Link to="/psx/portfolio" className="footer-note">← Back to Portfolio</Link>
      <h1 className="pagetitle" style={{ marginTop: 8 }}>
        {ticker} {name && <span className="footer-note" style={{ fontSize: 16 }}>{shortenCompanyName(name, 40)}</span>}
      </h1>
      <Tabs
        tabs={[
          { key: 'summary', label: 'Summary', content: <PositionDetail ticker={ticker} /> },
          {
            key: 'transactions',
            label: 'Trades',
            content: <TickerTransactions ticker={ticker} />,
            headerExtra: hasRows ? (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="From (optional)">
                  <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </Field>
                <Field label="To (optional)">
                  <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </Field>
                <button className="btn secondary" onClick={exportStatement}>Export CSV</button>
              </div>
            ) : undefined,
          },
          // Pending item 49 ("assess a stock in one go"): see the identical
          // comment in QSE's StockPage.tsx.
          ...(isOpen
            ? [{
                key: 'risk',
                label: 'Risk Analysis',
                content: (
                  <RiskCalculator
                    rows={rows}
                    tickerNames={tickerNames}
                    currency={workbook.settings.currency}
                    feePct={workbook.settings.feePct}
                    tick={workbook.settings.tick}
                    calcFee={calcFee}
                    initialTicker={ticker}
                  />
                ),
              }]
            : []),
        ]}
      />
    </div>
  );
}
