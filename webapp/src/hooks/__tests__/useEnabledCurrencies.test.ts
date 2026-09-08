import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENCIES } from '../../lib/currencies';
import { useEnabledCurrenciesStore } from '../../store/enabledCurrenciesStore';
import { useEnabledCurrencies } from '../useEnabledCurrencies';

beforeEach(() => {
  localStorage.clear();
  useEnabledCurrenciesStore.setState({ enabledCodes: null });
});

describe('useEnabledCurrencies', () => {
  it('returns every currency when nothing is configured (zero-migration)', () => {
    const { result } = renderHook(() => useEnabledCurrencies());
    expect(result.current.map((c) => c.code)).toEqual(CURRENCIES.map((c) => c.code));
  });

  it('returns only the configured subset once set', () => {
    useEnabledCurrenciesStore.getState().setEnabledCodes(['USD', 'PKR']);
    const { result } = renderHook(() => useEnabledCurrencies());
    expect(result.current.map((c) => c.code).sort()).toEqual(['PKR', 'USD']);
  });

  it('always includes currentValue even when it falls outside the configured subset', () => {
    useEnabledCurrenciesStore.getState().setEnabledCodes(['USD']);
    const { result } = renderHook(() => useEnabledCurrencies('QAR'));
    expect(result.current.map((c) => c.code)).toContain('QAR');
    expect(result.current.map((c) => c.code)).toContain('USD');
  });

  it('synthesizes a fallback entry for a currentValue not in CURRENCIES at all', () => {
    useEnabledCurrenciesStore.getState().setEnabledCodes(['USD']);
    const { result } = renderHook(() => useEnabledCurrencies('XYZ'));
    const xyz = result.current.find((c) => c.code === 'XYZ');
    expect(xyz).toBeDefined();
    expect(xyz!.symbol).toContain('XYZ');
  });

  it('does not duplicate currentValue when it is already in the subset', () => {
    useEnabledCurrenciesStore.getState().setEnabledCodes(['USD', 'PKR']);
    const { result } = renderHook(() => useEnabledCurrencies('USD'));
    expect(result.current.filter((c) => c.code === 'USD')).toHaveLength(1);
  });
});
