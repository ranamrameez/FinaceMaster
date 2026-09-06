import psxTickersFull from './psxTickersFull.json';

/** Bundled seed data for PSX ticker names + sectors — mirrors qseSeed.ts's
 * role: a fallback so the app is never empty on first load, and (unlike
 * QSE) the ONLY source, since there's no shared Firebase `stockData/PSX`
 * node (see usePSXStockData.ts's own comment).
 *
 * `PSX_TICKER_NAMES` (2026-09-06): now derived from `psxTickersFull.json`
 * — a full 854-symbol PSX ticker/name/type/ISIN export the user provided
 * (moved here from `webapp/public/Tickers.PSX.json`, where it briefly sat
 * as a plain static asset with nothing importing it), replacing the
 * previous ~121-symbol hand-curated list ported from the legacy app's
 * `js/psx-symbols.json`. Deliberately kept as a BUNDLED JSON import, not
 * uploaded to Firebase RTDB, for two reasons: (1) this is public reference
 * data (ticker code -> company name), not user data — no per-user sync is
 * needed, so there's nothing Firebase would add over a static import; (2)
 * QSE's own equivalent `stockData/QSE` RTDB node is a cautionary precedent
 * — it's real infrastructure (needs its own RTDB security rules opened up,
 * gates on sign-in even for a read, and per that file's own note "hasn't
 * actually been seeded yet") that neither this session nor a future one
 * can fully verify/administer without direct RTDB console access, whereas
 * a bundled JSON import works immediately, offline, and even when signed
 * out — exactly how the old hand-curated list already worked. If PSX ever
 * needs the SAME data centrally editable across devices without a new
 * app release (the actual reason QSE's Firebase node exists), that's the
 * trigger to revisit this, not "it's a bigger list now."
 *
 * The raw JSON's `Name` field is more formal than the old hand-curated
 * names (e.g. "Oil and Gas Development Co Ltd" vs. the old "Oil & Gas
 * Development Company") — not normalized here on purpose: every real
 * display call site already runs the name through `shortenName.ts`'s
 * `shortenCompanyName()`, which strips exactly this kind of corporate
 * suffix ("Ltd", "Co", etc.) before rendering, so the extra formality
 * never actually reaches the screen.
 *
 * `PSX_TICKER_SECTORS` below is UNCHANGED — the full JSON has no sector/
 * GICS-style field (only Code/Name/Country/Exchange/Currency/Type/Isin),
 * so the old hand-curated sector map (a strict subset of tickers) is kept
 * as-is rather than silently regressed to nothing. Note it has no actual
 * consumer anywhere in the app today (confirmed via a whole-codebase grep)
 * — `usePSXStockData()` exposes it, but no component currently reads
 * `.sectors`; kept for whenever a PSX sector-breakdown feature is built,
 * not removed as unrelated cleanup here. */

export const PSX_TICKER_NAMES: Record<string, string> = Object.fromEntries(
  (psxTickersFull as { Code: string; Name: string }[]).map((t) => [t.Code, t.Name]),
);

export const PSX_TICKER_SECTORS: Record<string, string> = {
  OGDC: 'Oil & Gas Exploration',
  PPL: 'Oil & Gas Exploration',
  POL: 'Oil & Gas Exploration',
  MARI: 'Oil & Gas Exploration',
  PSO: 'Oil & Gas Marketing',
  SHEL: 'Oil & Gas Marketing',
  APL: 'Oil & Gas Marketing',
  HASCOL: 'Oil & Gas Marketing',
  SNGP: 'Gas Distribution',
  SSGC: 'Gas Distribution',
  ATRL: 'Refinery',
  NRL: 'Refinery',
  PRL: 'Refinery',
  CNERGY: 'Refinery',
  HBL: 'Commercial Banks',
  UBL: 'Commercial Banks',
  MCB: 'Commercial Banks',
  NBP: 'Commercial Banks',
  ABL: 'Commercial Banks',
  BAFL: 'Commercial Banks',
  BAHL: 'Commercial Banks',
  MEBL: 'Commercial Banks',
  FABL: 'Commercial Banks',
  AKBL: 'Commercial Banks',
  BOP: 'Commercial Banks',
  BIPL: 'Commercial Banks',
  JSBL: 'Commercial Banks',
  SILK: 'Commercial Banks',
  LUCK: 'Cement',
  DGKC: 'Cement',
  MLCF: 'Cement',
  FCCL: 'Cement',
  PIOC: 'Cement',
  CHCC: 'Cement',
  KOHC: 'Cement',
  ACPL: 'Cement',
  BWCL: 'Cement',
  POWER: 'Cement',
  GWLC: 'Cement',
  THCCL: 'Cement',
  FFC: 'Fertilizer',
  EFERT: 'Fertilizer',
  FATIMA: 'Fertilizer',
  FFBL: 'Fertilizer',
  EFUG: 'Insurance',
  ENGRO: 'Chemicals / Conglomerate',
  ENGROH: 'Chemicals / Conglomerate',
  ICI: 'Chemicals',
  LOTCHEM: 'Chemicals',
  EPCL: 'Chemicals',
  SITARA: 'Chemicals',
  HUBC: 'Power Generation & Distribution',
  KAPCO: 'Power Generation & Distribution',
  KEL: 'Power Generation & Distribution',
  NPL: 'Power Generation & Distribution',
  NCPL: 'Power Generation & Distribution',
  LOTS: 'Power Generation & Distribution',
  PKGP: 'Power Generation & Distribution',
  NML: 'Textile Composite',
  GATM: 'Textile Composite',
  ILP: 'Textile Composite',
  KTML: 'Textile Composite',
  CTM: 'Textile Composite',
  ASTM: 'Textile Composite',
  SAPT: 'Textile Composite',
  SFL: 'Textile Composite',
  FEROZ: 'Pharmaceuticals',
  INDU: 'Automobile Assembler',
  PSMC: 'Automobile Assembler',
  HCAR: 'Automobile Assembler',
  MTL: 'Automobile Assembler',
  AGTL: 'Automobile Assembler',
  SAZEW: 'Automobile Assembler',
  GHNI: 'Automobile Assembler',
  GHGL: 'Automobile Assembler',
  PSEL: 'Automobile Assembler',
  ATLH: 'Automobile Parts & Accessories',
  THALL: 'Automobile Parts & Accessories',
  NESTLE: 'Food & Personal Care',
  UNITY: 'Food & Personal Care',
  FRIESLAND: 'Food & Personal Care',
  MFFL: 'Food & Personal Care',
  MUREB: 'Food & Personal Care',
  COLG: 'Food & Personal Care',
  NATF: 'Food & Personal Care',
  SHEZAN: 'Food & Personal Care',
  MEHT: 'Food & Personal Care',
  SYS: 'Technology & Communication',
  TRG: 'Technology & Communication',
  NETSOL: 'Technology & Communication',
  AIRLINK: 'Technology & Communication',
  AVN: 'Technology & Communication',
  PTC: 'Technology & Communication',
  WTL: 'Technology & Communication',
  OCTOPUS: 'Technology & Communication',
  ISL: 'Engineering',
  ASTL: 'Engineering',
  MUGHAL: 'Engineering',
  ASL: 'Engineering',
  CSAP: 'Engineering',
  IPAK: 'Engineering',
  PKGS: 'Paper & Board',
  CPPL: 'Paper & Board',
  SPL: 'Paper & Board',
  JSCL: 'Investment Banks',
  AICL: 'Insurance',
  IGIHL: 'Insurance',
  PICIC: 'Insurance',
  PIBTL: 'Transport',
  PIAHCLA: 'Transport',
  KOSM: 'Textile Spinning',
  TREET: 'Household Goods',
  TPLP: 'Real Estate',
  DAWH: 'Chemicals / Conglomerate',
  DOL: 'Engineering',
  PAEL: 'Cable & Electrical Goods',
  WAVES: 'Cable & Electrical Goods',
  SEARL: 'Pharmaceuticals',
  GLAXO: 'Pharmaceuticals',
  ABOT: 'Pharmaceuticals',
  HINOON: 'Pharmaceuticals',
};
