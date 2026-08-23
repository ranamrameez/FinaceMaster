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
}

export interface RentalSettings {
  properties: Property[];
}

export interface RentalsWorkbook {
  settings: RentalSettings;
  entries: RentalEntry[];
}
