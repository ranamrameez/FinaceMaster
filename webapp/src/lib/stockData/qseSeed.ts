/** One-time seed data for the shared `stockData/QSE` Firebase node.
 *
 * README item 1: this data (ticker names, H1 EPS/fundamentals) used to be
 * hard-coded in index.html's JS source, per-app rather than shared. It's
 * general market data, not user data, so it belongs in a public RTDB node
 * (`stockData/QSE/tickerNames`, `stockData/QSE/fundamentals`) instead.
 *
 * This file exists only to seed that node once via `seedQSEStockData()` —
 * after seeding, the app should read from Firebase (see `reader.ts`), not
 * from this file. Do not add new tickers/fundamentals here going forward;
 * edit them in Firebase (or a future admin UI) instead. */

export const QSE_TICKER_NAMES: Record<string, string> = {
  VFQS: 'Vodafone Qatar',
  QFLS: 'Qatar Fuel (WOQOD)',
  MPHC: 'Mesaieed Petrochemical Holding',
  TQES: 'Qatar Electronic Systems (Techno Q)',
  MARK: 'AlRayan Bank',
  QIBK: 'Qatar Islamic Bank',
  QNBK: 'Qatar National Bank',
  IQCD: 'Industries Qatar',
  ORDS: 'Ooredoo',
  QGTS: 'Nakilat',
  ERES: 'Ezdan Holding Group',
  IGRD: 'Estithmar Holding',
  DUBK: 'Dukhan Bank',
  QIIK: 'Qatar Intl Islamic Bank',
  CBQK: 'The Commercial Bank',
  QEWS: 'Nebras Energy',
  QNNS: 'Qatar Navigation',
  ABQK: 'Ahli Bank',
  QAMC: 'Qatar Aluminium Manufacturing',
  BRES: 'Barwa Real Estate',
  DHBK: 'Doha Bank',
  QATI: 'Qatar Insurance',
  AHCS: 'Aamal Company',
  ZHCD: 'Zad Holding',
  GISS: 'Gulf International Services',
  UDCD: 'United Development',
  BLDN: 'Baladna',
  MERS: 'Al Meera Consumer Goods',
  MCCS: 'Mannai Corporation',
  QFBQ: 'Lesha Bank',
  MEZA: 'MEEZA',
  QNCD: 'Qatar National Cement',
  QIGD: 'Qatari Investors Group',
  MCGS: 'Medicare Group',
  DOHI: 'Doha Insurance Group',
  GWCS: 'Gulf Warehousing',
  QIMD: 'Qatar Industrial Manufacturing',
};

export interface FundamentalsEntry {
  name: string;
  period: string;
  profit: number | null;
  priorProfit: number | null;
  eps: number | null;
  priorEps: number | null;
  dps: number | null;
  status: 'VERIFIED' | 'DISCLOSED_NOT_RETRIEVED';
  source: string;
  url: string;
}

export const QSE_FUNDAMENTALS: Record<string, FundamentalsEntry> = {
  QFLS: { name: 'Qatar Fuel (WOQOD)', period: 'H1 2026', profit: 397771000, priorProfit: 460434000, eps: 0.40, priorEps: 0.46, dps: 0.90, status: 'VERIFIED', source: 'The Group / QSE disclosure', url: 'https://thegroup.com.qa/news-api/api/v1/news/html/b0EARx9' },
  MARK: { name: 'AlRayan Bank', period: 'H1 2026', profit: 687476000, priorProfit: 821383000, eps: 0.074, priorEps: 0.088, dps: null, status: 'VERIFIED', source: 'The Group / QSE disclosure', url: 'https://thegroup.com.qa/news-api/api/v1/news/html/dXFccnF' },
  IQCD: { name: 'Industries Qatar', period: 'H1 2026', profit: 215649000, priorProfit: 1955376000, eps: 0.04, priorEps: 0.32, dps: null, status: 'VERIFIED', source: 'The Group / QSE disclosure', url: 'https://thegroup.com.qa/news-api/api/v1/news/html/ivf5cPv' },
  MPHC: { name: 'Mesaieed Petrochemical Holding', period: 'H1 2026', profit: -183006000, priorProfit: 378706000, eps: -0.015, priorEps: 0.030, dps: null, status: 'VERIFIED', source: 'The Group / QSE disclosure', url: 'https://thegroup.com.qa/news-api/api/v1/news/html/6rgKUiv' },
  QGTS: { name: 'Nakilat', period: 'H1 2026', profit: 856960000, priorProfit: 859630000, eps: 0.15, priorEps: 0.16, dps: null, status: 'VERIFIED', source: 'QSE disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=QGTS&InformationCategory=Company&InformationType=News' },
  DHBK: { name: 'Doha Bank', period: 'H1 2026', profit: 435971000, priorProfit: null, eps: 0.140, priorEps: 0.150, dps: null, status: 'VERIFIED', source: 'QSE / CBFS disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=DHBK&InformationCategory=Company&InformationType=News' },
  ORDS: { name: 'Ooredoo', period: 'H1 2026', profit: 1848791000, priorProfit: 1948062000, eps: 0.58, priorEps: 0.61, dps: null, status: 'VERIFIED', source: 'QSE disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=ORDS&InformationCategory=Company&InformationType=News' },
  BRES: { name: 'Barwa Real Estate', period: 'H1 2026', profit: 459303000, priorProfit: 560166000, eps: 0.1180, priorEps: 0.1441, dps: null, status: 'VERIFIED', source: 'QSE disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=BRES&InformationCategory=Company&InformationType=News' },
  VFQS: { name: 'Vodafone Qatar', period: 'H1 2026', profit: 400910000, priorProfit: 328628000, eps: 0.095, priorEps: 0.078, dps: null, status: 'VERIFIED', source: 'QSE disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=VFQS&InformationCategory=Company&InformationType=News' },
  ERES: { name: 'Ezdan Holding Group', period: 'H1 2026', profit: 441963000, priorProfit: null, eps: 0.017, priorEps: 0.016, dps: null, status: 'VERIFIED', source: 'QSE / company disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=ERES&InformationCategory=Company&InformationType=News' },
  GWCS: { name: 'Gulf Warehousing', period: 'H1 2026', profit: 62287000, priorProfit: null, eps: 0.106, priorEps: 0.100, dps: null, status: 'VERIFIED', source: 'QSE / company disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=GWCS&InformationCategory=Company&InformationType=News' },
  ABQK: { name: 'Ahli Bank', period: 'H1 2026', profit: 407427000, priorProfit: null, eps: 0.151, priorEps: 0.149, dps: null, status: 'VERIFIED', source: 'QSE / company disclosure', url: 'https://www.qe.com.qa/company-profile?CompanyCode=ABQK&InformationCategory=Company&InformationType=News' },
  TQES: { name: 'Qatar Electronic Systems (Techno Q)', period: 'H1 2026', profit: null, priorProfit: null, eps: null, priorEps: null, dps: null, status: 'DISCLOSED_NOT_RETRIEVED', source: 'The Group link supplied by user; figures not verified', url: 'https://thegroup.com.qa/news-api/api/v1/news/html/QWf7qU5' },
  QIBK: { name: 'Qatar Islamic Bank', period: 'H1 2026', profit: null, priorProfit: null, eps: null, priorEps: null, dps: null, status: 'DISCLOSED_NOT_RETRIEVED', source: 'QSE disclosure exists; exact figures not retrieved', url: 'https://www.qe.com.qa/company-profile?CompanyCode=QIBK&InformationCategory=Company&InformationType=News' },
  QNBK: { name: 'Qatar National Bank', period: 'H1 2026', profit: null, priorProfit: null, eps: null, priorEps: null, dps: null, status: 'DISCLOSED_NOT_RETRIEVED', source: 'QSE disclosure exists; exact figures not retrieved', url: 'https://www.qe.com.qa/company-profile?CompanyCode=QNBK&InformationCategory=Company&InformationType=News' },
  AHCS: { name: 'Aamal Company', period: 'H1 2026', profit: null, priorProfit: null, eps: null, priorEps: null, dps: null, status: 'DISCLOSED_NOT_RETRIEVED', source: 'QSE disclosure exists; exact figures not retrieved', url: 'https://www.qe.com.qa/company-profile?CompanyCode=AHCS&InformationCategory=Company&InformationType=News' },
  CBQK: { name: 'The Commercial Bank', period: 'H1 2026', profit: null, priorProfit: null, eps: null, priorEps: null, dps: null, status: 'DISCLOSED_NOT_RETRIEVED', source: 'QSE disclosure exists; exact figures not retrieved', url: 'https://www.qe.com.qa/company-profile?CompanyCode=CBQK&InformationCategory=Company&InformationType=News' },
  QFBQ: { name: 'Lesha Bank', period: 'H1 2026', profit: null, priorProfit: null, eps: null, priorEps: null, dps: null, status: 'DISCLOSED_NOT_RETRIEVED', source: 'QSE disclosure exists; exact figures not retrieved', url: 'https://www.qe.com.qa/company-profile?CompanyCode=QFBQ&InformationCategory=Company&InformationType=News' },
};
