import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppearanceStore } from '../store/appearanceStore';
import type { DateFormat } from '../lib/format';

const COLOR_THEMES = [
  { group: 'Classic rounded themes', options: [
    ['ocean', 'Ocean (Finance Blue)'],
    ['forest', 'Forest (Finance Green)'],
    ['violet', 'Violet (Market Purple)'],
  ] },
  { group: 'Modern finance themes', options: [
    ['aurora', 'Aurora (Indigo)'],
    ['cobalt', 'Cobalt (Finance Blue)'],
    ['teal', 'Teal (Blue-Green)'],
    ['copper', 'Copper (Market Orange)'],
    ['gold', 'Gold (Wealth)'],
  ] },
  { group: 'Material themes', options: [
    ['material-teal', 'Material Teal'],
  ] },
];

/** The actual set of appearance controls — extracted so both the sidebar's
 * compact popover (`AppearancePanel` below) and the global Account hub's
 * full-page "Appearance" section render the exact same fields against the
 * exact same store, instead of two copies drifting apart. */
export function AppearanceFields() {
  const appearance = useAppearanceStore((s) => s.appearance);
  const updateAppearance = useAppearanceStore((s) => s.update);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
      <select
        value={appearance.numberDisplay ?? 'compact'}
        onChange={(e) => updateAppearance({ numberDisplay: e.target.value as 'compact' | 'raw' })}
        title="How large numbers display in stat cards: shortened (10,000 -> 10k) or full precision"
      >
        <option value="compact">Numbers: shortened (10k)</option>
        <option value="raw">Numbers: full (10,000)</option>
      </select>
      <select
        value={appearance.dateFormat ?? 'DD/MM/YYYY'}
        onChange={(e) => updateAppearance({ dateFormat: e.target.value as DateFormat })}
        title="How calendar dates are displayed throughout the app"
      >
        <option value="DD-MMM-YYYY">Dates: 22-Sep-2026</option>
        <option value="YYYY-MMM-DD">Dates: 2026-Sep-22</option>
        <option value="DD-MM-YYYY">Dates: 22-09-2026</option>
        <option value="MM-DD-YYYY">Dates: 09-22-2026</option>
        <option value="DD/MM/YYYY">Dates: 22/09/2026</option>
        <option value="MM/DD/YYYY">Dates: 09/22/2026</option>
        <option value="dddd, MMM DD, YYYY">Dates: Tuesday, Sep 22, 2026 (display only)</option>
        <option value="ddd, DD MMM, YYYY">Dates: Tue, 22 Sep, 2026 (display only)</option>
      </select>
      <button
        className="btn secondary small"
        type="button"
        onClick={() => updateAppearance({ theme: appearance.theme === 'light' ? 'dark' : 'light' })}
      >
        {appearance.theme === 'light' ? '● Dark mode' : '☀ Light mode'}
      </button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }} title="Keep the floating action button (Trade Calculator, Add Trade, Transfers, ...) expanded by default instead of collapsed until clicked.">
        <input
          type="checkbox"
          checked={!!appearance.fabAlwaysOpen}
          onChange={(e) => updateAppearance({ fabAlwaysOpen: e.target.checked })}
        />
        Keep quick-actions panel always open
      </label>
    </div>
  );
}

interface Pos {
  top: number;
  left: number;
}

const PANEL_WIDTH = 255;

/** The panel is portaled to body so fixed positioning is not affected by the
 * sidebar's mobile transform/containing block. It is measured first, then
 * flipped above the trigger when there is not enough room below it. */
function useAnchoredPosition(open: boolean, triggerRef: React.RefObject<HTMLElement | null>, panelRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      setMeasured(false);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8),
    });
  }, [open, triggerRef]);

  useLayoutEffect(() => {
    if (!open || measured || !pos || !triggerRef.current || !panelRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.getBoundingClientRect().height;
    const fitsBelow = rect.bottom + 6 + panelHeight < window.innerHeight - 8;
    if (!fitsBelow) {
      setPos({ ...pos, top: Math.max(8, rect.top - 6 - panelHeight) });
    }
    setMeasured(true);
  }, [open, measured, pos, triggerRef, panelRef]);

  return { pos, measured };
}

function useClosePopoverOnOutsideClick(
  open: boolean,
  setOpen: (v: boolean) => void,
  containerRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
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
  }, [open, containerRef, panelRef, setOpen]);
}

export function AppearancePanel() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { pos, measured } = useAnchoredPosition(open, triggerRef, panelRef);
  useClosePopoverOnOutsideClick(open, setOpen, containerRef, panelRef);

  return (
    <div className="appearance-popover sidebar-popover" ref={containerRef}>
      <button className="navbtn appearance-trigger" type="button" ref={triggerRef} onClick={() => setOpen((o) => !o)}>
        <span className="num">✦</span>Appearance
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="appearance-panel"
          style={{ top: pos.top, left: pos.left, visibility: measured ? 'visible' : 'hidden' }}
        >
          <div className="appearance-panel-title">Appearance</div>
          <AppearanceFields />
        </div>,
        document.body,
      )}
    </div>
  );
}
