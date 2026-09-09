import { beforeEach, describe, expect, it } from 'vitest';
import { useCurrencyOnboardingStore } from '../currencyOnboardingStore';

beforeEach(() => {
  localStorage.clear();
  useCurrencyOnboardingStore.setState({ seen: false });
});

describe('useCurrencyOnboardingStore', () => {
  it('defaults to unseen, zero-migration', () => {
    expect(useCurrencyOnboardingStore.getState().seen).toBe(false);
  });

  it('dismiss() flips seen and persists it', () => {
    useCurrencyOnboardingStore.getState().dismiss();
    expect(useCurrencyOnboardingStore.getState().seen).toBe(true);
    expect(localStorage.getItem('financerecorder_currency_onboarding_seen_v1')).toBe('true');
  });

  it('persists across a fresh load (simulates a reload)', () => {
    useCurrencyOnboardingStore.getState().dismiss();
    expect(localStorage.getItem('financerecorder_currency_onboarding_seen_v1')).toBe('true');
  });
});
