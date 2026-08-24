import type { SubscriptionsSettings, SubscriptionsWorkbook } from '../types/subscriptionsWorkbook';

export const DEFAULT_SUBSCRIPTIONS_SETTINGS: SubscriptionsSettings = {
  defaultCurrency: 'USD',
};

export function createEmptySubscriptionsWorkbook(): SubscriptionsWorkbook {
  return {
    settings: { ...DEFAULT_SUBSCRIPTIONS_SETTINGS },
    entries: [],
  };
}
