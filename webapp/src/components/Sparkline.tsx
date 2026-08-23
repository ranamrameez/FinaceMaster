import { useState } from 'react';

/** A minimal, wordless trend line — no axes, no labels, no legend. This is
 * the standard "sparkline in a list row" pattern from stock apps
 * (Robinhood, Yahoo Finance): a quick visual of direction, not a chart to
 * read values off — except on hover, where a small tooltip shows the exact
 * value at that point (plain SVG, not Chart.js, since this renders once
 * per row and needs to stay cheap). */
export function Sparkline({
  data,
  width = 72,
  height = 26,
  formatValue = (v: number) => v.toFixed(3),
}: {
  data: number[];
  width?: number;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; value: number } | null>(null);

  if (data.length < 2) {
    return <span className="footer-note">—</span>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const coords = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y, v };
  });
  const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const up = data[data.length - 1] >= data[0];
  const color = up ? 'var(--profit)' : 'var(--loss)';

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    let nearest = coords[0];
    let best = Infinity;
    for (const c of coords) {
      const d = Math.abs(c.x - relX);
      if (d < best) { best = d; nearest = c; }
    }
    setHover({ x: nearest.x, y: nearest.y, value: nearest.v });
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        {hover && <circle cx={hover.x} cy={hover.y} r={2.2} fill={color} />}
      </svg>
      {hover && (
        <span
          className="shared-tooltip show"
          style={{
            position: 'absolute', bottom: height + 4, left: Math.max(0, hover.x - 20),
            pointerEvents: 'none', width: 'auto', whiteSpace: 'nowrap', padding: '3px 7px', fontSize: 11,
          }}
        >
          {formatValue(hover.value)}
        </span>
      )}
    </span>
  );
}
