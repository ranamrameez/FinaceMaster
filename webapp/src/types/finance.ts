/** Shared base for every "ledger-style money movement" record in the app —
 * user-requested (2026-09-03): "create 1 base model (Finance) and inherit
 * all others from it... use categ ids, instead of texts." Scope, confirmed
 * with the user before building: CashEntry/BankTransaction/RentalEntry (+
 * their Planned* counterparts) — the only record types that already had
 * free-text categories. QSE/PSX/Funds trades, EMI, and Personal Loans stay
 * on their own existing shapes (explicitly out of scope — "fundamentally
 * different," and forcing amount+isDeposit onto a stock trade or an
 * amortization schedule would gut the calc engines those depend on).
 *
 * This is a TypeScript `interface`, not a runtime class — `extends` here is
 * structural inheritance (the same idiom this codebase already uses
 * everywhere else, e.g. every workbook type), not OOP polymorphism.
 *
 * Two fields are deliberately NOT simple 1:1 stored copies of the user's
 * own sketch, both flagged and confirmed while designing this:
 * - `isDeposit` is the authoritative direction for Cash/Rentals (renamed
 *   from their old `type` enum). Bank keeps its existing SIGNED `amount`
 *   (negative = debit, positive = credit — the convention its credit-card
 *   liability math already depends on) as the source of truth; `isDeposit`
 *   is derived from the sign at every write, never independently settable,
 *   so there is exactly one source of truth, never two that could drift.
 * - `isLinked` is computed from the existing `interEntityTransfers` store
 *   (the same lookup `warnIfLinked`/the "🔗 Linked" tags already use), not
 *   a second persisted copy of that fact — a stored flag could silently go
 *   stale the moment a link is created or removed from elsewhere in the
 *   app; a live lookup can't. */
export interface Finance {
  /** Stable id — already what every module's own `id: string` field is. */
  id: string;
  /** RDBMS-identity-style monotonic counter — the same role every module's
   * own `seq` field already plays (see `lib/seq.ts`/`lib/financeSerial.ts`),
   * just under this class's own field name. Optional at the type level,
   * same established convention as every other id/sequence field in this
   * codebase (e.g. `Transaction.id?`/`Transaction.seq?`) — always
   * auto-assigned by the owning store on write and backfilled by
   * `normalize()` for pre-existing data, so it's never actually missing at
   * runtime, but callers building a new record don't have to stamp it by
   * hand. */
  serialNumber?: number;
  /** Optional — Cash/Rentals entries never had a title field before this,
   * and forcing one onto every past/future entry would be a real new
   * typing burden the user didn't ask for (confirmed: "no preference," so
   * kept as the lower-friction default). Falls back to the category name
   * for display when absent. `BankTransaction` doesn't use this field at
   * all — its own pre-existing, already-required `description` field
   * fills the identical role, so adding a second required "what is this"
   * field would be redundant, not consistent. */
  title?: string;
  /** A positive magnitude for Cash/Rentals — direction is `isDeposit`, not
   * the sign of this field. `BankTransaction` is the one deliberate
   * exception: it keeps its existing SIGNED amount (negative = debit,
   * positive = credit), the convention its running-ledger and credit-card-
   * liability math already depend on: rewriting that tested arithmetic
   * chain app-wide for a cosmetic sign-convention match carried far more
   * real risk than benefit, so it was deliberately left alone. For Bank,
   * `isDeposit` is derived from this field's sign at every write instead
   * of being independently authoritative. */
  amount: number;
  isDeposit: boolean;
  /** Foreign key into the shared `Category` registry (`lib/categories.ts` /
   * `categoryStore.ts`). Optional at the type level (same "auto-filled by
   * the store, not hand-stamped by every caller" convention as
   * `serialNumber` above) — every store defaults a missing value to the
   * real "Uncategorized" category's id on write, so at runtime this is
   * always resolvable, never blank. */
  categoryID?: string;
  note?: string;
  /** Audit metadata: when this record was first created. Auto-set once by
   * the owning store, never user-editable — NOT the same thing as `date`
   * below. Optional at the type level for the same reason as
   * `serialNumber`. */
  timestamp?: string;
  /** The transaction's own effective date — real user input. Kept as the
   * existing separate date/time/timezone trio (not collapsed into one
   * Datetime) so the app's existing DST-aware chronological sorting
   * (`lib/datetime.ts`'s `toInstantMs`) keeps working unchanged. */
  date: string;
  time?: string;
  timezone?: string;
  /** Computed, not stored — see the file-level comment above. Optional
   * (unlike the user's own original sketch, which had this as required)
   * specifically so it's never accidentally persisted or trusted from
   * storage: nothing in this codebase should ever write this field or read
   * it directly off a stored record. Always resolve the real, current
   * value via `isRecordLinked(module, id)` (`lib/linkCascade.ts`) at
   * display time instead. */
  isLinked?: boolean;
  /** User-requested (2026-09-08): "an important state of transactions
   * (PENDING) where balances just disappear and may flow in both direction
   * on success/failure... locks real balances." Optional, absent/false =
   * cleared (zero migration — no real existing record has ever had this
   * field, so every current balance/total is completely unaffected until a
   * user actually marks something pending). A pending record is a REAL
   * transaction the user already knows is happening (a transfer sent but
   * not yet reflected on the other side, a stock order placed but not yet
   * filled) — genuinely different from the Planning feature's hypothetical/
   * estimated/recurring entries, which never touch a real balance at all.
   * `cashBalanceByCurrency`/`accountBalance` (the two functions every other
   * balance/total in the app derives from) exclude a pending record from
   * the headline "available" figure by design — the user explicitly asked
   * that pending money "disappear" from what's actually spendable right
   * now — while `cashPendingByCurrency`/`accountPendingBalance` expose the
   * pending amount separately so the UI can show BOTH the cleared and the
   * including-pending figure side by side, never just silently dropping
   * the pending amount from view entirely ("rather than giving user a
   * heart attack by excluding pending amounts and not showing them in the
   * stats"). Clearing a pending record (or deleting it, for a failed/
   * cancelled one) is a plain `updateEntry`/`updateTransaction` patch — no
   * new store action needed. **A plain boolean, not a string status enum
   * (`'pending'|'cleared'`) — the user's own explicit design call
   * (2026-09-08): "use boolean flag... a standard DB practice."** This is
   * a retrofit of the field's original shipped shape (Cash/Banking, same
   * day) — safe since the field is itself optional/brand-new, so this is a
   * rename+type-narrow, not a data migration; no real record has ever had
   * either shape stored. Shipped first for Cash + Banking; QSE/PSX and the
   * remaining modules follow the identical pattern in a later pass — see
   * `webapp/README.md`'s own Pending list. */
  isPending?: boolean;
}

/** One entry in the shared category registry every Finance-based record
 * points at via `categoryID`.
 *
 * `scope` (2026-09-09, user-requested: "App level categs are for all,
 * while custom are user specific. we need both") — `'app'` marks a
 * category from the bundled, shared `DEFAULT_CATEGORIES` set
 * (`lib/categories.ts`); `'custom'` marks one the user added themselves
 * via `CategorySelect`'s "+". Optional so real pre-existing stored
 * categories (every real record has one, none has ever carried this
 * field) keep working unmigrated — `categoryStore.ts`'s own `normalize()`
 * backfills it on load (`'app'` for an id matching a known default,
 * `'custom'` otherwise), so every category is tagged one way or the
 * other by the time any code reads it. App-level categories are treated
 * as shared, protected reference data — `renameCategory`/`deleteCategory`
 * refuse to touch one — while custom categories are fully owned by the
 * user and freely renameable/deletable. */
export interface Category {
  id: string;
  serialNumber: number;
  name: string;
  scope?: 'app' | 'custom';
}

export interface CategoriesWorkbook {
  categories: Category[];
}
