export interface Property {
  id: string;
  name: string; // "Apartment 4B", "House on Main St"
  /** A property has one currency (real-world rentals do). */
  currencyCode: string;
  /** For a lifetime ROI figure, optional. */
  purchasePrice?: number;
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
