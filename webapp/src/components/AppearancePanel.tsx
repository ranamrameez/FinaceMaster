import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
      <button
        className="btn secondary small"
        type="button"
        onClick={() => updateAppearance({ theme: appearance.theme === 'light' ? 'dark' : 'light' })}
      >
        {appearance.theme === 'light' ? '● Dark mode' : '☀ Light mode'}
      </button>
    </div>
  );
}

interface Pos {
  top: number;
  left: number;
}

const PANEL_WIDTH = 255;

/** User-reported (2026-09-06): "Appearnce card is cutting!" Root-caused,
 * not guessed at: the sidebar has an active (non-`none`) CSS `transform`
 * on any viewport ≤860px — `translateX(-100%)` when closed, `translateX(0)`
 * when open (theme.css's mobile drawer rules) — and a `transform` on an
 * ancestor makes it the CONTAINING BLOCK for any `position:fixed`
 * descendant per the CSS spec, so this popover's own `position:fixed`
 * stopped being relative to the viewport and became relative to the
 * (comparatively small) sidebar box instead, clipping it — the exact same
 * bug class already found and fixed for `Tooltip.tsx` (see that file's own
 * doc comment: `.entity-card:hover{transform:...}` did the identical thing
 * to a hovered tooltip). Fixed the same way: portal the panel straight to
 * `document.body`, so it's never a DOM descendant of anything that might
 * apply a transform, plus a real two-pass position measurement (mount
 * hidden, measure actual height, flip to open ABOVE the trigger if opening
 * below would run off the bottom of the viewport — this trigger sits in
 * the sidebar's own footer, near the bottom of the screen on a typical
 * viewport, so "always open below" was a second, independent way to clip
 * it even before the transform/containing-block issue is considered). */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    if (!open || measured || !pos || !triggerRef.current || !panelRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.getBoundingClientRect().height;
    const fitsBelow = rect.bottom + 6 + panelHeight < window.innerHeight - 8;
    if (!fitsBelow) {
      setPos({ ...pos, top: Math.max(8, rect.top - 6 - panelHeight) });
    }
    setMeasured(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, measured, pos]);

  return { pos, measured };
}

/** Closes the popover on an outside click or Escape. The panel is portaled
 * to `document.body` (see `useAnchoredPosition`'s own doc comment for why),
 * so it's no longer a DOM descendant of `containerRef` — a click inside it
 * has to be checked against `panelRef` separately, or it would wrongly
 * count as "outside" and close itself on every interaction with its own
 * `<select>`s. */
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
