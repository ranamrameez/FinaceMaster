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
 * means the "From" field falls back to its plain default next time.
 *
 * User-reported (2026-09-07): "it saves last used linked account but
 * currency mismatched" — this used to persist only `{module, ref}`, never
 * `currencyCode`, so restoring a remembered account left the "Other
 * finance" field's own `currencyCode` blank; `SideFields`' Currency
 * dropdown then fell back to displaying whatever entity happened to be
 * FIRST in that module's list, not the remembered account's actual
 * currency — a real, visible mismatch even when the remembered account and
 * its currency were never actually out of sync with each other. Now
 * persists `currencyCode` too, so a restore comes back fully resolved. */
export function rememberTransferSource(to: LinkSideConfig, from: LinkSideConfig) {
  try {
    localStorage.setItem(entityKey(to), JSON.stringify({ module: from.module, ref: from.ref, currencyCode: from.currencyCode }));
  } catch {
    // ignore
  }
}

export function getLastTransferSource(to: LinkSideConfig): Pick<LinkSideConfig, 'module' | 'ref' | 'currencyCode'> | null {
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
