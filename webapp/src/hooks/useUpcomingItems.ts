import { useMemo } from 'react';
import { usePlannedCashWorkbookStore } from '../store/plannedCashWorkbookStore';
import { usePlannedBankWorkbookStore } from '../store/plannedBankWorkbookStore';
import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import { useEMIWorkbookStore } from '../store/emiWorkbookStore';
import { useRentalsWorkbookStore } from '../store/rentalsWorkbookStore';
import { useSubscriptionsWorkbookStore } from '../store/subscriptionsWorkbookStore';
import { collectUpcomingItems, type UpcomingItem } from '../lib/calc/upcoming';

/** Live store wiring for `collectUpcomingItems` — shared by the homepage
 * "Upcoming" widget and the revamped `/planning` page (README Pending item
 * 118), so both read the identical set of real store slices. */
export function useUpcomingItems(windowDays = 14): UpcomingItem[] {
  const plannedCash = usePlannedCashWorkbookStore((s) => s.workbook.entries);
  const plannedBank = usePlannedBankWorkbookStore((s) => s.workbook.entries);
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const rentalProperties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const subscriptions = useSubscriptionsWorkbookStore((s) => s.workbook.entries);

  return useMemo(
    () => collectUpcomingItems({ plannedCash, plannedBank, bankAccounts, emiLoans, rentalProperties, subscriptions }, windowDays),
    [plannedCash, plannedBank, bankAccounts, emiLoans, rentalProperties, subscriptions, windowDays],
  );
}
