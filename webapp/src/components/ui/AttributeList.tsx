import type { ReactNode } from 'react';
import { gridAutoStyle } from '../../lib/gridStyle';

/** Read-only label/value grid for an entity's own attributes — the
 * redesign's "Often" tier default view (a detail page opens READ-ONLY,
 * with an Edit icon to switch into the same form used to create the
 * record). Skips any attribute with no value rather than rendering a
 * blank line for every optional field a record happens not to have set —
 * "show every attribute" means nothing is silently dropped from what CAN
 * be shown, not that an empty field earns its own visible row. */
export function AttributeList({ items }: { items: { label: string; value: ReactNode }[] }) {
  const shown = items.filter((i) => i.value !== undefined && i.value !== null && i.value !== '');
  if (!shown.length) {
    return <p className="text-muted m-0">Nothing set yet — click Edit to add details.</p>;
  }
  return (
    <div className="grid-auto" style={gridAutoStyle(180, '10px 16px')}>
      {shown.map((i) => (
        <div key={i.label}>
          <div className="text-muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
            {i.label}
          </div>
          <div>{i.value}</div>
        </div>
      ))}
    </div>
  );
}
