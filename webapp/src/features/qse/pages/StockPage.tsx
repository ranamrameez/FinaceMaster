import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
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

  // Keep the original index into workbook.transactions so edit/delete hit
  // the right row — the displayed list is filtered to this ticker only.
  const rows = workbook.transactions
    .map((tx, i) => ({ tx, i }))
    .filter((r) => r.tx.ticker === ticker)
    .sort((a, b) => b.tx.date.localeCompare(a.tx.date));

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
            <tr><th>Date</th><th>Action</th><th>Shares</th><th>Price</th><th>Cost</th><th></th></tr>
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
