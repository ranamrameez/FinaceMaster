import { useEffect, useRef, useState } from 'react';
import { useAppearanceStore } from '../store/appearanceStore';

const COLOR_THEMES = [
  { group: 'Classic themes', options: [
    ['wine', 'Classic (Graphite & Gold)'],
    ['ocean', 'Ocean Blue'],
    ['forest', 'Forest Green'],
    ['violet', 'Violet'],
    ['sunset', 'Sunset Amber'],
  ] },
  { group: 'Material Design themes', options: [
    ['material-blue', 'Material Purple / Blue'],
    ['material-green', 'Material Green'],
    ['material-purple', 'Material Rose'],
    ['material-teal', 'Material Teal'],
    ['material-amber', 'Material Amber'],
    ['material-crimson', 'Material Crimson'],
    ['material-slate', 'Material Slate'],
  ] },
];

export function AppearancePanel() {
  const [open, setOpen] = useState(false);
  const appearance = useAppearanceStore((s) => s.appearance);
  const updateAppearance = useAppearanceStore((s) => s.update);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="appearance-popover sidebar-popover" ref={containerRef}>
      <button className="navbtn appearance-trigger" type="button" onClick={() => setOpen((o) => !o)}>
        <span className="num">✦</span>Appearance
      </button>
      {open && (
        <div className="appearance-panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="appearance-panel-title">Appearance</div>
          <select value={appearance.font} onChange={(e) => updateAppearance({ font: e.target.value })} title="Font style">
            <option value="system">Clean system font</option>
            <option value="arial">Arial</option>
            <option value="arial-narrow">Arial Narrow</option>
            <option value="default">Inter / Space Grotesk</option>
            <option value="legible">Atkinson Hyperlegible (max readability)</option>
            <option value="rounded">Lexend (reading-friendly)</option>
            <option value="serif">Serif (Source Serif)</option>
          </select>
          <select value={appearance.fontSize} onChange={(e) => updateAppearance({ fontSize: e.target.value })} title="Text size">
            <option value="small">Small text</option>
            <option value="medium">Medium text</option>
            <option value="large">Large text</option>
            <option value="xl">Extra large text</option>
          </select>
          <select value={appearance.colorTheme} onChange={(e) => updateAppearance({ colorTheme: e.target.value })} title="Color theme">
            {COLOR_THEMES.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select value={appearance.density} onChange={(e) => updateAppearance({ density: e.target.value })} title="Card density">
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
            <option value="console">Console (super compact)</option>
          </select>
          <button
            className="btn secondary small"
            type="button"
            onClick={() => updateAppearance({ theme: appearance.theme === 'light' ? 'dark' : 'light' })}
          >
            {appearance.theme === 'light' ? '● Dark mode' : '☀ Light mode'}
          </button>
        </div>
      )}
    </div>
  );
}
