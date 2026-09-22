import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '../Modal';
import { FilterIcon } from '../icons';
import { usePageFabActions } from '../../hooks/usePageFabActions';

export function FilterFab({
  pageKey,
  title = 'Filters',
  activeCount = 0,
  children,
  onClear,
}: {
  pageKey: string;
  title?: string;
  activeCount?: number;
  children: ReactNode;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const actions = useMemo(
    () => [{
      label: activeCount > 0 ? `Filters (${activeCount})` : 'Filters',
      icon: <FilterIcon size={18} />,
      onClick: () => setOpen(true),
    }],
    [activeCount],
  );

  usePageFabActions(pageKey, actions);

  if (!open) return null;

  return (
    <Modal title={title} onClose={() => setOpen(false)}>
      <div>{children}</div>
      {onClear && (
        <div className="row gap-sm mt-md" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn secondary small" onClick={onClear}>Clear filters</button>
          <button type="button" className="btn small" onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </Modal>
  );
}
