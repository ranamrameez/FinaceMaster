import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrencyQuickAdd } from '../CurrencyQuickAdd';
import { useToastStore } from '../Toast';

// User-requested (2026-09-16): "in DB save a list of all currencies and let
// the user choose for his currency or more simply let the user type his
// currency(ies)." Tested directly since it's pure form logic (a regex
// validation + a datalist of suggestions), no store/auth dependency.
describe('CurrencyQuickAdd', () => {
  beforeEach(() => {
    useToastStore.setState({ message: null });
  });

  it('calls onAdd with an uppercased, trimmed 3-letter code on submit', () => {
    const onAdd = vi.fn();
    render(<CurrencyQuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText(/Add a currency/i);
    fireEvent.change(input, { target: { value: ' jpy ' } });
    fireEvent.submit(input.closest('form')!);
    expect(onAdd).toHaveBeenCalledWith('JPY');
  });

  it('clears the input after a successful add', () => {
    const onAdd = vi.fn();
    render(<CurrencyQuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText(/Add a currency/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'JPY' } });
    fireEvent.submit(input.closest('form')!);
    expect(input.value).toBe('');
  });

  it('rejects anything that is not exactly 3 letters, without calling onAdd', () => {
    const onAdd = vi.fn();
    render(<CurrencyQuickAdd onAdd={onAdd} />);
    const input = screen.getByPlaceholderText(/Add a currency/i);
    fireEvent.change(input, { target: { value: 'Japanese Yen' } });
    fireEvent.submit(input.closest('form')!);
    expect(onAdd).not.toHaveBeenCalled();
    expect(useToastStore.getState().message).toMatch(/3-letter/i);
  });

  it('excludes already-enabled codes from the datalist suggestions', () => {
    const { container } = render(<CurrencyQuickAdd onAdd={vi.fn()} excludeCodes={['USD', 'JPY']} />);
    const options = Array.from(container.querySelectorAll('option')).map((o) => o.getAttribute('value'));
    expect(options).not.toContain('USD');
    expect(options).not.toContain('JPY');
    expect(options).toContain('EUR');
  });
});
