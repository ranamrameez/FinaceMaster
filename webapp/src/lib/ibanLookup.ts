/** IBAN → bank name/BIC lookup (user-requested, 2026-08-26). Distinct from
 * this project's locked "no live market-data API" rule — that rule is
 * about polling a data feed on every page load; this is a one-off,
 * user-initiated lookup against a *public bank registry*, not account
 * data, and is also unrelated to the separately-locked "no bank account
 * API / open-banking integration" rule (that one is about live balance/
 * transaction access, which requires SBP/QCB regulator licensing — a
 * public IBAN→bank-name directory needs no such license).
 *
 * Two-stage design: (1) validate the IBAN's own checksum locally first
 * (no network call for something that's obviously malformed), then (2)
 * try a chain of live providers in order, returning the first real hit.
 *
 * Only ONE keyless, no-registration provider (openiban.com) could be
 * confidently wired in — it's a well-established public tool, documented
 * and used without an API key. A second free provider was deliberately
 * NOT hardcoded here: every other commonly-referenced "free" IBAN API
 * (ibanapi.com, api.iban.com, etc.) actually requires a registered key
 * even on its free tier, and guessing at an unverified second endpoint
 * risked shipping a permanently-dead code path that looks like real
 * redundancy but never fires — worse than being upfront about the gap.
 * `IBAN_PROVIDERS` is an array specifically so a second real provider can
 * be dropped in later (once one with a genuinely public, keyless endpoint
 * is confirmed) without changing any caller. */

export interface IbanBankInfo {
  bankName?: string;
  bic?: string;
}

/** Local IBAN checksum validation (ISO 13616 mod-97), no network call.
 * Rejects obviously-malformed input before ever hitting a live provider. */
export function isValidIbanFormat(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  // mod-97 over a potentially very long numeric string — done in chunks
  // since JS numbers lose precision past ~15-16 digits.
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  return remainder === 1;
}

type Provider = (iban: string) => Promise<IbanBankInfo | null>;

async function openIbanProvider(iban: string): Promise<IbanBankInfo | null> {
  const res = await fetch(`https://openiban.com/validate/${encodeURIComponent(iban)}?getBIC=true&validateBankCode=true`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.valid || !data?.bankData) return null;
  const bankName: string | undefined = data.bankData.name || undefined;
  const bic: string | undefined = data.bankData.bic || undefined;
  if (!bankName && !bic) return null;
  return { bankName, bic };
}

const IBAN_PROVIDERS: Provider[] = [openIbanProvider];

/** Tries each provider in order; returns the first successful result, or
 * `null` if every provider failed/returned nothing (network error, an
 * unsupported country, rate-limiting, etc.) — callers should treat `null`
 * as "not supported here, ask the user to enter it manually," not as an
 * error to surface as a crash. */
export async function lookupIban(rawIban: string): Promise<IbanBankInfo | null> {
  const iban = rawIban.replace(/\s+/g, '').toUpperCase();
  if (!isValidIbanFormat(iban)) return null;
  for (const provider of IBAN_PROVIDERS) {
    try {
      const result = await provider(iban);
      if (result) return result;
    } catch {
      // Network error / CORS / provider down — fall through to the next
      // provider (if any), never throw out to the caller.
    }
  }
  return null;
}
