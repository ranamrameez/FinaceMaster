import type { PlannedRentalsWorkbook } from '../types/plannedRentals';

export function createEmptyPlannedRentalsWorkbook(): PlannedRentalsWorkbook {
  return {
    settings: {},
    entries: [],
  };
}
