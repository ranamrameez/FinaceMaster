import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// User-reported bug: updating a ticker's market price from the floating
// Trade Calculator (which calls the shared store's setMarketPrice, then
// re-renders the whole app reactively) didn't show up on the Dashboard's
// or Portfolio's own inline "Current price" cell until a full page reload.
//
// Root cause: that cell is `<input defaultValue={r.mp || ''} ... />` —
// deliberately uncontrolled so free typing isn't fought by a controlled
// `value` re-snapping mid-keystroke (same reasoning as the Trade
// Calculator's own Amount field fix, README Done item 51). But
// `defaultValue` is an *initial* value only: React does not re-apply it on
// a later re-render just because the prop changed, so once `r.mp` updates
// from an external write (the Calculator, a Firebase sync pull, etc.) this
// specific input keeps showing whatever it last displayed until the whole
// element remounts. The fix (`key={r.mp}` on the same input, in
// DashboardPage.tsx and PortfolioPage.tsx for both QSE and PSX) forces
// exactly that remount whenever the underlying price changes for a reason
// other than typing into the field itself, while leaving in-progress
// typing on an unchanged price completely alone.
function PriceCell({ mp, useKeyFix }: { mp: number; useKeyFix: boolean }) {
  return (
    <input
      key={useKeyFix ? mp : undefined}
      aria-label="price"
      type="number"
      defaultValue={mp || ''}
    />
  );
}

function value(): string {
  return (screen.getByLabelText('price') as HTMLInputElement).value;
}

describe('price-input remount-on-external-update pattern', () => {
  it('without the key fix, the DOM value goes stale after an external prop update', () => {
    const { rerender } = render(<PriceCell mp={10} useKeyFix={false} />);
    expect(value()).toBe('10');

    rerender(<PriceCell mp={15} useKeyFix={false} />);
    // Bug reproduced: defaultValue does not re-apply, so the input is
    // still showing the old price even though the prop changed.
    expect(value()).toBe('10');
  });

  it('with key={mp}, an external price update remounts the input to the new value', () => {
    const { rerender } = render(<PriceCell mp={10} useKeyFix={true} />);
    expect(value()).toBe('10');

    rerender(<PriceCell mp={15} useKeyFix={true} />);
    expect(value()).toBe('15');
  });

  it('re-rendering with the same price (e.g. an unrelated store change) does not disturb the field', () => {
    const { rerender } = render(<PriceCell mp={10} useKeyFix={true} />);
    rerender(<PriceCell mp={10} useKeyFix={true} />);
    expect(value()).toBe('10');
  });
});
