/** Card network/issuer detection from a BIN/IIN — the first 6-8 digits of
 * a card number, which is all that's needed to identify the issuing
 * network (Visa/Mastercard/etc.) and often the issuing bank; this app
 * NEVER asks for or stores a full card number, same caution already
 * applied to `BankAccount.accountNumber` (which only ever holds a masked
 * trailing few digits). Same provider-chain shape as `lib/ibanLookup.ts`
 * for the same reason: `binlist.net` is the one confirmed free/keyless
 * public lookup — a second provider slot is left for later rather than
 * guessing at an unverified endpoint. */

export interface BinInfo {
  network?: string; // e.g. "visa", "mastercard" — binlist's own "scheme" field
  bankName?: string;
  cardType?: 'credit' | 'debit' | 'prepaid';
}

function isValidBin(bin: string): boolean {
  return /^\d{6,8}$/.test(bin);
}

async function binlistProvider(bin: string): Promise<BinInfo | null> {
  const res = await fetch(`https://lookup.binlist.net/${bin}`, { headers: { 'Accept-Version': '3' } });
  if (!res.ok) return null;
  const data = await res.json();
  const network: string | undefined = data?.scheme || undefined;
  const bankName: string | undefined = data?.bank?.name || undefined;
  const cardType: BinInfo['cardType'] = data?.type === 'debit' || data?.type === 'prepaid' ? data.type : data?.type === 'credit' ? 'credit' : undefined;
  if (!network && !bankName) return null;
  return { network, bankName, cardType };
}

const BIN_PROVIDERS: ((bin: string) => Promise<BinInfo | null>)[] = [binlistProvider];

/** Tries each provider in order, returns the first hit, or `null` if every
 * provider failed/found nothing — callers should treat `null` as "not
 * detected, enter it yourself," never as an error to surface as a crash. */
export async function lookupBin(rawBin: string): Promise<BinInfo | null> {
  const bin = rawBin.replace(/\s+/g, '');
  if (!isValidBin(bin)) return null;
  for (const provider of BIN_PROVIDERS) {
    try {
      const result = await provider(bin);
      if (result) return result;
    } catch {
      /* fall through to the next provider, if any */
    }
  }
  return null;
}

export { isValidBin };
