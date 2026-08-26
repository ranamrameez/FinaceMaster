/** User-requested (2026-08-26): a prefilled list of banks and mobile-
 * wallet apps for Pakistan and Qatar — the app's two primary currencies/
 * markets (see CLAUDE.md's own notes on QSE/PSX). A plain suggestion
 * datalist, same pattern as `ACCOUNT_TYPES` in `BankPage.tsx` — every
 * value here is a convenience default, never a fixed enum; any bank name
 * the user types that isn't on this list is accepted exactly the same
 * way. Not exhaustive — the major, commonly-used institutions for each
 * market, easy to extend later. */

export const PAKISTAN_BANKS = [
  'Habib Bank Limited (HBL)',
  'United Bank Limited (UBL)',
  'MCB Bank',
  'Allied Bank Limited (ABL)',
  'National Bank of Pakistan (NBP)',
  'Bank Alfalah',
  'Meezan Bank',
  'Standard Chartered Pakistan',
  'Faysal Bank',
  'Askari Bank',
  'Bank Al Habib',
  'Soneri Bank',
  'JS Bank',
  'Habib Metropolitan Bank',
  'Summit Bank',
  'Silk Bank',
  'Bank of Punjab (BOP)',
  'Bank of Khyber (BOK)',
  'Sindh Bank',
  'First Women Bank',
  'Dubai Islamic Bank Pakistan',
  'Al Baraka Bank Pakistan',
  'BankIslami Pakistan',
];

export const PAKISTAN_WALLETS = [
  'JazzCash',
  'Easypaisa',
  'NayaPay',
  'SadaPay',
  'UPaisa',
  'Zindigi (JS Bank)',
  'Konnect (Alfalah)',
  'Keenu',
];

export const QATAR_BANKS = [
  'Qatar National Bank (QNB)',
  'Commercial Bank of Qatar (CBQ)',
  'Doha Bank',
  'Qatar Islamic Bank (QIB)',
  'Masraf Al Rayan',
  'Ahli Bank Qatar',
  'Qatar International Islamic Bank (QIIB)',
  'Al Khaliji (Al Khalij Commercial Bank)',
  'Dukhan Bank',
  'HSBC Qatar',
  'Standard Chartered Qatar',
  'Barwa Bank',
];

export const QATAR_WALLETS = [
  'Ooredoo Money',
  'Vodafone Cash Qatar',
];

/** All four lists combined into one suggestion datalist, in a sensible
 * grouping order (Pakistan banks, Pakistan wallets, Qatar banks, Qatar
 * wallets) — used wherever a single "Bank name" field just needs a
 * flat list of suggestions rather than the individual arrays. */
export const PK_QA_BANKS_AND_WALLETS = [
  ...PAKISTAN_BANKS,
  ...PAKISTAN_WALLETS,
  ...QATAR_BANKS,
  ...QATAR_WALLETS,
];
