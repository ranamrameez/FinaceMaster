/** Credit Card module — see CLAUDE.md's "Credit Card redesign — concrete
 * proposal" for the full research-backed design writeup this is built
 * from. The user rejected an earlier `isLiability`-on-`BankAccount` design
 * outright ("Credit Card can never behave like a bank"): a bank account is
 * a store of money you own; a credit card is a revolving line of CREDIT
 * you borrow against, with a real billing/statement cycle, a minimum
 * payment, a hard credit limit, and — the thing `BankAccount` had no
 * concept of at all — a carried balance that can accrue real markup.
 * Genuinely separate entity, own store, own ledger. */

export type CreditCardTransactionKind = 'charge' | 'payment' | 'fee' | 'markup' | 'cashAdvance';

/** Research (CLAUDE.md, 2026-09-10): real issuers genuinely differ on how
 * markup/interest is computed. `'flatOnCarried'` — a flat disclosed rate
 * applied to the amount carried past a grace period, with a minimum
 * threshold exemption — is the only method actually implemented in v1
 * (the user's own real Sharia-compliant murabaha/tawarruq card: "1% on
 * unsettled amount if amount is >= 100qar"). Other values are reserved
 * slots for a later session with a real conventional-card user to design
 * against (Average Daily Balance needs a real day-by-day transaction walk
 * this app has never needed before; Previous Balance needs its own
 * cycle-start-balance snapshot) — never guess at either without a real
 * card to verify against. */
export type MarkupMethod = 'flatOnCarried';

/** Research: minimum-payment formulas vary by issuer (a flat %, a flat
 * floor, or "floor OR %, whichever is greater" — Chase's own published
 * example). A single fixed number can't represent all three, so this is a
 * small formula instead. `'fixed'` is the default — an existing/simple
 * card just keeps the one number it always had. */
export type MinPaymentMethod = 'fixed' | 'percentOfBalance' | 'greaterOfFixedOrPercent';

export interface CreditCard {
  id: string;
  name: string;
  /** Optional link to a `Bank` (`types/bank.ts`) — which real institution
   * issued this card, same pattern as `BankAccount.bankId`. */
  bankId?: string;
  currencyCode: string;
  creditLimit?: number;
  /** Day of month (1-31, clamped to the actual month length) the billing
   * cycle closes / statement generates. */
  statementDate?: number;
  /** Day of month (1-31, clamped) payment is due — resolved relative to
   * `statementDate`: same month if `paymentDueDate >= statementDate`, the
   * month after otherwise (same day-of-month clamping convention already
   * used by EMI's `installmentDueDate`). */
  paymentDueDate?: number;
  minPaymentMethod?: MinPaymentMethod;
  /** The fixed floor (used by `'fixed'` and the floor half of
   * `'greaterOfFixedOrPercent'`). */
  minPaymentAmount?: number;
  /** E.g. `2` for 2% of the statement balance (used by
   * `'percentOfBalance'` and the percent half of
   * `'greaterOfFixedOrPercent'`). */
  minPaymentPct?: number;
  lateFeeAfterDue?: number;
  annualFee?: number;
  markupMethod?: MarkupMethod;
  /** E.g. `1.0` for 1% — the flat rate `'flatOnCarried'` applies to the
   * carried (still-unpaid-from-last-cycle) balance, once it clears
   * `markupThresholdAmount`. */
  markupRatePct?: number;
  /** Below this amount, no markup is charged at all regardless of rate —
   * the user's own real example: "under 100 where charges don't hit." */
  markupThresholdAmount?: number;
  /** Semi-automated minimum-payment collection (mirrors Rentals'
   * `Property.pendingRentBalance` exactly) — a carried-forward shortfall
   * from a partial "attempt" at paying the minimum due, never negative on
   * an overpayment. This app has no real bank-API access and can never
   * actually pull money on its own — "N attempts" is recorded by the user
   * entering less than the proposed minimum each time. */
  pendingMinDue?: number;
  /** Free-form (e.g. "Visa", "Mastercard") — never a fixed enum, per this
   * project's own "category fields must be free-form" rule. Optionally
   * auto-filled from `cardBin` via `lib/binLookup.ts`. */
  cardNetwork?: string;
  /** First 6-8 digits of the card (a BIN/IIN) — never the full card
   * number, same caution as `BankAccount.cardBin`. */
  cardBin?: string;
  isActive?: boolean;
  isFavorite?: boolean;
  /** Fed straight into `EntityCard`'s `hue` prop — same convention as
   * `Bank.color`/`Broker.color`. */
  color?: string;
  /** Same "archive, don't delete; count, don't hide" split already used by
   * `BankAccount.includeInNetWorth` — an independent opt-out from Net
   * Worth's own totals, not tied to `isActive`. */
  includeInNetWorth?: boolean;
  seq?: number;
}

export interface CreditCardTransaction {
  id: string;
  cardId: string;
  date: string;
  time?: string;
  timezone?: string;
  /** Always positive — `kind` decides the effect on the balance, not the
   * sign. Deliberately NOT reusing Bank's signed deposit/withdrawal
   * convention: "Charge"/"Payment" are the real actions a cardholder
   * takes, semantically distinct even where the arithmetic happens to
   * rhyme. `outstandingBalance = Σ(charge+fee+markup+cashAdvance) −
   * Σ(payment)`. */
  kind: CreditCardTransactionKind;
  amount: number;
  description: string;
  categoryID?: string;
  source?: 'manual' | 'statement-import';
  statementRef?: string;
  seq?: number;
  timestamp?: string;
}

export interface CreditCardWorkbook {
  cards: CreditCard[];
  transactions: CreditCardTransaction[];
}
