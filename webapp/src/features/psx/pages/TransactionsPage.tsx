import { Fragment, useMemo, useState } from 'react';
import { PSX_TICKER_DATALIST_ID } from '../../../components/PSXTickerDatalist';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { PlusIcon, SaveIcon, TrashIcon } from '../../../components/icons';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { confirmAndDeleteLinkable } from '../../../lib/linkCascade';
import { isNettedLeg } from '../../../lib/calc/psxFees';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { createEmptyPSXWorkbook } from '../../../store/defaultPsxWorkbook';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { Adjustment, Transaction, Transfer } from '../../../types/workbook';
import { DividendsSection } from '../components/DividendsSection';
import { usePSXDerived } from '../hooks/usePSXDerived';

const today = () => new Date().toISOString().slice(0, 10);

function emptyRow(): Transaction {
  return { date: today(), ticker: '', action: 'BUY', shares: 0, price: 0 };
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
          <input type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
          <input
            placeholder="Ticker"
            value={r.ticker}
            onChange={(e) => update(i, { ticker: e.target.value.toUpperCase() })}
            list={PSX_TICKER_DATALIST_ID}
            style={{ width: 80 }}
          />
          <select value={r.action} onChange={(e) => update(i, { action: e.target.value as 'BUY' | 'SELL' })}>
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
          <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Force netted (government levies only) fee treatment for this leg, overriding auto-detection — use when your statement shows a same-day round trip that the recorded date doesn't line up with.">
            <input
              type="checkbox"
              checked={!!r.manualSameDay}
              onChange={(e) => update(i, { manualSameDay: e.target.checked })}
            />
            Same-day override
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="Fee override"
            title="Override the computed fee with the exact amount from your account statement (optional)."
            value={r.feeOverride ?? ''}
            onChange={(e) => update(i, { feeOverride: e.target.value === '' ? undefined : Number(e.target.value) })}
            style={{ width: 100 }}
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
      <p className="footer-note" style={{ marginTop: 8 }}>
        Same-day round trips are detected automatically: if you buy and sell the same ticker on the
        same date, the smaller side is charged government levies only (no double commission) — see
        each transaction's Fee column in the list below. If your account statement shows a same-day
        netting that the recorded date doesn't line up with, check "Same-day override" to force it.
        Leave "Fee override" blank to use the computed fee, or fill it in to match your statement exactly.
      </p>
    </div>
  );
}

function TransferForm() {
  const addTransfer = usePSXWorkbookStore((s) => s.addTransfer);
  const depositFee = usePSXWorkbookStore((s) => s.workbook.settings.depositFee);
  const ensureSignedIn = useEnsureSignedIn();
  const [t, setT] = useState<Omit<Transfer, 'id'>>({ date: today(), type: 'DEPOSIT', gross: 0, fee: depositFee });

  return (
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
      <input
        type="number"
        placeholder="Fee"
        value={t.fee || ''}
        onChange={(e) => setT({ ...t, fee: Number(e.target.value) })}
        style={{ width: 80 }}
      />
      <button
        className="btn"
        onClick={async () => {
          if (t.gross <= 0) return toast('Enter an amount.');
          if (!(await ensureSignedIn('Sign in to save transfers.'))) return;
          addTransfer({ ...t, id: crypto.randomUUID() });
          toast('Transfer added.');
          setT({ date: today(), type: 'DEPOSIT', gross: 0, fee: depositFee });
        }}
      >
        <PlusIcon />Add
      </button>
    </div>
  );
}

function AdjustmentForm() {
  const addAdjustment = usePSXWorkbookStore((s) => s.addAdjustment);
  const ensureSignedIn = useEnsureSignedIn();
  const [a, setA] = useState<Adjustment>({ date: today(), amount: 0, note: '' });

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
      <button
        className="btn"
        onClick={async () => {
          if (!a.amount) return toast('Enter an amount.');
          if (!(await ensureSignedIn('Sign in to save adjustments.'))) return;
          addAdjustment(a);
          toast('Adjustment added.');
          setA({ date: today(), amount: 0, note: '' });
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
  const { workbook, calcFee } = usePSXDerived();
  const deleteTransaction = usePSXWorkbookStore((s) => s.deleteTransaction);
  const updateTransaction = usePSXWorkbookStore((s) => s.updateTransaction);
  const currency = workbook.settings.currency;

  const [filterTicker, setFilterTicker] = useState('ALL');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Transaction | null>(null);

  const indexed = workbook.transactions.map((tx, i) => ({ tx, i }));
  const tickers = useMemo(() => [...new Set(workbook.transactions.map((t) => t.ticker))].sort(), [workbook.transactions]);

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

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', rows: sorted }];
    const map: Record<string, typeof sorted> = {};
    sorted.forEach((r) => {
      const k = groupKey(r.tx, groupBy);
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, rows]) => ({ key, rows }));
  }, [sorted, groupBy]);

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
        <button className="btn secondary" onClick={exportJSON}>Export JSON</button>
        <button className="btn secondary" onClick={clearAll}><TrashIcon size={12} />Clear all</button>
      </div>

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
              <th>Fee</th>
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
                        <label className="footer-note" style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Force netted (government levies only) fee treatment, overriding auto-detection.">
                          <input
                            type="checkbox"
                            checked={!!editRow.manualSameDay}
                            onChange={(e) => setEditRow({ ...editRow, manualSameDay: e.target.checked })}
                          />
                          Same-day
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Fee override"
                          title="Override the computed fee with the exact amount from your account statement (optional)."
                          value={editRow.feeOverride ?? ''}
                          onChange={(e) => setEditRow({ ...editRow, feeOverride: e.target.value === '' ? undefined : Number(e.target.value) })}
                          style={{ width: 100, marginTop: 4 }}
                        />
                      </td>
                      <td>
                        <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                        <button className="btn secondary small" onClick={() => setEditIndex(null)}>Cancel</button>
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
                          <span className="footer-note" title="This fee was manually entered, overriding the computed value.">
                            {' '}(override)
                          </span>
                        ) : (
                          isNettedLeg(workbook.transactions, tx) && (
                            <span
                              className="footer-note"
                              title={tx.manualSameDay ? 'Manually marked as a same-day netted leg — government levies only.' : 'Same-day round trip — netted, government levies only.'}
                            >
                              {' '}(netted{tx.manualSameDay ? ', manual' : ''})
                            </span>
                          )
                        )}
                      </td>
                      <td>
                        <button className="btn secondary small" onClick={() => startEdit(i, tx)}>Edit</button>{' '}
                        <button
                          className="btn secondary small"
                          onClick={async () => {
                            if (await confirmDialog('This cannot be undone.', `Delete ${tx.action} ${tx.shares} ${tx.ticker}?`)) deleteTransaction(i);
                          }}
                        >
                          <TrashIcon size={12} />Delete
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </Fragment>
            ))}
            {!sorted.length && (
              <tr><td colSpan={8} className="footer-note">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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

  type TransferCol = 'date' | 'type' | 'gross' | 'fee';
  const sortValue = (t: Transfer, col: TransferCol): number | string => {
    switch (col) {
      case 'type': return t.type;
      case 'gross': return t.gross;
      case 'fee': return t.fee;
      default: return t.date;
    }
  };
  const { sorted, Th } = useSortableRows(workbook.transfers, sortValue, 'date', 'desc');

  const startEdit = (t: Transfer) => { setEditId(t.id); setEditRow({ ...t }); };
  const saveEdit = () => {
    if (editId === null || !editRow) return;
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
                  <td>
                    <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.type}</td>
                  <td>{fmtMoney(t.gross, currency)}</td>
                  <td>{fmtMoney(t.fee, currency)}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => startEdit(t)}>Edit</button>{' '}
                    <button className="btn secondary small" onClick={() => confirmAndDeleteLinkable('psx', t.id, () => deleteTransfer(t.id))}><TrashIcon size={12} />Delete</button>
                  </td>
                </tr>
              ),
            )}
            {!sorted.length && <tr><td colSpan={5} className="footer-note">No transfers yet.</td></tr>}
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
                    <button className="btn secondary small" onClick={saveEdit}><SaveIcon size={12} />Save</button>{' '}
                    <button className="btn secondary small" onClick={() => setEditIndex(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td>{a.date}</td>
                  <td>{fmtMoney(a.amount, currency)}</td>
                  <td>{a.note}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => startEdit(i, a)}>Edit</button>{' '}
                    <button className="btn secondary small" onClick={() => deleteAdjustment(i)}><TrashIcon size={12} />Delete</button>
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
      <h1 className="pagetitle">PSX Transactions</h1>
      <Tabs
        tabs={[
          { key: 'add', label: 'Add transaction(s)', content: <TransactionRows /> },
          { key: 'list', label: 'Transaction list', content: <TransactionList /> },
          { key: 'transfers', label: 'Cash transfers', content: <TransfersSection /> },
          { key: 'adjustments', label: 'Rewards & adjustments', content: <AdjustmentsSection /> },
          { key: 'ledger', label: 'Cash ledger', content: <CashLedgerSection /> },
          { key: 'dividends', label: 'Dividends', content: <DividendsSection /> },
        ]}
      />
    </div>
  );
}
