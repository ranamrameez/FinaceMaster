import { useState } from 'react';
import { PSX_TICKER_DATALIST_ID } from '../../../components/PSXTickerDatalist';
import { EditIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { IconButton } from '../../../components/ui/IconButton';
import { fmt, fmtMoney } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { Dividend } from '../../../types/workbook';
import { usePSXDerived } from '../hooks/usePSXDerived';

const today = () => new Date().toISOString().slice(0, 10);

function AddDividendForm() {
  const addDividend = usePSXWorkbookStore((s) => s.addDividend);
  const ensureSignedIn = useEnsureSignedIn();
  const { positions } = usePSXDerived();
  const [date, setDate] = useState(today());
  const [ticker, setTicker] = useState('');
  const [perShare, setPerShare] = useState(0);
  const [shares, setShares] = useState(0);
  const [amount, setAmount] = useState(0);
  const [sharesTouched, setSharesTouched] = useState(false);

  const onTickerChange = (v: string) => {
    const up = v.toUpperCase();
    setTicker(up);
    if (!sharesTouched) {
      const held = positions.find((p) => p.ticker === up && p.shares > 0);
      if (held) setShares(held.shares);
    }
  };

  const preview = perShare > 0 && shares > 0 ? perShare * shares : 0;

  const submit = async () => {
    const finalAmount = amount || preview;
    if (!ticker || !finalAmount) return toast('Enter a ticker and an amount (or per-share + shares).');
    if (!(await ensureSignedIn('Sign in to save dividends.'))) return;
    addDividend({ date, ticker, perShare: perShare || 0, shares: shares || 0, amount: finalAmount });
    toast(`Dividend logged for ${ticker}.`);
    setTicker('');
    setPerShare(0);
    setShares(0);
    setAmount(0);
    setSharesTouched(false);
  };

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input placeholder="Ticker" value={ticker} onChange={(e) => onTickerChange(e.target.value)} list={PSX_TICKER_DATALIST_ID} style={{ width: 90 }} />
      <input type="number" step="0.01" placeholder="Per share" value={perShare || ''} onChange={(e) => setPerShare(Number(e.target.value))} style={{ width: 90 }} />
      <input
        type="number"
        placeholder="Shares"
        value={shares || ''}
        onChange={(e) => {
          setShares(Number(e.target.value));
          setSharesTouched(true);
        }}
        style={{ width: 90 }}
      />
      <input type="number" step="0.01" placeholder={preview ? preview.toFixed(2) : 'Total received'} value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 100 }} />
      <button className="btn" onClick={submit}>Add</button>
      {preview > 0 && !amount && <span className="footer-note">{fmt(shares, 0)} shares × {perShare} = {preview.toFixed(2)}</span>}
    </div>
  );
}

export function DividendsSection() {
  const { workbook, positions } = usePSXDerived();
  const removeDividend = usePSXWorkbookStore((s) => s.removeDividend);
  const updateDividend = usePSXWorkbookStore((s) => s.updateDividend);
  const setDividendEstimate = usePSXWorkbookStore((s) => s.setDividendEstimate);
  const currency = workbook.settings.currency;
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Dividend | null>(null);

  const startEdit = (i: number, d: Dividend) => { setEditIndex(i); setEditRow({ ...d }); };
  const saveEdit = () => {
    if (editIndex === null || !editRow) return;
    updateDividend(editIndex, editRow);
    toast('Dividend updated.');
    setEditIndex(null);
    setEditRow(null);
  };

  const sortValue = (d: (typeof workbook.dividends)[number], col: string) => {
    switch (col) {
      case 'ticker': return d.ticker;
      case 'perShare': return d.perShare;
      case 'shares': return d.shares;
      case 'amount': return d.amount;
      default: return d.date;
    }
  };
  const rows = [...workbook.dividends.map((d, i) => ({ ...d, i }))].sort((a, b) => {
    const av = sortValue(a, sort.col);
    const bv = sortValue(b, sort.col);
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  const toggleSort = (col: string) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }));
  const arrow = (col: string) => (sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const total = workbook.dividends.reduce((s, d) => s + d.amount, 0);

  const held = positions.filter((p) => p.shares > 0);
  const estimates = workbook.dividendEstimates || {};
  const totalProjected = held.reduce((s, p) => s + (estimates[p.ticker] || 0) * p.shares, 0);

  type HeldCol = 'ticker' | 'shares' | 'estPerShare' | 'projected';
  const heldSortValue = (p: (typeof held)[number], col: HeldCol): number | string => {
    switch (col) {
      case 'ticker': return p.ticker;
      case 'shares': return p.shares;
      case 'estPerShare': return estimates[p.ticker] || 0;
      case 'projected': return (estimates[p.ticker] || 0) * p.shares;
    }
  };
  const { sorted: sortedHeld, Th: HeldTh } = useSortableRows(held, heldSortValue, 'ticker', 'asc');

  return (
    <div>
      <h3>Add dividend</h3>
      <AddDividendForm />

      <h3 style={{ marginTop: 24 }}>Dividends log</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>Date{arrow('date')}</th>
              <th onClick={() => toggleSort('ticker')} style={{ cursor: 'pointer' }}>Ticker{arrow('ticker')}</th>
              <th onClick={() => toggleSort('perShare')} style={{ cursor: 'pointer' }}>Per share{arrow('perShare')}</th>
              <th onClick={() => toggleSort('shares')} style={{ cursor: 'pointer' }}>Shares{arrow('shares')}</th>
              <th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer' }}>Amount{arrow('amount')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) =>
              editIndex === d.i && editRow ? (
                <tr key={d.i}>
                  <td><input type="date" value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} style={{ width: 130 }} /></td>
                  <td><input value={editRow.ticker} onChange={(e) => setEditRow({ ...editRow, ticker: e.target.value.toUpperCase() })} style={{ width: 80 }} /></td>
                  <td><input type="number" step="0.01" value={editRow.perShare} onChange={(e) => setEditRow({ ...editRow, perShare: Number(e.target.value) })} style={{ width: 80 }} /></td>
                  <td><input type="number" value={editRow.shares} onChange={(e) => setEditRow({ ...editRow, shares: Number(e.target.value) })} style={{ width: 80 }} /></td>
                  <td><input type="number" step="0.01" value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td>
                    <IconButton label="Save" icon={<SaveIcon size={13} />} align="right" onClick={saveEdit} />{' '}
                    <IconButton label="Cancel" icon={<XIcon size={13} />} align="right" onClick={() => setEditIndex(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={d.i}>
                  <td>{d.date}</td>
                  <td>{d.ticker}</td>
                  <td>{d.perShare || '—'}</td>
                  <td>{d.shares || '—'}</td>
                  <td className="pill-buy">{fmtMoney(d.amount, currency)}</td>
                  <td>
                    <IconButton label="Edit" icon={<EditIcon size={13} />} align="right" onClick={() => startEdit(d.i, d)} />{' '}
                    <IconButton label="Delete" icon={<TrashIcon size={13} />} align="right" onClick={() => removeDividend(d.i)} />
                  </td>
                </tr>
              ),
            )}
            {!rows.length && <tr><td colSpan={6} className="footer-note">No dividends logged yet.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={4}>Total collected</td><td className="pill-buy">{fmtMoney(total, currency)}</td><td></td></tr>
          </tfoot>
        </table>
      </div>

      {held.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Yearly projection</h3>
          <p className="footer-note">Enter an estimated annual per-share dividend rate for each held ticker; projection = rate × shares held.</p>
          <div className="table-scroll">
            <table>
              <thead><tr><HeldTh col="ticker">Ticker</HeldTh><HeldTh col="shares">Shares</HeldTh><HeldTh col="estPerShare">Est. annual/share</HeldTh><HeldTh col="projected">Projected annual</HeldTh></tr></thead>
              <tbody>
                {sortedHeld.map((p) => (
                  <tr key={p.ticker}>
                    <td>{p.ticker}</td>
                    <td>{fmt(p.shares, 0)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={estimates[p.ticker] || ''}
                        onChange={(e) => setDividendEstimate(p.ticker, Number(e.target.value))}
                        style={{ width: 80 }}
                      />
                    </td>
                    <td>{fmtMoney((estimates[p.ticker] || 0) * p.shares, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Total projected</td><td className="pill-buy">{fmtMoney(totalProjected, currency)}</td></tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
