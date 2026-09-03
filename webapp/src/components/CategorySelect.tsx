import { useState } from 'react';
import { Modal } from './Modal';
import { PlusIcon } from './icons';
import { Field, Select, TextInput } from './ui/Field';
import { IconButton } from './ui/IconButton';
import { toast } from './Toast';
import { useCategoryStore } from '../store/categoryStore';

/** Shared category picker for every Finance-based add/edit form
 * (Cash/Bank/Rentals) — a real dropdown sourced from the shared Category
 * registry (`categoryStore.ts`) instead of free-text typing, plus a "+"
 * quick-add so choosing a brand-new category never requires leaving the
 * form, same pattern `SideFields`' own entity quick-add already
 * established. */
export function CategorySelect({ value, onChange }: { value: string; onChange: (categoryID: string) => void }) {
  const categories = useCategoryStore((s) => s.workbook.categories);
  const addCategory = useCategoryStore((s) => s.addCategory);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  const submitNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) return toast('Enter a category name.');
    const category = addCategory(trimmed);
    onChange(category.id);
    setNewName('');
    setAdding(false);
  };

  return (
    <div className="row" style={{ gap: 4, alignItems: 'center' }}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <IconButton label="Add a new category" icon={<PlusIcon size={13} />} onClick={() => setAdding(true)} />
      {adding && (
        <Modal title="Add a category" onClose={() => setAdding(false)}>
          <Field label="Category name">
            <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitNew()} />
          </Field>
          <button className="btn" style={{ marginTop: 12 }} onClick={submitNew}>
            <PlusIcon size={12} />Add category
          </button>
        </Modal>
      )}
    </div>
  );
}
