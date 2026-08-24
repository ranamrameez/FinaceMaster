import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { Field, TextInput } from '../../../components/ui/Field';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { toCSV } from '../../../lib/csv';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useWorkbookStore } from '../../../store/workbookStore';
import type { Transaction } from '../../../types/workbook';
import { PositionDetail } from '../components/PositionDetail';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';

const today = () => new Date().toISOString().slice(0, 10);

function TickerTransactions({ ticker }: { ticker: string }) {
  const { workbook } = useQSEDerived();
  const updateTransaction = useWorkbookStore((s) => s.updateTransaction);
  const deleteTransaction = useWorkbookStore((s) => s.deleteTransaction);
  const addTransaction = useWorkbookStore((s) => s.addTransaction);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;

  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [date, setDate] = useState(today());
  const [sharesInput, setSharesInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Keep the original index into workbook.transactions so edit/delete hit
  // the right row — the displayed list is filtered to this ticker only.
  const filteredRows = workbook.transactions
    .map((tx, i) => ({ tx, i }))
    .filter((r) => r.tx.ticker === ticker);

  /** README item 40: extends Banking's statement-export pattern (Done
   * item 58) to QSE's own primary record — a stock position's trade
   * statement is its transaction history (the price-history log is
   * exported separately, from PositionDetail's own "Recent updates"). */
  const exportStatement = () => {
    const exportRows = filteredRows
      .filter((r) => (!fromDate || r.tx.date >= fromDate) && (!toDate || r.tx.date <= toDate))
      .map((r) => r.tx)
      .sort((a, b) => a.date.localeCompare(b.date));
    const header = ['Date', 'Action', 'Shares', 'Price', 'Cost'];
    const body = exportRows.map((tx) => [tx.date, tx.action, tx.shares, tx.price, tx.shares * tx.price]);
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
  type Col = 'date' | 'action' | 'shares' | 'price' | 'cost';
  const sortValue = (r: (typeof filteredRows)[number], col: Col): number | string => {
    switch (col) {
      case 'action': return r.tx.action;
      case 'shares': return r.tx.shares;
      case 'price': return r.tx.price;
      case 'cost': return r.tx.shares * r.tx.price;
      default: return r.tx.date;
    }
  };
  const { sorted: rows, Th } = useSortableRows(filteredRows, sortValue, 'date', 'desc');

  const submit = async () => {
    const shares = Number(sharesInput);
    const price = Number(priceInput);
    if (!shares || !price) return toast('Enter shares and price.');
    if (!(await ensureSignedIn('Sign in to save this transaction.'))) return;
    addTransaction({ date, ticker, action, shares, price });
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
        <input type="number" step="0.001" placeholder="Price" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} style={{ width: 90 }} />
        <button className="btn" onClick={submit}>Add {action === 'BUY' ? 'buy' : 'sell'}</button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><Th col="date">Date</Th><Th col="action">Action</Th><Th col="shares">Shares</Th><Th col="price">Price</Th><Th col="cost">Cost</Th><th></th></tr>
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
                  <td><input type="number" step="0.001" value={editRow.price} onChange={(e) => setEditRow({ ...editRow, price: Number(e.target.value) })} style={{ width: 80 }} /></td>
                  <td>{fmtMoney(editRow.shares * editRow.price, currency)}</td>
                  <td>
                    <button className="btn secondary small" onClick={saveEdit}>Save</button>{' '}
                    <button className="btn secondary small" onClick={() => setEditIndex(null)}>Cancel</button>
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
                    <button className="btn secondary small" onClick={() => startEdit(i, tx)}>Edit</button>{' '}
                    <button
                      className="btn secondary small"
                      onClick={async () => {
                        if (await confirmDialog('This cannot be undone.', `Delete ${tx.action} ${tx.shares} ${ticker}?`)) deleteTransaction(i);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
            {!rows.length && <tr><td colSpan={6} className="footer-note">No transactions for {ticker} yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {filteredRows.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
          <Field label="From (optional)">
            <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="To (optional)">
            <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <button className="btn secondary" onClick={exportStatement}>Export CSV</button>
        </div>
      )}
    </div>
  );
}

export function StockPage() {
  const { ticker: rawTicker } = useParams();
  const ticker = (rawTicker || '').toUpperCase();
  const { tickerNames } = useQSEStockData();
  const name = tickerNames[ticker];

  return (
    <div>
      <Link to="/portfolio" className="footer-note">← Back to Portfolio</Link>
      <h1 className="pagetitle" style={{ marginTop: 8 }}>
        {ticker} {name && <span className="footer-note" style={{ fontSize: 16 }}>{shortenCompanyName(name, 40)}</span>}
      </h1>
      <Tabs
        tabs={[
          { key: 'summary', label: 'Summary', content: <PositionDetail ticker={ticker} /> },
          { key: 'transactions', label: 'Transactions', content: <TickerTransactions ticker={ticker} /> },
        ]}
      />
    </div>
  );
}
