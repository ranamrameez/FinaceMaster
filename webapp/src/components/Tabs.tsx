import { useRef, useState, type ReactNode } from 'react';
import { CollapsibleCard } from './Card';
import { usePageTopBarChips } from '../hooks/usePageTopBar';
import type { TopBarChip } from '../store/pageTopBarStore';

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

  // Pushed into the app-wide fixed TopBar (see that component's own doc
  // comment) instead of rendered inline here — "All" first, same as
  // before, its own active state reflecting whether every section is
  // already open rather than which chip was last clicked.
  const chips: TopBarChip[] = [
    { key: '__all__', label: 'All', active: allOpen, onClick: expandAll },
    ...tabs.map((t) => ({ key: t.key, label: t.label, active: !!openKeys[t.key], onClick: () => jumpTo(t.key) })),
  ];
  usePageTopBarChips(chips);

  return (
    <div>
      {tabs.map((t) => (
        <div key={t.key} ref={(el) => { sectionRefs.current[t.key] = el; }} style={{ marginTop: 20 }}>
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
