import type { LinkSideConfig } from '../types/interEntityTransfer';

const STORAGE_PREFIX = 'financerecorder_last_transfer_source_';

/** Keys a remembered "from" source by which entity it was paying INTO, so
 * "PSX always comes from my Zindagi bank account" and "this rental property
 * usually gets rent from a different source" can both be remembered
 * independently — user's own example. `ref` (a specific bank account/
 * property/loan id) is part of the key since two rentals properties, say,
 * can each have their own usual funding source. */
function entityKey(to: LinkSideConfig): string {
  return STORAGE_PREFIX + to.module + (to.ref ? `:${to.ref}` : '');
}

/** Best-effort convenience, not data that needs to survive at all costs —
 * same reasoning as `useLastCurrency`. Losing a remembered source just
 * means the "From" field falls back to its plain default next time. */
export function rememberTransferSource(to: LinkSideConfig, from: LinkSideConfig) {
  try {
    localStorage.setItem(entityKey(to), JSON.stringify({ module: from.module, ref: from.ref }));
  } catch {
    // ignore
  }
}

export function getLastTransferSource(to: LinkSideConfig): Pick<LinkSideConfig, 'module' | 'ref'> | null {
  try {
    const raw = localStorage.getItem(entityKey(to));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.module === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}
