import type { CSSProperties } from 'react';

/** Builds the style object for the shared `.grid-auto` class
 * (`main/site.css`) - pass the exact minmax/gap numbers a call site used
 * to hardcode inline. Kept as a tiny typed helper (rather than each call
 * site writing the `'--grid-min' as any` cast itself) so every usage
 * stays consistent. */
export function gridAutoStyle(minPx: number, gap: number | string = 12): CSSProperties {
  return {
    ['--grid-min' as string]: `${minPx}px`,
    ['--grid-gap' as string]: typeof gap === 'number' ? `${gap}px` : gap,
  } as CSSProperties;
}
