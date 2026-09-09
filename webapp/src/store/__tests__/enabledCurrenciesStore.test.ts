import { beforeEach, describe, expect, it } from 'vitest';
import { useEnabledCurrenciesStore } from '../enabledCurrenciesStore';

beforeEach(() => {
  localStorage.clear();
  useEnabledCurrenciesStore.setState({ enabledCodes: null });
});

describe('useEnabledCurrenciesStore', () => {
  it('defaults to null (not configured — everything shown), zero-migration', () => {
    expect(useEnabledCurrenciesStore.getState().enabledCodes).toBeNull();
  });

  it('toggling a code off from the null (everything) state starts the subset as everything minus that one', () => {
    const { toggle } = useEnabledCurrenciesStore.getState();
    const ok = toggle('EUR');
    expect(ok).toBe(true);
    const codes = useEnabledCurrenciesStore.getState().enabledCodes!;
    expect(codes).not.toBeNull();
    expect(codes).toContain('USD');
    expect(codes).not.toContain('EUR');
  });

  it('toggling a code back on re-adds it', () => {
    const { toggle } = useEnabledCurrenciesStore.getState();
    toggle('EUR');
    toggle('EUR');
    expect(useEnabledCurrenciesStore.getState().enabledCodes).toContain('EUR');
  });

  it('refuses to empty the subset to zero — returns false and leaves the store unchanged', () => {
    useEnabledCurrenciesStore.getState().setEnabledCodes(['USD']);
    const ok = useEnabledCurrenciesStore.getState().toggle('USD');
    expect(ok).toBe(false);
    expect(useEnabledCurrenciesStore.getState().enabledCodes).toEqual(['USD']);
  });

  it('setEnabledCodes(null) resets back to "everything" and clears the persisted key', () => {
    useEnabledCurrenciesStore.getState().setEnabledCodes(['USD', 'EUR']);
    expect(localStorage.getItem('financerecorder_enabled_currencies_v1')).not.toBeNull();
    useEnabledCurrenciesStore.getState().setEnabledCodes(null);
    expect(useEnabledCurrenciesStore.getState().enabledCodes).toBeNull();
    expect(localStorage.getItem('financerecorder_enabled_currencies_v1')).toBeNull();
  });

  it('persists across a fresh load (simulates a reload)', () => {
    useEnabledCurrenciesStore.getState().setEnabledCodes(['PKR', 'USD']);
    const raw = localStorage.getItem('financerecorder_enabled_currencies_v1');
    expect(JSON.parse(raw!)).toEqual(['PKR', 'USD']);
  });
});
