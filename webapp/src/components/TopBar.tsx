import { usePageTopBarStore } from '../store/pageTopBarStore';

/** App-wide fixed top bar — user-requested (2026-09-11, design reference:
 * `wealth_tracker_template/` in this repo): the page's own sections
 * (Transactions/Analytics/Settings/...) should be visible immediately on
 * page load, not only once scrolled to. `Tabs.tsx` used to render this
 * same chip row inline, itself already `position: sticky` — correct once
 * scrolled past, but rendered *after* the page's own `<h1>`/intro
 * paragraph, so on load it sat below that content, not pinned at the very
 * top. The fix is where it renders, not the sticky mechanism itself:
 * `AppShell.tsx` renders this as `.main`'s very FIRST child, ahead of
 * every page's own content — on load (scrollTop 0) that already puts it
 * at the top of the visible page with nothing above it to scroll past,
 * and `position: sticky` (see `.page-topbar` in `theme.css`, reusing the
 * old `.chip-tabs.subnav` rule's own tuned padding/shadow) keeps it
 * pinned from there on. Living inside `.main` also means it automatically
 * tracks the sidebar's collapsed/expanded width and the mobile drawer
 * breakpoint for free, via `.main`'s own existing `margin-left` rules —
 * no separate CSS needed to duplicate that tracking.
 *
 * Reads from `pageTopBarStore` — the exact same "page registers, one
 * globally-mounted component renders" shape `FabPanel`/`fabActionsStore`
 * already established for the floating action button. Renders nothing
 * (not even an empty bar) when the current page hasn't registered any
 * chips or a right-slot — most pages don't use `Tabs` at all (Dashboards,
 * per-stock pages, ...), and a permanent empty strip on those would just
 * be dead chrome. */
export function TopBar() {
  const chips = usePageTopBarStore((s) => s.chips);
  const rightSlot = usePageTopBarStore((s) => s.rightSlot);

  if (!chips.length && !rightSlot) return null;

  return (
    <div className="page-topbar">
      <div className="chip-tabs" style={{ margin: 0, flex: 1, minWidth: 0 }}>
        {chips.map((c) => (
          <button key={c.key} type="button" className={`chip${c.active ? ' active' : ''}`} onClick={c.onClick}>
            {c.label}
          </button>
        ))}
      </div>
      {rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}
    </div>
  );
}
