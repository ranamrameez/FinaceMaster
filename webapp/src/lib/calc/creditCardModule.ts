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

/** The cutoff one full cycle AFTER `cutoff` — the boundary the CURRENTLY
 * OPEN cycle will close on. `cutoff` is always a real calendar date whose
 * own day-of-month is `card.statementDate` (every caller only ever passes
 * a value that came from `mostRecentCutoff`/this function itself), so
 * stepping to the next calendar month and re-applying the same
 * day-of-month (with the same short-month clamp `cutoffDate` already
 * does) is safe pure integer arithmetic — no local/UTC `Date`-mixing. */
function oneCutoffForward(card: CreditCard, cutoff: string): string {
  const [y, m1] = cutoff.split('-').map(Number);
  const nextMonth0raw = m1; // (m1 - 1) + 1
  const nextYear = y + Math.floor(nextMonth0raw / 12);
  const nextMonth0 = ((nextMonth0raw % 12) + 12) % 12;
  return cutoffDate(nextYear, nextMonth0, card.statementDate!);
}

/** A due date resolved relative to `cycleEnd`: the SAME month as the
 * cycle's own close when `day >= statementDate` (the common case — a real
 * gap within one month), the month AFTER otherwise (a due date that rolls
 * into the next billing month). `null` when `day` isn't set. Shared by
 * both the minimum-due date and the full-amount-due date — see
 * `CreditCard.minDueDate`'s own doc comment for why they're two separate
 * fields now, not one. */
function dueDateForDay(card: CreditCard, cycleEnd: string, day: number | undefined): string | null {
  if (!day) return null;
  const [y, m1] = cycleEnd.split('-').map(Number);
  const sameMonth = day >= (card.statementDate ?? day);
  if (sameMonth) return cutoffDate(y, m1 - 1, day);
  const nextMonth0raw = m1; // (m1 - 1) + 1
  const nextYear = y + Math.floor(nextMonth0raw / 12);
  const nextMonth0 = ((nextMonth0raw % 12) + 12) % 12;
  return cutoffDate(nextYear, nextMonth0, day);
}

/** This card's real running balance as of (and including) `asOfDate` — the
 * one place `outstandingBalanceByCard` and `currentStatement` both derive
 * from, so they can never drift apart. Starts from `card.openingBalance`
 * (debt that predates this card's own transaction log — see that field's
 * own doc comment; omitting it here was a real bug, see README Done item
 * "Credit Card: openingBalance"). A payment reduces it, everything else
 * (charge/fee/markup/cashAdvance) increases it. */
function balanceAsOf(card: CreditCard, cardTransactions: CreditCardTransaction[], asOfDate: string): number {
  return cardTransactions
    .filter((t) => t.date <= asOfDate)
    .reduce((sum, t) => sum + (t.kind === 'payment' ? -t.amount : t.amount), card.openingBalance ?? 0);
}

/** The card's real, current outstanding balance — always up to date,
 * regardless of billing cycle. `openingBalance + Σ(charge+fee+markup+
 * cashAdvance) − Σ(payment)`. */
export function outstandingBalanceByCard(card: CreditCard, transactions: CreditCardTransaction[]): number {
  return balanceAsOf(card, transactions.filter((t) => t.cardId === card.id), '9999-12-31');
}

export interface CreditCardStatement {
  /** Exclusive lower bound of THIS CYCLE — the one containing `asOfDate`,
   * whether or not it has actually closed yet (see `currentStatement`'s
   * own doc comment for the real bug this fixes: this used to be the
   * LAST COMPLETED cycle, one billing period behind what a user checking
   * mid-cycle actually expects). Always a real calendar date (see
   * `oneCutoffBack`'s own doc comment); a card with no real history that
   * far back just gets a `previousBalance` of 0, rather than this being
   * `null`. */
  cycleStart: string;
  /** Inclusive upper bound — the cutoff THIS cycle will close on. Often a
   * FUTURE date (mid-cycle) — that's intentional, see `currentStatement`. */
  cycleEnd: string;
  /** The balance carried INTO this cycle from before `cycleStart` — used
   * internally by `markupThisCycle`'s grace-period check. Not shown
   * directly to the user (their own report: "irrelevant or unexplained")
   * — see `creditCardMonthlyHistory` for the user-facing 6-month view
   * instead. */
  previousBalance: number;
  /** Spent this cycle so far — everything that adds to the balance
   * (charge/fee/markup/cashAdvance). Named `charges` internally for
   * historical reasons; the UI shows this as "Spent," per the user's own
   * "Charges is broad term... use like Spent instead." */
  chargesThisCycle: number;
  paymentsThisCycle: number;
  /** The running total this cycle: `previousBalance + chargesThisCycle −
   * paymentsThisCycle` — while the cycle is still open (the common case,
   * see `currentStatement`), this equals the card's own current
   * outstanding balance; once real activity stops for the cycle, it's
   * the actual bill. */
  statementBalance: number;
  minimumDue: number;
  /** When the MINIMUM payment is due, from `card.minDueDate` — `null`
   * when that field isn't set (falls back to `dueDate` in
   * `proposeMinPayment`, so an older card that only ever set
   * `paymentDueDate` keeps working). */
  minDueDate: string | null;
  /** When the FULL amount is due, from `card.paymentDueDate`. */
  dueDate: string | null;
}

/** The user's own "save bill cut-off date - the 100% amount to be charged
 * this month, min amount & date, due bill and date" requirement, computed
 * (not eyeballed off a running total).
 *
 * User-reported real bug (2026-09-14, with an exact worked example): with
 * `statementDate=17` and `asOfDate='2026-09-14'`, this used to return the
 * LAST COMPLETED cycle (`2026-07-17 → 2026-08-17`, due `2026-09-05` — a
 * date that had ALREADY PASSED relative to `asOfDate`) instead of the
 * cycle actually containing today (`2026-08-17 → 2026-09-17`). Fixed by
 * making `cycleStart` the most recent PAST cutoff and `cycleEnd` the NEXT
 * one forward (`oneCutoffForward`, possibly a future date, mid-cycle) —
 * the cycle a user checking their card RIGHT NOW is actually in, with due
 * dates resolved relative to when it will next close. */
export function currentStatement(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
): CreditCardStatement | null {
  const cycleStart = mostRecentCutoff(card, asOfDate);
  if (!cycleStart) return null;
  const cycleEnd = oneCutoffForward(card, cycleStart);
  const cardTxs = transactions.filter((t) => t.cardId === card.id);
  const previousBalance = balanceAsOf(card, cardTxs, cycleStart);
  const cycleTxs = cardTxs.filter((t) => t.date > cycleStart && t.date <= cycleEnd && t.date <= asOfDate);
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
    minDueDate: dueDateForDay(card, cycleEnd, card.minDueDate),
    dueDate: dueDateForDay(card, cycleEnd, card.paymentDueDate),
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
 * pull money on its own. Uses `statement.minDueDate` (the minimum
 * payment's OWN due date) when the card has one set, falling back to the
 * full-amount `dueDate` for a card that hasn't configured `minDueDate`
 * yet — real bug fix (2026-09-14): this used to always schedule the
 * minimum payment against the FULL amount's due date, which is wrong once
 * a card has its own separate, earlier minimum-due date. `null` when
 * there's no due date to propose against or nothing owed at all. */
export function proposeMinPayment(card: CreditCard, statement: CreditCardStatement): MinPaymentProposal | null {
  const dueDate = statement.minDueDate ?? statement.dueDate;
  if (!dueDate) return null;
  const amount = round2(statement.minimumDue + (card.pendingMinDue ?? 0));
  if (amount <= 0) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  return { dueDate, amount, isDue: dueDate <= todayStr };
}

/** After logging a payment of `amountPaid` against a proposal that
 * expected `expectedAmount`, this is the new `pendingMinDue` to carry into
 * the next proposal — never negative (an overpayment just clears the
 * balance rather than tracking a credit), same convention as Rentals'
 * `nextPendingBalance`. */
export function nextPendingMinDue(expectedAmount: number, amountPaid: number): number {
  return Math.max(0, round2(expectedAmount - amountPaid));
}

export interface CreditCardMonthActivity {
  /** `'YYYY-MM'`. */
  month: string;
  /** Everything that increases the balance (charge/fee/markup/
   * cashAdvance), dated within this CALENDAR month. */
  spent: number;
  /** Payments dated within this calendar month. */
  paid: number;
  /** Running outstanding balance as of the end of this month — or as of
   * `asOfDate` itself, for the current, still-in-progress month. */
  balanceEnd: number;
}

/** The "6 months past" overview the user asked for — "just like
 * currencies on the main dashboard" (Net Worth's own per-currency monthly
 * window, README Done item 229) — a plain CALENDAR-month view,
 * deliberately separate from `currentStatement`'s own BILLING cycle
 * (which rarely aligns with a calendar month): the user wants both a
 * cross-app-consistent calendar-month read and the card-specific cycle
 * one, not one replacing the other. `months` oldest-first. */
export function creditCardMonthlyHistory(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  months = 6,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): CreditCardMonthActivity[] {
  const cardTxs = transactions.filter((t) => t.cardId === card.id);
  const [asOfY, asOfM1] = asOfDate.split('-').map(Number);
  const out: CreditCardMonthActivity[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const raw = asOfM1 - 1 - i;
    const year = asOfY + Math.floor(raw / 12);
    const month0 = ((raw % 12) + 12) % 12;
    const monthStr = `${year}-${String(month0 + 1).padStart(2, '0')}`;
    const monthStart = `${monthStr}-01`;
    const lastDay = daysInMonth(year, month0);
    const monthEnd = i === 0 ? asOfDate : `${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const monthTxs = cardTxs.filter((t) => t.date >= monthStart && t.date <= monthEnd);
    const spent = round2(monthTxs.filter((t) => t.kind !== 'payment').reduce((s, t) => s + t.amount, 0));
    const paid = round2(monthTxs.filter((t) => t.kind === 'payment').reduce((s, t) => s + t.amount, 0));
    const balanceEnd = round2(balanceAsOf(card, cardTxs, monthEnd));
    out.push({ month: monthStr, spent, paid, balanceEnd });
  }
  return out;
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
