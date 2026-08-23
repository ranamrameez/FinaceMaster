import type { RentalSettings, RentalsWorkbook } from '../types/rentalsWorkbook';

export const DEFAULT_RENTAL_SETTINGS: RentalSettings = {
  properties: [],
};

export function createEmptyRentalsWorkbook(): RentalsWorkbook {
  return {
    settings: { ...DEFAULT_RENTAL_SETTINGS, properties: [] },
    entries: [],
  };
}
