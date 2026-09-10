import type { CreditCard, CreditCardTransaction } from '../../types/creditCard';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Same UTC-only, pure-integer-arithmetic discipline as
 * `emiModule.ts`'s `installmentDueDate()` (see that function's own doc
 * comment for the exact local/UTC Date-mixing bug this avoids) — a real
 * calendar date is built from year/month0/day without ever round-tripping
 * through a local-timezone `Date` method. Clamps `day` to the target
 * month's real length (day 31 in February lands on the 28th/29th). */
function cutoffDate(year: number, month0: number, day: number): string {
  const clamped = Math.min(day, daysInMonth(year, month0));
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

/** The most recent statement-cutoff date on or before `asOfDate` — the
 * close of the most recently completed billing cycle. `null` when the
 * card has no `statementDate` set at all (nothing to compute a cycle
 * from yet). */
function mostRecentCutoff(card: CreditCard, asOfDate: string): string | null {
  if (!card.statementDate) return null;
  const [y, m1] = asOfDate.split('-').map(Number);
  const thisMonthCutoff = cutoffDate(y, m1 - 1, card.statementDate);
  if (thisMonthCutoff <= asOfDate) return thisMonthCutoff;
  // This month's cutoff hasn't happened yet — the most recent one is last month's.
  const prevMonth0raw = m1 - 1 - 1;
  const prevYear = y + Math.floor(prevMonth0raw / 12);
  const prevMonth0 = ((prevMonth0raw % 12) + 12) % 12;
  return cutoffDate(prevYear, prevMonth0, card.statementDate);
}

/** The cutoff one full cycle before `cutoff` — found by stepping back one
 * calendar day (still pure UTC integer arithmetic, never a local-timezone
 * method) and asking `mostRecentCutoff` for whichever cutoff that lands
 * on or before. Always resolves to a real calendar date once `cutoff`
 * itself did (this is pure date math, with no notion of "the card didn't
 * exist yet") — a card with no real transaction history that far back
 * simply gets a `previousBalance` of 0 from `balanceAsOf`, rather than
 * this function trying to detect "the first cycle" itself. */
function oneCutoffBack(card: CreditCard, cutoff: string): string {
  const [y, m1, d] = cutoff.split('-').map(Number);
  const asUtcDays = Math.floor(Date.UTC(y, m1 - 1, d) / 86400000) - 1;
  const dayBefore = new Date(asUtcDays * 86400000);
  const dayBeforeStr = `${dayBefore.getUTCFullYear()}-${String(dayBefore.getUTCMonth() + 1).padStart(2, '0')}-${String(dayBefore.getUTCDate()).padStart(2, '0')}`;
  // Non-null assertion is safe: `mostRecentCutoff` only returns null when
  // `card.statementDate` is unset, and `cutoff` (our caller) only exists
  // because that was already set.
  return mostRecentCutoff(card, dayBeforeStr)!;
}

/** A statement's own due date, resolved relative to `statementDate`: the
 * SAME month as the cutoff when `paymentDueDate >= statementDate` (the
 * common case — a real gap within one month), the month AFTER otherwise
 * (a due date that rolls into the next billing month). `null` when
 * `paymentDueDate` isn't set. */
function dueDateForCutoff(card: CreditCard, cutoff: string): string | null {
  if (!card.paymentDueDate) return null;
  const [y, m1] = cutoff.split('-').map(Number);
  const sameMonth = card.paymentDueDate >= (card.statementDate ?? card.paymentDueDate);
  if (sameMonth) return cutoffDate(y, m1 - 1, card.paymentDueDate);
  const nextMonth0raw = m1; // (m1 - 1) + 1
  const nextYear = y + Math.floor(nextMonth0raw / 12);
  const nextMonth0 = ((nextMonth0raw % 12) + 12) % 12;
  return cutoffDate(nextYear, nextMonth0, card.paymentDueDate);
}

/** This card's real running balance as of (and including) `asOfDate` — the
 * one place `outstandingBalanceByCard` and `currentStatement` both derive
 * from, so they can never drift apart. A payment reduces it, everything
 * else (charge/fee/markup/cashAdvance) increases it. */
function balanceAsOf(cardTransactions: CreditCardTransaction[], asOfDate: string): number {
  return cardTransactions
    .filter((t) => t.date <= asOfDate)
    .reduce((sum, t) => sum + (t.kind === 'payment' ? -t.amount : t.amount), 0);
}

/** The card's real, current outstanding balance — always up to date,
 * regardless of billing cycle. `Σ(charge+fee+markup+cashAdvance) −
 * Σ(payment)`. */
export function outstandingBalanceByCard(card: CreditCard, transactions: CreditCardTransaction[]): number {
  return balanceAsOf(transactions.filter((t) => t.cardId === card.id), '9999-12-31');
}

export interface CreditCardStatement {
  /** Exclusive lower bound of this cycle's own transactions — always a
   * real calendar date (see `oneCutoffBack`'s own doc comment); a card
   * with no real history that far back just gets a `previousBalance` of
   * 0, rather than this being `null`. */
  cycleStart: string;
  /** Inclusive upper bound — the cutoff this statement was generated at. */
  cycleEnd: string;
  previousBalance: number;
  chargesThisCycle: number;
  paymentsThisCycle: number;
  /** The user's own "100% amount to be charged this month" — the real
   * bill: `previousBalance + chargesThisCycle − paymentsThisCycle`. */
  statementBalance: number;
  minimumDue: number;
  dueDate: string | null;
}

/** The user's own "save bill cut-off date - the 100% amount to be charged
 * this month, min amount & date, due bill and date" requirement, computed
 * (not eyeballed off a running total). Splits this card's transactions at
 * the two most recent `statementDate` cutoffs bracketing `asOfDate`.
 * Returns `null` only when the card has no `statementDate` set at all. */
export function currentStatement(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
): CreditCardStatement | null {
  const cycleEnd = mostRecentCutoff(card, asOfDate);
  if (!cycleEnd) return null;
  const cycleStart = oneCutoffBack(card, cycleEnd);
  const cardTxs = transactions.filter((t) => t.cardId === card.id);
  const previousBalance = balanceAsOf(cardTxs, cycleStart);
  const cycleTxs = cardTxs.filter((t) => t.date > cycleStart && t.date <= cycleEnd);
  const chargesThisCycle = round2(cycleTxs.filter((t) => t.kind !== 'payment').reduce((s, t) => s + t.amount, 0));
  const paymentsThisCycle = round2(cycleTxs.filter((t) => t.kind === 'payment').reduce((s, t) => s + t.amount, 0));
  const statementBalance = round2(previousBalance + chargesThisCycle - paymentsThisCycle);
  return {
    cycleStart,
    cycleEnd,
    previousBalance: round2(previousBalance),
    chargesThisCycle,
    paymentsThisCycle,
    statementBalance,
    minimumDue: computeMinimumDue(card, statementBalance),
    dueDate: dueDateForCutoff(card, cycleEnd),
  };
}

/** Research: real minimum-payment formulas vary by issuer (a flat %, a
 * flat floor, or "floor OR %, whichever is greater"). Never exceeds the
 * statement balance itself (a tiny statement shouldn't demand a minimum
 * bigger than the whole bill). */
export function computeMinimumDue(card: CreditCard, statementBalance: number): number {
  if (statementBalance <= 0) return 0;
  const method = card.minPaymentMethod ?? 'fixed';
  const fixed = card.minPaymentAmount ?? 0;
  const pct = ((card.minPaymentPct ?? 0) / 100) * statementBalance;
  const due = method === 'percentOfBalance' ? pct : method === 'greaterOfFixedOrPercent' ? Math.max(fixed, pct) : fixed;
  return round2(Math.min(due, statementBalance));
}

/** Research: grace period is conditional, not unconditional — a card only
 * waives markup on NEW purchases if the PRIOR balance was paid off; once
 * any of it survives into this cycle, the flat-rate formula (and its
 * threshold exemption) applies to exactly that carried amount. Payments
 * are assumed to retire the oldest (prior-cycle) balance first — the same
 * simplification Rentals' `pendingRentBalance`/`nextPendingBalance`
 * already uses for a carried-forward shortfall. `markupMethod` other than
 * `'flatOnCarried'` (none implemented in v1) always returns 0. */
export function markupThisCycle(card: CreditCard, statement: CreditCardStatement): number {
  if (card.markupMethod !== 'flatOnCarried' || !card.markupRatePct) return 0;
  const unpaidFromPrior = Math.max(0, round2(statement.previousBalance - statement.paymentsThisCycle));
  if (unpaidFromPrior <= 0) return 0; // grace period held — nothing carried, no markup.
  const threshold = card.markupThresholdAmount ?? 0;
  if (unpaidFromPrior < threshold) return 0;
  return round2(unpaidFromPrior * (card.markupRatePct / 100));
}

export interface MinPaymentProposal {
  dueDate: string;
  /** `statement.minimumDue` plus any carried-forward `pendingMinDue` — a
   * partial attempt last cycle rolls its shortfall into this one. */
  amount: number;
  /** True once `dueDate` has arrived (today or earlier). */
  isDue: boolean;
}

/** Semi-automated minimum-payment collection (mirrors Rentals'
 * `proposeRentCollection` exactly — same "propose, never silently apply"
 * shape) — this app has no real bank-API access and can never actually
 * pull money on its own. `null` when there's no statement due date or
 * nothing owed at all. */
export function proposeMinPayment(card: CreditCard, statement: CreditCardStatement): MinPaymentProposal | null {
  if (!statement.dueDate) return null;
  const amount = round2(statement.minimumDue + (card.pendingMinDue ?? 0));
  if (amount <= 0) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  return { dueDate: statement.dueDate, amount, isDue: statement.dueDate <= todayStr };
}

/** After logging a payment of `amountPaid` against a proposal that
 * expected `expectedAmount`, this is the new `pendingMinDue` to carry into
 * the next proposal — never negative (an overpayment just clears the
 * balance rather than tracking a credit), same convention as Rentals'
 * `nextPendingBalance`. */
export function nextPendingMinDue(expectedAmount: number, amountPaid: number): number {
  return Math.max(0, round2(expectedAmount - amountPaid));
}

/** How much is owed across every credit card, grouped by currency —
 * always a POSITIVE "amount owed" figure, same convention as
 * `bankModule.ts`'s `creditCardLiabilityByCurrency` (which this
 * supersedes for any card that's been migrated off the old
 * `BankAccount.isLiability` model — see `BankAccount.migratedToCreditCardId`'s
 * own doc comment for why both sources still need to be merged at the
 * call site during the transition). Respects `includeInNetWorth`, same
 * opt-out mechanism as every other entity type (Done item 231). */
export function creditCardLiabilityByCurrency(cards: CreditCard[], transactions: CreditCardTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  cards
    .filter((c) => c.includeInNetWorth !== false)
    .forEach((c) => {
      const owed = Math.max(0, outstandingBalanceByCard(c, transactions));
      if (owed > 0) out[c.currencyCode] = round2((out[c.currencyCode] || 0) + owed);
    });
  return out;
}

/** For the progress-bar/"X available of Y limit" display. 0 when the card
 * has no credit limit set. */
export function availableCredit(card: CreditCard, balance: number): number {
  if (!card.creditLimit) return 0;
  return Math.max(0, round2(card.creditLimit - Math.max(0, balance)));
}
