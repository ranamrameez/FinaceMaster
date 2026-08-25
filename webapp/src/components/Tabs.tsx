import { useRef, useState, type ReactNode } from 'react';
import { CollapsibleCard } from './Card';

export interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
  /** Pending item 58: lets one tab put a card-level action (an Export CSV
   * button, a date-range filter, ...) in its own section's header,
   * top-right, same as every other `CollapsibleCard`'s `headerExtra` slot
   * — instead of that control sitting stranded inside the tab's own
   * content, one level below where every other module's equivalent
   * button already lives. */
  headerExtra?: ReactNode;
}

/** Sub-navigation within a page. User-reported (item 1): the old version
 * fully hid every section except the active tab, so "keep pressing the
 * chips just to view a small piece of info" — every section now stays
 * present in the page as its own collapsible card; a chip click scrolls to
 * that section and forces it open (decollapses it) rather than hiding the
 * others. Only the first tab starts open (matching the old default of one
 * visible section at a time, and keeping heavy content like charts from
 * all mounting at once), but nothing is ever unreachable without clicking
 * a chip repeatedly — it's just further down the page, not hidden. */
export function Tabs({ tabs, defaultKey }: { tabs: TabDef[]; defaultKey?: string }) {
  const initialKey = defaultKey || tabs[0]?.key;
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({ [initialKey]: true });
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const jumpTo = (key: string) => {
    setOpenKeys((prev) => ({ ...prev, [key]: true }));
    requestAnimationFrame(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const allOpen = tabs.every((t) => openKeys[t.key]);
  const expandAll = () => setOpenKeys(Object.fromEntries(tabs.map((t) => [t.key, true])));

  return (
    <div>
      {/* User-requested: "Top chips should have an 'All' option to expand all
         at once" — a page with many sections otherwise needs one click per
         section to see everything. Doesn't scroll anywhere on click (there's
         no single section to jump to); its own active state reflects
         whether every section is already open, not which chip was last
         clicked. */}
      <div className="chip-tabs subnav">
        <button type="button" className={`chip${allOpen ? ' active' : ''}`} onClick={expandAll}>
          All
        </button>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip${openKeys[t.key] ? ' active' : ''}`}
            onClick={() => jumpTo(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} ref={(el) => { sectionRefs.current[t.key] = el; }} style={{ marginTop: 12 }}>
          <CollapsibleCard
            title={<h3 style={{ margin: 0 }}>{t.label}</h3>}
            headerExtra={t.headerExtra}
            open={!!openKeys[t.key]}
            onToggle={(open) => setOpenKeys((prev) => ({ ...prev, [t.key]: open }))}
          >
            {t.content}
          </CollapsibleCard>
        </div>
      ))}
    </div>
  );
}
