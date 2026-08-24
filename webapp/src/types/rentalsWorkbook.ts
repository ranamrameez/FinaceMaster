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
