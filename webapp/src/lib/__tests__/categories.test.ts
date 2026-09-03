import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, UNCATEGORIZED_ID, categoryName, findCategoryByName, normalizeCategoryKey } from '../categories';
import { resolveLegacyCategoryId } from '../financeMigration';

describe('normalizeCategoryKey', () => {
  it('recognizes the one real safe-merge pair found in the app owner\'s real data: "CC-Payment" and "CC payment"', () => {
    expect(normalizeCategoryKey('CC-Payment')).toBe(normalizeCategoryKey('CC payment'));
  });

  it('trims a trailing space without merging into an unrelated category', () => {
    expect(normalizeCategoryKey('Touring ')).toBe('touring');
    expect(normalizeCategoryKey('Touring ')).not.toBe(normalizeCategoryKey('Travel'));
  });

  it('does NOT merge close-but-distinct real categories (a deliberate scope limit, not a bug)', () => {
    expect(normalizeCategoryKey('Health')).not.toBe(normalizeCategoryKey('Medical'));
    expect(normalizeCategoryKey('Reconcile')).not.toBe(normalizeCategoryKey('Reconciliation adjustment'));
  });
});

describe('findCategoryByName', () => {
  it('matches an existing category after normalization', () => {
    const match = findCategoryByName('grocery'.toUpperCase(), DEFAULT_CATEGORIES);
    expect(match?.name).toBe('Grocery');
  });

  it('returns undefined for a blank or unmatched name', () => {
    expect(findCategoryByName('', DEFAULT_CATEGORIES)).toBeUndefined();
    expect(findCategoryByName('Something Nobody Has Ever Used', DEFAULT_CATEGORIES)).toBeUndefined();
  });
});

describe('resolveLegacyCategoryId', () => {
  it('resolves a known legacy category name to its real id', () => {
    expect(resolveLegacyCategoryId('Grocery')).toBe('cat_grocery');
  });

  it('falls back to Uncategorized for a blank/undefined category, never crashing', () => {
    expect(resolveLegacyCategoryId(undefined)).toBe(UNCATEGORIZED_ID);
    expect(resolveLegacyCategoryId('   ')).toBe(UNCATEGORIZED_ID);
  });

  it('falls back to Uncategorized for a genuinely unrecognized name, preserving the original text elsewhere (not this function\'s job)', () => {
    expect(resolveLegacyCategoryId('Some Brand New Category Nobody Seeded')).toBe(UNCATEGORIZED_ID);
  });
});

describe('categoryName', () => {
  it('resolves a categoryID to its display name', () => {
    expect(categoryName('cat_grocery', DEFAULT_CATEGORIES)).toBe('Grocery');
  });

  it('falls back to "Uncategorized" for a missing or deleted category id', () => {
    expect(categoryName(undefined, DEFAULT_CATEGORIES)).toBe('Uncategorized');
    expect(categoryName('cat_does_not_exist', DEFAULT_CATEGORIES)).toBe('Uncategorized');
  });
});
