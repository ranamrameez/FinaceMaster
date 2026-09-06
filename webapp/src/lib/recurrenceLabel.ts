import type { RecurrenceRule } from '../types/recurrence';

/** Plain-language label for a recurrence rule's own cycle — shared by
 * every "Plans" list that shows a recurring row (Cash/Bank so far). */
export function recurrenceLabel(rule: RecurrenceRule): string {
  switch (rule.cycle) {
    case 'yearly':
      return 'Yearly';
    case 'weekly':
      return 'Weekly';
    case 'custom':
      return `Every ${Math.max(1, rule.customDays || 30)} days`;
    default:
      return 'Monthly';
  }
}
