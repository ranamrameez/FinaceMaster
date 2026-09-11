import { describe, expect, it } from 'vitest';
import type { CreditCard, CreditCardTransaction } from '../../../types/creditCard';
import {
  availableCredit,
  computeMinimumDue,
  creditCardLiabilityByCurrency,
  currentStatement,
  markupThisCycle,
  nextPendingMinDue,
  outstandingBalanceByCard,
  proposeMinPayment,
} from '../creditCardModule';

const card = (over: Partial<CreditCard> = {}): CreditCard => ({
  id: 'c1',
  name: 'Sharia Card',
  currencyCode: 'QAR',
  statementDate: 5,
  paymentDueDate: 25,
  ...over,
});

const tx = (over: Partial<CreditCardTransaction>): CreditCardTransaction => ({
  id: crypto.randomUUID(),
  cardId: 'c1',
  date: '2026-01-01',
  kind: 'charge',
  amount: 0,
  description: '',
  ...over,
});

describe('outstandingBalanceByCard', () => {
  it('charges increase, payments decrease the balance', () => {
    const txs = [tx({ kind: 'charge', amount: 500, date: '2026-01-10' }), tx({ kind: 'payment', amount: 200, date: '2026-01-15' })];
    expect(outstandingBalanceByCard(card(), txs)).toBe(300);
  });

  it('fee/markup/cashAdvance all increase the balance like a charge', () => {
    const txs = [
      tx({ kind: 'fee', amount: 50, date: '2026-01-05' }),
      tx({ kind: 'markup', amount: 10, date: '2026-01-06' }),
      tx({ kind: 'cashAdvance', amount: 100, date: '2026-01-07' }),
    ];
    expect(outstandingBalanceByCard(card(), txs)).toBe(160);
  });

  // Real bug (user-reported, 2026-09-11): migrating a legacy liability
  // BankAccount into a real CreditCard dropped its `openingBalance`
  // entirely, since `CreditCard` had no equivalent field — a card with
  // real pre-app debt silently lost it. Confirmed against the user's own
  // real numbers: GCC's old account had `openingBalance: -7553.11`
  // (negative = owed, BankAccount's convention) and a post-migration
  // `accountBalance` of -705.89 (i.e. really owed 705.89) — the migrated-
  // transactions-only balance (opposite sign, CreditCard's convention)
  // came out to exactly -6847.22 without this field, when the real
  // correct figure is +705.89 owed.
  it('includes card.openingBalance (positive = owed) in the running balance', () => {
    const txs = [tx({ kind: 'charge', amount: 500, date: '2026-01-10' }), tx({ kind: 'payment', amount: 200, date: '2026-01-15' })];
    expect(outstandingBalanceByCard(card({ openingBalance: 1000 }), txs)).toBe(1300);
    expect(outstandingBalanceByCard(card({ openingBalance: -1000 }), txs)).toBe(-700);
  });
});

describe('currentStatement', () => {
  it('returns null when the card has no statementDate set', () => {
    expect(currentStatement(card({ statementDate: undefined }), [], '2026-02-10')).toBeNull();
  });

  it('splits at the two most recent statementDate cutoffs bracketing asOfDate', () => {
    // Cutoffs on the 5th: Dec 5 -> Jan 5 -> Feb 5. asOfDate 2026-02-10 is
    // past Feb 5, so the closed cycle is (Jan 5, Feb 5].
    const txs = [
      tx({ date: '2025-12-20', kind: 'charge', amount: 1000 }), // prior cycle (Dec5,Jan5]
      tx({ date: '2026-01-10', kind: 'charge', amount: 300 }), // this cycle
      tx({ date: '2026-01-20', kind: 'payment', amount: 400 }), // this cycle
      tx({ date: '2026-02-06', kind: 'charge', amount: 999 }), // future cycle — excluded
    ];
    const s = currentStatement(card(), txs, '2026-02-10');
    expect(s).not.toBeNull();
    expect(s!.cycleStart).toBe('2026-01-05');
    expect(s!.cycleEnd).toBe('2026-02-05');
    expect(s!.previousBalance).toBe(1000);
    expect(s!.chargesThisCycle).toBe(300);
    expect(s!.paymentsThisCycle).toBe(400);
    expect(s!.statementBalance).toBe(900); // 1000 + 300 - 400
    expect(s!.dueDate).toBe('2026-02-25'); // same month, since 25 >= 5
  });

  it('carries card.openingBalance into previousBalance and statementBalance', () => {
    const txs = [tx({ date: '2026-01-10', kind: 'charge', amount: 300 }), tx({ date: '2026-01-20', kind: 'payment', amount: 400 })];
    const s = currentStatement(card({ openingBalance: 1000 }), txs, '2026-02-10');
    expect(s!.previousBalance).toBe(1000); // no prior-cycle txs, so this IS the opening balance
    expect(s!.statementBalance).toBe(900); // 1000 + 300 - 400
  });

  it('due date rolls into the following month when paymentDueDate < statementDate', () => {
    const s = currentStatement(card({ statementDate: 28, paymentDueDate: 10 }), [], '2026-03-01');
    // Most recent cutoff <= 2026-03-01 with statementDate=28 is 2026-02-28.
    expect(s!.cycleEnd).toBe('2026-02-28');
    expect(s!.dueDate).toBe('2026-03-10');
  });

  it('clamps a statementDate past a short month to its real last day', () => {
    const s = currentStatement(card({ statementDate: 31 }), [], '2026-03-01');
    expect(s!.cycleEnd).toBe('2026-02-28');
  });

  it('has previousBalance 0 for the very first statement (no real history that far back)', () => {
    const s = currentStatement(card(), [tx({ date: '2026-01-03', kind: 'charge', amount: 50 })], '2026-01-20');
    expect(s!.previousBalance).toBe(0);
    expect(s!.statementBalance).toBe(50);
  });
});

describe('computeMinimumDue', () => {
  it('fixed method uses the floor, capped at the statement balance', () => {
    expect(computeMinimumDue(card({ minPaymentMethod: 'fixed', minPaymentAmount: 40 }), 500)).toBe(40);
    expect(computeMinimumDue(card({ minPaymentMethod: 'fixed', minPaymentAmount: 40 }), 10)).toBe(10);
  });

  it('percentOfBalance computes a % of the statement balance', () => {
    expect(computeMinimumDue(card({ minPaymentMethod: 'percentOfBalance', minPaymentPct: 2 }), 1000)).toBe(20);
  });

  it('greaterOfFixedOrPercent picks whichever is larger (Chase\'s own published shape)', () => {
    const c = card({ minPaymentMethod: 'greaterOfFixedOrPercent', minPaymentAmount: 40, minPaymentPct: 1 });
    expect(computeMinimumDue(c, 1000)).toBe(40); // 1% of 1000 = 10, floor 40 wins
    expect(computeMinimumDue(c, 10000)).toBe(100); // 1% of 10000 = 100, wins over the 40 floor
  });

  it('is 0 for a zero or negative balance', () => {
    expect(computeMinimumDue(card({ minPaymentAmount: 40 }), 0)).toBe(0);
    expect(computeMinimumDue(card({ minPaymentAmount: 40 }), -5)).toBe(0);
  });
});

describe('markupThisCycle — the grace-period gate + flat-rate-on-carried-balance model', () => {
  const flat = (over: Partial<CreditCard> = {}) => card({ markupMethod: 'flatOnCarried', markupRatePct: 1, markupThresholdAmount: 100, ...over });

  // With statementDate=5, asOfDate 2026-01-06 gives cycleStart=2025-12-05/
  // cycleEnd=2026-01-05 — a charge dated on/before Dec 5 lands in
  // `previousBalance`; a transaction dated in (Dec 5, Jan 5] lands in
  // "this cycle".
  it('is 0 when the prior balance is fully paid off this cycle (grace period holds)', () => {
    const s = currentStatement(flat(), [tx({ date: '2025-11-20', kind: 'charge', amount: 500 }), tx({ date: '2025-12-10', kind: 'payment', amount: 500 })], '2026-01-06');
    expect(markupThisCycle(flat(), s!)).toBe(0);
  });

  it("charges the user's own real example: 1% on an unsettled amount >= 100", () => {
    // 500 carried in, only 100 paid this cycle -> 400 unpaid, >= threshold.
    const s = currentStatement(flat(), [tx({ date: '2025-11-20', kind: 'charge', amount: 500 }), tx({ date: '2025-12-10', kind: 'payment', amount: 100 })], '2026-01-06');
    expect(s!.previousBalance).toBe(500);
    expect(markupThisCycle(flat(), s!)).toBe(4); // 1% of 400
  });

  it('is 0 below the threshold even with an unpaid amount', () => {
    const s = currentStatement(flat(), [tx({ date: '2025-11-20', kind: 'charge', amount: 50 })], '2026-01-06');
    expect(s!.previousBalance).toBe(50);
    expect(markupThisCycle(flat(), s!)).toBe(0); // 50 < 100 threshold
  });

  it('is always 0 when markupMethod is unset (no interest concept at all)', () => {
    const s = currentStatement(card(), [tx({ date: '2025-11-20', kind: 'charge', amount: 500 })], '2026-01-06');
    expect(markupThisCycle(card(), s!)).toBe(0);
  });
});

describe('proposeMinPayment / nextPendingMinDue', () => {
  it('proposes the statement minimum plus any carried-forward pendingMinDue', () => {
    const c = card({ minPaymentMethod: 'fixed', minPaymentAmount: 40, pendingMinDue: 15 });
    const s = currentStatement(c, [tx({ date: '2025-12-10', kind: 'charge', amount: 500 })], '2026-01-06')!;
    const proposal = proposeMinPayment(c, s);
    expect(proposal!.amount).toBe(55); // 40 + 15
    expect(proposal!.dueDate).toBe('2026-01-25');
  });

  it('returns null when nothing is owed', () => {
    const s = currentStatement(card(), [], '2026-01-06')!;
    expect(proposeMinPayment(card(), s)).toBeNull();
  });

  it('carries forward exactly the shortfall of a partial payment, never negative', () => {
    expect(nextPendingMinDue(55, 30)).toBe(25);
    expect(nextPendingMinDue(55, 100)).toBe(0); // overpayment clears, doesn't credit
  });
});

describe('creditCardLiabilityByCurrency', () => {
  it('sums owed balances per currency, excluding a card in credit', () => {
    const cards = [card({ id: 'c1', currencyCode: 'QAR' }), card({ id: 'c2', currencyCode: 'PKR' })];
    const txs = [
      tx({ cardId: 'c1', kind: 'charge', amount: 300 }),
      tx({ cardId: 'c2', kind: 'payment', amount: 50 }), // in credit — contributes nothing
    ];
    expect(creditCardLiabilityByCurrency(cards, txs)).toEqual({ QAR: 300 });
  });

  it('respects includeInNetWorth, excluding an opted-out card entirely', () => {
    const cards = [card({ includeInNetWorth: false })];
    const txs = [tx({ kind: 'charge', amount: 300 })];
    expect(creditCardLiabilityByCurrency(cards, txs)).toEqual({});
  });
});

describe('availableCredit', () => {
  it('is the limit minus whatever is owed, never negative', () => {
    expect(availableCredit(card({ creditLimit: 1000 }), 300)).toBe(700);
    expect(availableCredit(card({ creditLimit: 1000 }), 1500)).toBe(0);
  });

  it('is 0 with no credit limit set', () => {
    expect(availableCredit(card(), 300)).toBe(0);
  });
});
