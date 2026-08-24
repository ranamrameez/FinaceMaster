import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmountFormat } from '../useAmountFormat';
import { useAppearanceStore } from '../../store/appearanceStore';

describe('useAmountFormat', () => {
  beforeEach(() => {
    act(() => useAppearanceStore.getState().update({ numberDisplay: 'compact' }));
  });

  it('defaults to compact formatting', () => {
    const { result } = renderHook(() => useAmountFormat());
    expect(result.current.raw).toBe(false);
    expect(result.current.money(12345, 'USD')).toBe('12.35k USD');
    expect(result.current.num(12345)).toBe('12k');
  });

  it('switches to raw formatting when the appearance preference is set', () => {
    act(() => useAppearanceStore.getState().update({ numberDisplay: 'raw' }));
    const { result } = renderHook(() => useAmountFormat());
    expect(result.current.raw).toBe(true);
    expect(result.current.money(12345, 'USD')).toBe('12,345.00 USD');
    expect(result.current.num(12345)).toBe('12,345');
  });
});
