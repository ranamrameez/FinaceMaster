import { useState } from 'react';
import { TextInput } from './Field';
import type { FIFOLot } from '../../lib/calc/fifoPositions';
import { fmt, fmtPrice } from '../../lib/format';

export type LotAllocations = { buyId: string; shares: number }[];

/** Manual multi-lot Specific Identification for a SELL — the UI half of
 * `Transaction.lotAllocations` (see that field's own doc comment in
 * `types/workbook.ts` for the full priority order: `lotAllocations` beats
 * `targetLotBuyId` beats the workbook's default match order). Built per
 * README Pending item 143, closed 2026-09-19 — the engine has supported
 * this since PR #213; this is the first UI wiring of it.
 *
 * Collapsed by default (a plain "Specify exact lots" button) so it stays
 * completely inert for the common case — most sells don't need this, and a
 * SELL under `costBasisMethod: 'average'` ignores it entirely (that method
 * never reads any lot-targeting field at all). Once expanded, one row per
 * currently-open lot lets the user type an exact share count; whatever's
 * left unallocated is explicitly labeled as falling back to the default
 * match order, never silently guessed at. */
export function LotAllocationFields({
  lots,
  totalShares,
  value,
  onChange,
}: {
  /** Open lots for this ticker, computed as if THIS sell hadn't happened
   * yet (i.e. from every other transaction) — see the two call sites
   * (`TransactionsPage.tsx`/`StockPage.tsx`) for how each derives this. */
  lots: FIFOLot[];
  totalShares: number;
  value: LotAllocations | undefined;
  onChange: (next: LotAllocations | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(!!value?.length);
  const usableLots = lots.filter((l) => l.buyId && l.remainingShares > 0);

  if (!usableLots.length || totalShares <= 0) return null;

  const byBuyId = new Map((value || []).map((a) => [a.buyId, a.shares]));
  const allocatedTotal = (value || []).reduce((s, a) => s + a.shares, 0);
  const remainder = totalShares - allocatedTotal;

  const setLotShares = (buyId: string, shares: number) => {
    const next = (value || []).filter((a) => a.buyId !== buyId);
    if (shares > 0) next.push({ buyId, shares });
    onChange(next.length ? next : undefined);
  };

  if (!expanded) {
    return (
      <button type="button" className="btn secondary small mt-sm" onClick={() => setExpanded(true)}>
        Specify exact lots (optional)
      </button>
    );
  }

  return (
    <div className="card mt-sm" style={{ padding: 10 }}>
      <div className="row gap-sm mb-sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>Which lots is this sale coming from?</strong>
        <button type="button" className="btn secondary small" onClick={() => { onChange(undefined); setExpanded(false); }}>
          Use default (auto)
        </button>
      </div>
      <p className="text-muted" style={{ marginTop: 0, fontSize: 12 }}>
        Enter exactly how many shares came from each lot below. Anything you leave unallocated
        ({fmt(Math.max(remainder, 0), 0)} of {fmt(totalShares, 0)} shares) falls back to your Settings' default
        match order — it is never guessed lot by lot.
      </p>
      {usableLots.map((lot) => (
        <div key={lot.buyId} className="row gap-sm mb-sm" style={{ alignItems: 'center' }}>
          <span style={{ minWidth: 220 }}>
            {lot.buyDate} @ {fmtPrice(lot.buyPrice)} — {fmt(lot.remainingShares, 0)} open
          </span>
          <TextInput
            type="number"
            min={0}
            max={lot.remainingShares}
            value={byBuyId.get(lot.buyId!) ?? ''}
            placeholder="0"
            onChange={(e) => setLotShares(lot.buyId!, Math.min(Number(e.target.value) || 0, lot.remainingShares))}
            className="w-90"
          />
        </div>
      ))}
      {remainder < 0 && (
        <p className="text-loss" style={{ fontSize: 12, marginBottom: 0 }}>
          You've allocated more shares ({fmt(allocatedTotal, 0)}) than this sale's total ({fmt(totalShares, 0)}) —
          reduce one of the lots above.
        </p>
      )}
    </div>
  );
}
