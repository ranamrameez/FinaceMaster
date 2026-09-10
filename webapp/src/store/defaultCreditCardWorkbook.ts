import type { CreditCardWorkbook } from '../types/creditCard';

export function createEmptyCreditCardWorkbook(): CreditCardWorkbook {
  return { cards: [], transactions: [] };
}
