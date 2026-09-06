import type { BankAccount } from '../../types/bankWorkbook';
import type { PlannedBankTransaction } from '../../types/plannedBank';
import type { PlannedCashEntry } from '../../types/plannedCash';
import type { EMILoan } from '../../types/emiWorkbook';
import type { Property } from '../../types/rentalsWorkbook';
import type { Subscription } from '../../types/subscriptionsWorkbook';
import { recurrenceOccurrencesWithin } from './recurrence';
import { emiSchedule, emiSummary, installmentDueDate } from './emiModule';
import { proposeRentCollection } from './rentalPlanning';
import { generateRenewalOccurrences } from './subscriptionsModule';

/** One normalized "expect this to happen soon" item, from any module —
 * user-requested (2026-09-07): "app UI should be simple and interactive
 * enough to let the user see through some highly expected inflows and
 * outflows," after calling the existing Planning feature "redundant,
 * confusing and complex looking" while still failing to plan a recurring
 * salary deposit or a monthly utility bill. This is the single aggregator
 * behind both the homepage "Upcoming" widget and the revamped `/planning`
 * page — every module keeps its own existing recurrence/schedule logic
 * (EMI's schedule, Rentals' collection cycle, Subscriptions' billing
 * cycle, Cash/Bank's own recurring plans) and this just normalizes their
 * OWN next-occurrence answers onto one shape, sorted by date. Nothing here
 * mutates any module's data — purely a read-side view. */
export interface UpcomingItem {
  date: string;
  module: 'cash' | 'bank' | 'emi' | 'rentals' | 'subscriptions';
  label: string;
  /** Always a positive magnitude — direction is `kind`, not the sign. */
  amount: number;
  currencyCode: string;
  kind: 'income' | 'expense';
  /** True once `date` has already passed and this hasn't happened yet. */
  overdue: boolean;
}

export interface UpcomingInputs {
  plannedCash: PlannedCashEntry[];
  plannedBank: PlannedBankTransaction[];
  bankAccounts: BankAccount[];
  emiLoans: EMILoan[];
  rentalProperties: Property[];
  subscriptions: Subscription[];
}

/** Every expected item across every module, from `today` through
 * `windowDays` ahead (default 14, same near-term horizon Subscriptions'
 * own renewal alerts already use) — PLUS anything already overdue (a
 * one-off/recurring plan whose date has passed but hasn't been marked
 * done, or an EMI/Rentals/Subscriptions obligation past its own due date),
 * since surfacing what's overdue is exactly the point of this view. */
export function collectUpcomingItems(inputs: UpcomingInputs, windowDays = 14, today: Date = new Date()): UpcomingItem[] {
  const todayStr = today.toISOString().slice(0, 10);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  const windowEndStr = windowEnd.toISOString().slice(0, 10);
  const items: UpcomingItem[] = [];

  inputs.plannedCash.forEach((p) => {
    if (p.recurrence) {
      recurrenceOccurrencesWithin(p.recurrence, todayStr, windowEndStr)
        .filter((d) => !p.executedThrough || p.executedThrough < d)
        .forEach((d) => items.push({
          date: d, module: 'cash', label: p.category?.trim() || p.note?.trim() || 'Cash plan',
          amount: p.amount, currencyCode: p.currencyCode, kind: p.type === 'IN' ? 'income' : 'expense', overdue: d < todayStr,
        }));
    } else if (!p.executed && p.date <= windowEndStr) {
      items.push({
        date: p.date, module: 'cash', label: p.category?.trim() || p.note?.trim() || 'Cash plan',
        amount: p.amount, currencyCode: p.currencyCode, kind: p.type === 'IN' ? 'income' : 'expense', overdue: p.date < todayStr,
      });
    }
  });

  const currencyByAccount = new Map(inputs.bankAccounts.map((a) => [a.id, a.currencyCode]));
  inputs.plannedBank.forEach((p) => {
    const code = currencyByAccount.get(p.accountId);
    if (!code) return;
    if (p.recurrence) {
      recurrenceOccurrencesWithin(p.recurrence, todayStr, windowEndStr)
        .filter((d) => !p.executedThrough || p.executedThrough < d)
        .forEach((d) => items.push({
          date: d, module: 'bank', label: p.description, amount: Math.abs(p.amount), currencyCode: code,
          kind: p.amount >= 0 ? 'income' : 'expense', overdue: d < todayStr,
        }));
    } else if (!p.executed && p.date <= windowEndStr) {
      items.push({
        date: p.date, module: 'bank', label: p.description, amount: Math.abs(p.amount), currencyCode: code,
        kind: p.amount >= 0 ? 'income' : 'expense', overdue: p.date < todayStr,
      });
    }
  });

  inputs.emiLoans.filter((l) => l.isActive !== false).forEach((loan) => {
    const { rows } = emiSchedule(loan);
    const summary = emiSummary(loan, today);
    const next = rows[summary.elapsed];
    if (!next) return;
    const due = installmentDueDate(loan, next.month);
    if (due > windowEndStr) return;
    items.push({ date: due, module: 'emi', label: `${loan.name} installment`, amount: next.emi, currencyCode: loan.currencyCode, kind: 'expense', overdue: due < todayStr });
  });

  inputs.rentalProperties.filter((p) => p.isActive !== false).forEach((property) => {
    const proposal = proposeRentCollection(property, today);
    if (!proposal || proposal.dueDate > windowEndStr) return;
    items.push({ date: proposal.dueDate, module: 'rentals', label: `${property.name} rent`, amount: proposal.amount, currencyCode: property.currencyCode, kind: 'income', overdue: proposal.dueDate < todayStr });
  });

  inputs.subscriptions.filter((s) => s.active).forEach((sub) => {
    generateRenewalOccurrences(sub, today)
      .filter((o) => o.date <= windowEndStr)
      .forEach((o) => items.push({ date: o.date, module: 'subscriptions', label: sub.name, amount: o.amount, currencyCode: sub.currencyCode, kind: 'expense', overdue: o.date < todayStr }));
  });

  return items.sort((a, b) => a.date.localeCompare(b.date));
}
