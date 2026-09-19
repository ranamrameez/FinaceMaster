import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LotAllocationFields } from '../LotAllocationFields';
import type { FIFOLot } from '../../../lib/calc/fifoPositions';

const lotA: FIFOLot = { buyDate: '2026-08-06', buyPrice: 13.66, buyFeeTotal: 0, originalShares: 25, remainingShares: 25, buyId: 'a' };
const lotB: FIFOLot = { buyDate: '2026-09-08', buyPrice: 12.46, buyFeeTotal: 0, originalShares: 16, remainingShares: 16, buyId: 'b' };

// README Pending item 143 (closed 2026-09-19): manual multi-lot Specific
// Identification UI, the first wiring of `Transaction.lotAllocations`
// (previously engine-only since PR #213). This project's Vitest setup has
// no jest-dom matcher registration (confirmed via grep before writing
// this), so assertions here stay to plain DOM/query-result checks, same
// convention as this file's sibling `CurrencyQuickAdd.test.tsx`.
describe('LotAllocationFields', () => {
  it('renders nothing when there are no usable open lots', () => {
    const { container } = render(<LotAllocationFields lots={[]} totalShares={10} value={undefined} onChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when a lot has no buyId (can never be targeted)', () => {
    const { container } = render(
      <LotAllocationFields lots={[{ ...lotA, buyId: undefined }]} totalShares={10} value={undefined} onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('starts collapsed behind a button when there is no existing allocation', () => {
    render(<LotAllocationFields lots={[lotA, lotB]} totalShares={10} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText(/Specify exact lots/i)).toBeTruthy();
    expect(screen.queryByText(/Which lots is this sale coming from/i)).toBeNull();
  });

  it('starts expanded when an allocation already exists (e.g. editing a real record)', () => {
    render(<LotAllocationFields lots={[lotA, lotB]} totalShares={10} value={[{ buyId: 'a', shares: 10 }]} onChange={vi.fn()} />);
    expect(screen.getByText(/Which lots is this sale coming from/i)).toBeTruthy();
  });

  it('calling onChange with a real share count builds a one-entry allocation array', () => {
    const onChange = vi.fn();
    render(<LotAllocationFields lots={[lotA, lotB]} totalShares={10} value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Specify exact lots/i));
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith([{ buyId: 'a', shares: 10 }]);
  });

  it('setting a lot back to 0 removes it from the allocation array, not just zeroes it', () => {
    const onChange = vi.fn();
    render(
      <LotAllocationFields
        lots={[lotA, lotB]}
        totalShares={10}
        value={[{ buyId: 'a', shares: 5 }, { buyId: 'b', shares: 5 }]}
        onChange={onChange}
      />,
    );
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith([{ buyId: 'b', shares: 5 }]);
  });

  it("clamps a typed value to that lot's own remaining shares", () => {
    const onChange = vi.fn();
    render(<LotAllocationFields lots={[lotB]} totalShares={100} value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Specify exact lots/i));
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '9999' } });
    expect(onChange).toHaveBeenCalledWith([{ buyId: 'b', shares: 16 }]);
  });

  it('"Use default (auto)" clears the allocation and collapses again', () => {
    const onChange = vi.fn();
    render(<LotAllocationFields lots={[lotA]} totalShares={10} value={[{ buyId: 'a', shares: 10 }]} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Use default \(auto\)/i));
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(screen.queryByText(/Which lots is this sale coming from/i)).toBeNull();
  });

  it("shows a warning when the allocated total exceeds the sale's own total shares", () => {
    render(
      <LotAllocationFields
        lots={[lotA, lotB]}
        totalShares={10}
        value={[{ buyId: 'a', shares: 8 }, { buyId: 'b', shares: 8 }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/You've allocated more shares/i)).toBeTruthy();
  });
});
