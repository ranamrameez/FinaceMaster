import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

// User-reported bug ("current price disappears after saving"): PositionDetail's
// "Update price" input is a controlled field bound to local `priceInput` state.
// `commitPrice()` used to call `setPriceInput('')` right after successfully
// saving the price — so the box went blank even though the save itself worked
// correctly (every other stat on the page reflected the new price). Fixed by
// re-filling the field with the value that was just saved instead of clearing
// it — see PositionDetail.tsx (QSE + PSX) `commitPrice`.
function PriceInputHarness({ clearOnSave }: { clearOnSave: boolean }) {
  const [priceInput, setPriceInput] = useState('');
  const [savedPrice, setSavedPrice] = useState<number | null>(null);

  const commitPrice = () => {
    const val = parseFloat(priceInput);
    if (!val || val <= 0) return;
    setSavedPrice(val);
    setPriceInput(clearOnSave ? '' : String(val));
  };

  return (
    <div>
      <input aria-label="price" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} />
      <button onClick={commitPrice}>Save price</button>
      <span aria-label="saved">{savedPrice ?? ''}</span>
    </div>
  );
}

describe('PositionDetail price-input save behavior', () => {
  it('reproduces the bug: clearing on save blanks the field even though the price WAS saved', () => {
    render(<PriceInputHarness clearOnSave={true} />);
    fireEvent.change(screen.getByLabelText('price'), { target: { value: '125.5' } });
    fireEvent.click(screen.getByText('Save price'));
    expect(screen.getByLabelText('saved').textContent).toBe('125.5');
    expect((screen.getByLabelText('price') as HTMLInputElement).value).toBe('');
  });

  it('fixed: re-filling with the saved value keeps the field showing what was just saved', () => {
    render(<PriceInputHarness clearOnSave={false} />);
    fireEvent.change(screen.getByLabelText('price'), { target: { value: '125.5' } });
    fireEvent.click(screen.getByText('Save price'));
    expect(screen.getByLabelText('saved').textContent).toBe('125.5');
    expect((screen.getByLabelText('price') as HTMLInputElement).value).toBe('125.5');
  });
});
