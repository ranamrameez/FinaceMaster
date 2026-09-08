import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AmountInput } from '../AmountInput';

function Harness({ initial = 0 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return <AmountInput aria-label="amount" value={value} onChange={setValue} />;
}

function input(): HTMLInputElement {
  return screen.getByLabelText('amount') as HTMLInputElement;
}

describe('AmountInput', () => {
  it('shows the initial numeric value as plain text', () => {
    render(<Harness initial={42} />);
    expect(input().value).toBe('42');
  });

  it('does not commit mid-typing — an in-progress expression stays as typed', () => {
    render(<Harness initial={0} />);
    fireEvent.change(input(), { target: { value: '10+' } });
    expect(input().value).toBe('10+'); // not yet evaluated, not clobbered
  });

  it('evaluates a math expression on blur and replaces the field with the result', () => {
    render(<Harness initial={0} />);
    fireEvent.change(input(), { target: { value: '10.5+5' } });
    fireEvent.blur(input());
    expect(input().value).toBe('15.5');
  });

  it('evaluates on Enter too, not just blur', () => {
    render(<Harness initial={0} />);
    fireEvent.change(input(), { target: { value: '4*5' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(input().value).toBe('20');
  });

  it('leaves an unresolvable expression untouched so the user can fix their typo', () => {
    render(<Harness initial={0} />);
    fireEvent.change(input(), { target: { value: '10+' } });
    fireEvent.blur(input());
    expect(input().value).toBe('10+');
  });

  it('a plain number commits to itself with no expression evaluation needed', () => {
    render(<Harness initial={0} />);
    fireEvent.change(input(), { target: { value: '123.45' } });
    fireEvent.blur(input());
    expect(input().value).toBe('123.45');
  });
});
