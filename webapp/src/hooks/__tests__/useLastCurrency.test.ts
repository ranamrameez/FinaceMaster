import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLastCurrency } from '../useLastCurrency';

beforeEach(() => {
  localStorage.clear();
});

describe('useLastCurrency', () => {
  it('falls back to the given default when nothing has been remembered yet', () => {
    const { result } = renderHook(() => useLastCurrency('cash', 'USD'));
    expect(result.current[0]).toBe('USD');
  });

  it('remembers a picked currency across a fresh hook instance (simulating remounting the form)', () => {
    const { result: first } = renderHook(() => useLastCurrency('cash', 'USD'));
    act(() => first.current[1]('PKR'));
    expect(first.current[0]).toBe('PKR');

    const { result: second } = renderHook(() => useLastCurrency('cash', 'USD'));
    expect(second.current[0]).toBe('PKR');
  });

  it('keeps different keys independent', () => {
    const { result: cash } = renderHook(() => useLastCurrency('cash', 'USD'));
    const { result: bank } = renderHook(() => useLastCurrency('bank-account', 'USD'));
    act(() => cash.current[1]('SAR'));
    expect(cash.current[0]).toBe('SAR');
    expect(bank.current[0]).toBe('USD');
  });
});
