import { useState } from 'react';

/** Click-to-sort table headers, extracted from the Portfolio "Holdings"
 * table so every other table in the app can have the same sortable-header
 * behavior instead of static headers. */
export function useSortableRows<T, C extends string>(
  rows: T[],
  sortValue: (row: T, col: C) => number | string,
  initialCol: NoInfer<C>,
  initialDir: 'asc' | 'desc' = 'desc',
) {
  const [sort, setSort] = useState<{ col: C; dir: 'asc' | 'desc' }>({ col: initialCol, dir: initialDir });

  const sorted = [...rows].sort((a, b) => {
    const av = sortValue(a, sort.col);
    const bv = sortValue(b, sort.col);
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (col: C) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }));

  const arrow = (col: C) => (sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  const Th = ({ col, children }: { col: C; children: React.ReactNode }) => (
    <th className="sortable" onClick={() => toggleSort(col)}>
      {children}
      {arrow(col)}
    </th>
  );

  return { sorted, sort, toggleSort, Th };
}
