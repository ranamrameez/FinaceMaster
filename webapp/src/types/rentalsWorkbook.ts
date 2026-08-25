export interface Property {
  id: string;
  name: string; // "Apartment 4B", "House on Main St"
  /** A property has one currency (real-world rentals do). */
  currencyCode: string;
  /** For a lifetime ROI figure, optional. */
  purchasePrice?: number;

  // ---- Lease / tenant / deposit info (README items 38/13) — all optional
  // so existing properties keep working unchanged; only fills in once a
  // user actually has a lease to record. ----
  /** Recurring rent amount, used to auto-generate projected income plans. */
  monthlyRent?: number;
  /** Day of the month (1-31) rent is due each cycle. A day past a given
   * month's length (e.g. 31 in February) clamps to that month's last day,
   * same accepted simplification as EMI/Loans' date math. */
  cycleStartDay?: number;
  leaseStartDate?: string;
  /** Auto-plan generation stops here if set; open-ended (generates a
   * capped 12-month horizon instead) if not. */
  leaseEndDate?: string;
  /** Lump yes/no for now, not itemized bills — see MODULES_PLAN.md's
   * Rentals section for why itemized utility tracking is deferred. */
  utilitiesIncluded?: boolean;
  tenantName?: string;
  tenantContact?: string;
  securityDeposit?: number;
  securityDepositType?: 'cash' | 'cheque' | 'bank_transfer' | 'other';
  securityDepositDate?: string;
  securityDepositReturned?: boolean;

  // ---- Semi-automated rent collection (README item 61) — a separate,
  // simpler mechanism from the lease-based bulk plan generator above:
  // instead of projecting a whole lease's worth of cycles up front, this
  // proposes just the ONE next-due collection from a cycle + an anchor
  // date, for the user to approve (and adjust) one at a time. All
  // optional so this doesn't interact with properties that only use the
  // lease-based generator. ----
  /** How often rent is collected. Distinct from the lease generator's
   * always-monthly `cycleStartDay` — this supports the other cadences a
   * real informal/short-term rental can use. */
  collectionCycle?: 'daily' | 'weekly' | 'monthly' | 'annual';
  /** Anchor date the next due date is computed from — set initially by
   * the user, then advanced automatically to whatever date a collection
   * was actually logged at. */
  lastCollectionDate?: string;
  /** Carried-forward shortfall from a partial payment, added on top of
   * `monthlyRent` when proposing the next collection. Never goes
   * negative — an overpayment simply clears it rather than tracking a
   * credit balance, an accepted simplification for v1. */
  pendingRentBalance?: number;
}

export interface RentalEntry {
  id: string;
  propertyId: string; // currency is implied by the property, not repeated per-entry
  date: string;
  type: 'RENT_INCOME' | 'EXPENSE';
  amount: number;
  /** Free-form, user-definable — never a fixed enum (locked decision,
   * MODULES_PLAN.md). */
  category?: string;
  note?: string;
  /** 'statement-import' added 2026-08-23 (README item 25 / MODULES_PLAN.md
   * §13's CSV-import scope) — same "transaction doesn't care about its
   * source" shape as Bank/Cash. Unset (implicitly manual) for every entry
   * logged before today. */
  source?: 'manual' | 'statement-import';
  statementRef?: string;
}

export interface RentalSettings {
  properties: Property[];
}

export interface RentalsWorkbook {
  settings: RentalSettings;
  entries: RentalEntry[];
}
