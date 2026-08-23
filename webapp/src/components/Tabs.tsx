import { useState, type ReactNode } from 'react';

export interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

/** Sub-navigation within a page — splits what used to be one long stacked
 * page into switchable sections, using the existing .chip-tabs/.chip
 * classes (same visual language as the rest of the app, not a new pattern). */
export function Tabs({ tabs, defaultKey }: { tabs: TabDef[]; defaultKey?: string }) {
  const [active, setActive] = useState(defaultKey || tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) || tabs[0];

  return (
    <div>
      <div className="chip-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip${t.key === active ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current?.content}
    </div>
  );
}
