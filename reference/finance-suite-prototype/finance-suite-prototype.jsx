import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, TrendingUp, TrendingDown, X, ChevronRight, ArrowLeft, Trash2,
  LayoutGrid, LineChart as LineChartIcon, BarChart3, Landmark, Receipt, HandCoins,
} from "lucide-react";

/* ============================== currencies ============================== */
// Covers the primary user base: US, EU, GCC, and Pakistan.
const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "SAR", symbol: "SAR " },
  { code: "AED", symbol: "AED " },
  { code: "QAR", symbol: "QAR " },
  { code: "KWD", symbol: "KWD " },
  { code: "BHD", symbol: "BHD " },
  { code: "OMR", symbol: "OMR " },
  { code: "PKR", symbol: "₨" },
  { code: "INR", symbol: "₹" },
];
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} (${c.symbol.trim()})` }));
const sym = (code) => (CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]).symbol;

/* ============================== helpers ============================== */

const fmtMoney = (n, symbol = "$") => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return sign + symbol + Math.round(Math.abs(n)).toLocaleString("en-US");
};
const fmtPct = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => new Date(d).toISOString().slice(0, 7);
const uid = () => "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Group-and-sum helper for entities that may each carry a different currency —
// we never fake-convert between currencies, we just sum within each one.
function sumByCurrency(items, currencyFn, valueFn) {
  const out = {};
  items.forEach((it) => {
    const c = currencyFn(it);
    out[c] = (out[c] || 0) + valueFn(it);
  });
  return out;
}
function mergeCurrencyMaps(...maps) {
  const out = {};
  maps.forEach((m) => Object.entries(m).forEach(([c, v]) => (out[c] = (out[c] || 0) + v)));
  return out;
}
function subtractCurrencyMaps(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([c, v]) => (out[c] = (out[c] || 0) - v));
  return out;
}

const GRADIENTS = [
  ["#3B5BDB", "#8FA6EE"], ["#1F8A5C", "#8FCBA8"], ["#C2255C", "#EBA0BE"],
  ["#B4690E", "#EABF8B"], ["#6C4FA0", "#C3A8DC"], ["#0E8E8E", "#8FD4D4"],
];
const randomGradient = () => GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

// XIRR: Newton-Raphson with bisection fallback. cfs: [{date:Date, amount:number}]
function xirr(cfs) {
  if (!cfs || cfs.length < 2) return null;
  if (!cfs.some((c) => c.amount < 0) || !cfs.some((c) => c.amount > 0)) return null;
  const t0 = cfs[0].date.getTime();
  const yrs = cfs.map((c) => (c.date.getTime() - t0) / (365 * 24 * 3600 * 1000));
  const npv = (r) => cfs.reduce((s, c, i) => s + c.amount / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = (r) => cfs.reduce((s, c, i) => s - (yrs[i] * c.amount) / Math.pow(1 + r, yrs[i] + 1), 0);
  let rate = 0.15, ok = false;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate), df = dnpv(rate);
    if (Math.abs(df) < 1e-9) break;
    const next = rate - f / df;
    if (!isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - rate) < 1e-7) { rate = next; ok = true; break; }
    rate = next;
  }
  if (!ok || Math.abs(npv(rate)) > 1) {
    let lo = -0.9999, hi = 20, flo = npv(lo), fhi = npv(hi);
    if (flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, fm = npv(mid);
      if (Math.abs(fm) < 1e-6) { rate = mid; break; }
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
      rate = (lo + hi) / 2;
    }
  }
  return isFinite(rate) ? rate : null;
}

/* ========================= module calculations ========================= */

// ---- Mutual Funds ----
function fundMetrics(f) {
  const invested = f.transactions.filter((t) => t.type === "invest").reduce((s, t) => s + t.amount, 0);
  const withdrawn = f.transactions.filter((t) => t.type === "withdraw").reduce((s, t) => s + t.amount, 0);
  const netInvested = invested - withdrawn;
  const balances = [...f.balances].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentValue = balances.length ? balances[balances.length - 1].value : netInvested;
  const prevValue = balances.length > 1 ? balances[balances.length - 2].value : null;
  const dailyChange = prevValue !== null ? currentValue - prevValue : null;
  const dailyChangePct = prevValue ? (dailyChange / prevValue) * 100 : null;
  const netProfit = currentValue - netInvested;
  const netProfitPct = netInvested ? (netProfit / netInvested) * 100 : 0;
  const cfs = f.transactions.map((t) => ({ date: new Date(t.date), amount: t.type === "invest" ? -t.amount : t.amount }));
  const asOf = balances.length ? new Date(balances[balances.length - 1].date) : new Date();
  cfs.push({ date: asOf, amount: currentValue });
  cfs.sort((a, b) => a.date - b.date);
  const rate = xirr(cfs);
  return { netInvested, currentValue, dailyChange, dailyChangePct, netProfit, netProfitPct, xirrPct: rate !== null ? rate * 100 : null, balances };
}

// ---- Stock Shares ----
function stockMetrics(s) {
  const buys = s.transactions.filter((t) => t.type === "buy");
  const sells = s.transactions.filter((t) => t.type === "sell");
  const qtyHeld = buys.reduce((a, t) => a + t.qty, 0) - sells.reduce((a, t) => a + t.qty, 0);
  const buyQty = buys.reduce((a, t) => a + t.qty, 0);
  const buyCost = buys.reduce((a, t) => a + t.qty * t.price, 0);
  const avgBuyPrice = buyQty ? buyCost / buyQty : 0;
  const netInvested = qtyHeld * avgBuyPrice;
  const prices = [...s.prices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentPrice = prices.length ? prices[prices.length - 1].price : avgBuyPrice;
  const prevPrice = prices.length > 1 ? prices[prices.length - 2].price : null;
  const currentValue = qtyHeld * currentPrice;
  const dailyChange = prevPrice !== null ? qtyHeld * (currentPrice - prevPrice) : null;
  const dailyChangePct = prevPrice ? ((currentPrice - prevPrice) / prevPrice) * 100 : null;
  const netProfit = currentValue - netInvested;
  const netProfitPct = netInvested ? (netProfit / netInvested) * 100 : 0;
  const cfs = s.transactions.map((t) => ({ date: new Date(t.date), amount: t.type === "buy" ? -t.qty * t.price : t.qty * t.price }));
  const asOf = prices.length ? new Date(prices[prices.length - 1].date) : new Date();
  cfs.push({ date: asOf, amount: currentValue });
  cfs.sort((a, b) => a.date - b.date);
  const rate = xirr(cfs);
  return { qtyHeld, avgBuyPrice, netInvested, currentPrice, currentValue, dailyChange, dailyChangePct, netProfit, netProfitPct, xirrPct: rate !== null ? rate * 100 : null, prices };
}

// ---- EMI / Loans — supports either a reducing-balance interest rate OR a
// fixed total-to-return (for interest-free / Sharia-compliant arrangements).
function emiSchedule(loan) {
  const n = loan.tenureMonths;
  if (loan.repaymentMode === "fixedTotal") {
    const total = loan.totalToReturn;
    const installment = total / n;
    const principalPerMonth = loan.principal / n;
    const markupPerMonth = (total - loan.principal) / n;
    let balance = loan.principal;
    const rows = [];
    for (let m = 1; m <= n; m++) {
      balance = Math.max(0, balance - principalPerMonth);
      rows.push({ month: m, emi: installment, interest: markupPerMonth, principalComp: principalPerMonth, balance });
    }
    return { emi: installment, rows };
  }
  const r = loan.annualRatePct / 12 / 100;
  const emi = r === 0 ? loan.principal / n : (loan.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let balance = loan.principal;
  const rows = [];
  for (let m = 1; m <= n; m++) {
    const interest = balance * r;
    const principalComp = emi - interest;
    balance = Math.max(0, balance - principalComp);
    rows.push({ month: m, emi, interest, principalComp, balance });
  }
  return { emi, rows };
}
function emiSummary(loan) {
  const { emi, rows } = emiSchedule(loan);
  const start = new Date(loan.startDate);
  const now = new Date();
  let elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  elapsed = Math.max(0, Math.min(elapsed, loan.tenureMonths));
  const outstanding = elapsed === 0 ? loan.principal : rows[elapsed - 1].balance;
  const paidSoFar = elapsed * emi;
  const interestSoFar = rows.slice(0, elapsed).reduce((s, r) => s + r.interest, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const monthsRemaining = loan.tenureMonths - elapsed;
  return { emi, outstanding, paidSoFar, interestSoFar, totalInterest, monthsRemaining, elapsed, rows };
}

// ---- Personal Expenses ----
const EXPENSE_CATEGORIES = ["Food", "Transport", "Utilities", "Rent", "Entertainment", "Health", "Shopping", "Other"];
// Budgets are denominated in a single "budget currency" (the default currency);
// only expenses logged in that same currency count toward the budget bars —
// other-currency spending is still logged and totalled, just shown separately.
function expenseStatsForMonth(expenses, budgets, mKey, budgetCurrency) {
  const inMonth = expenses.filter((e) => monthKey(e.date) === mKey);
  const inBudgetCcy = inMonth.filter((e) => e.currencyCode === budgetCurrency);
  const otherCcy = inMonth.filter((e) => e.currencyCode !== budgetCurrency);
  const byCategory = {};
  EXPENSE_CATEGORIES.forEach((c) => (byCategory[c] = 0));
  inBudgetCcy.forEach((e) => (byCategory[e.category] = (byCategory[e.category] || 0) + e.amount));
  const totalSpent = inBudgetCcy.reduce((s, e) => s + e.amount, 0);
  const totalBudget = Object.values(budgets).reduce((s, v) => s + Number(v || 0), 0);
  const otherTotals = sumByCurrency(otherCcy, (e) => e.currencyCode, (e) => e.amount);
  return { byCategory, totalSpent, totalBudget, inMonth, otherTotals };
}

// ---- Personal Loans (both directions, no category by design) ----
function loanOutstanding(loan) {
  const repaid = loan.repayments.reduce((s, r) => s + r.amount, 0);
  return Math.max(0, loan.principal - repaid);
}

/* ============================== demo data ============================== */

const demoMF = [
  { id: "mf1", name: "Vanguard Total World Stock ETF", code: "VT", platform: "Fidelity", category: "Equity", currencyCode: "USD", themeGradient: ["#1F8A5C", "#8FCBA8"],
    transactions: [{ id: uid(), date: "2024-03-10", amount: 5000, type: "invest" }, { id: uid(), date: "2024-09-15", amount: 2000, type: "invest" }, { id: uid(), date: "2025-03-10", amount: 2000, type: "invest" }],
    balances: [{ date: "2024-03-10", value: 5000 }, { date: "2024-12-31", value: 8200 }, { date: "2025-06-30", value: 11500 }, { date: "2026-06-30", value: 14200 }, { date: "2026-07-05", value: 14350 }] },
  { id: "mf2", name: "Al Rajhi GCC Equity Fund", code: "ARGCC", platform: "Al Rajhi Capital", category: "Equity", currencyCode: "SAR", themeGradient: ["#3B5BDB", "#8FA6EE"],
    transactions: [{ id: uid(), date: "2024-06-01", amount: 20000, type: "invest" }],
    balances: [{ date: "2024-06-01", value: 20000 }, { date: "2025-06-30", value: 23800 }, { date: "2026-06-30", value: 26750 }, { date: "2026-07-05", value: 27050 }] },
];

const demoSS = [
  { id: "s1", name: "Apple Inc.", ticker: "AAPL", platform: "Charles Schwab", currencyCode: "USD", themeGradient: ["#0E8E8E", "#8FD4D4"],
    transactions: [{ id: uid(), date: "2024-05-10", qty: 10, price: 185, type: "buy" }, { id: uid(), date: "2025-01-15", qty: 5, price: 195, type: "buy" }],
    prices: [{ date: "2024-05-10", price: 185 }, { date: "2025-06-30", price: 205 }, { date: "2026-07-05", price: 214 }] },
  { id: "s2", name: "Emaar Properties", ticker: "EMAAR", platform: "ADCB Securities", currencyCode: "AED", themeGradient: ["#6C4FA0", "#C3A8DC"],
    transactions: [{ id: uid(), date: "2024-08-01", qty: 200, price: 6.2, type: "buy" }],
    prices: [{ date: "2024-08-01", price: 6.2 }, { date: "2025-06-30", price: 7.1 }, { date: "2026-07-05", price: 7.4 }] },
];

const demoEMI = [
  { id: "e1", name: "Home Mortgage", lender: "Chase Bank", currencyCode: "USD", principal: 320000, repaymentMode: "interest", annualRatePct: 6.4, tenureMonths: 360, startDate: "2023-01-05" },
  { id: "e2", name: "Car Financing (Islamic)", lender: "Dubai Islamic Bank", currencyCode: "AED", principal: 90000, repaymentMode: "fixedTotal", totalToReturn: 102000, tenureMonths: 48, startDate: "2024-11-01" },
];

const demoExpenses = [
  { id: uid(), date: "2026-06-04", category: "Food", amount: 220, note: "Groceries", currencyCode: "USD" },
  { id: uid(), date: "2026-06-10", category: "Rent", amount: 1800, note: "", currencyCode: "USD" },
  { id: uid(), date: "2026-06-15", category: "Transport", amount: 90, note: "Fuel", currencyCode: "USD" },
  { id: uid(), date: "2026-07-02", category: "Food", amount: 260, note: "Groceries", currencyCode: "USD" },
  { id: uid(), date: "2026-07-05", category: "Utilities", amount: 140, note: "Electricity", currencyCode: "USD" },
  { id: uid(), date: "2026-07-06", category: "Shopping", amount: 90, note: "Eid gifts", currencyCode: "AED" },
];
const demoBudgets = { Food: 700, Transport: 200, Utilities: 250, Rent: 1800, Entertainment: 150, Health: 150, Shopping: 250, Other: 200 };

const demoLoans = [
  { id: "l1", person: "Bilal (friend)", direction: "owed_to_me", currencyCode: "PKR", principal: 50000, date: "2026-03-01", note: "Lent for bike repair", repayments: [{ date: "2026-05-01", amount: 15000 }] },
  { id: "l2", person: "Personal Loan — local bank", direction: "i_owe", currencyCode: "EUR", principal: 4000, date: "2025-09-01", note: "", repayments: [{ date: "2025-12-01", amount: 500 }, { date: "2026-03-01", amount: 500 }] },
];

/* ============================== shared UI ============================== */

function GainText({ value, pct, symbol = "$", size = "md" }) {
  const positive = value >= 0;
  return (
    <span className={`gain-text ${positive ? "pos" : "neg"} ${size}`}>
      {positive ? <TrendingUp size={size === "lg" ? 16 : 13} /> : <TrendingDown size={size === "lg" ? 16 : 13} />}
      <span className="mono">{fmtMoney(value, symbol)}</span>
      {pct !== null && pct !== undefined && <span className="mono muted-pct">({fmtPct(pct)})</span>}
    </span>
  );
}

function Avatar({ gradient, name, size = 40 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})` }}>
      {initials(name)}
    </div>
  );
}

function ProgressBar({ pct, color }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

// Renders a { currencyCode: amount } map as one chip per currency present —
// used anywhere entities of different currencies are aggregated together.
function MultiCurrency({ map, colorForValue, size }) {
  const entries = Object.entries(map || {});
  if (entries.length === 0) return <span className="mono">{fmtMoney(0)}</span>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
      {entries.map(([code, val]) => (
        <span key={code} className="mono" style={{ fontSize: size, color: colorForValue ? colorForValue(val) : undefined }}>
          {fmtMoney(val, sym(code))}
        </span>
      ))}
    </span>
  );
}

// Generic bottom-sheet form modal driven by a field-config array.
// Supports select fields with {value,label} options and per-field showIf().
function FormModal({ open, title, accent, fields, onCancel, onSubmit }) {
  const initial = () => Object.fromEntries(fields.map((f) => [f.key, f.default !== undefined ? f.default : ""]));
  const [values, setValues] = useState(initial);
  useEffect(() => { if (open) setValues(initial()); }, [open]); // eslint-disable-line

  if (!open) return null;
  const visible = (f) => !f.showIf || f.showIf(values);
  const canSubmit = fields.every((f) => !visible(f) || !f.required || (values[f.key] !== "" && values[f.key] !== undefined));

  function submit() {
    if (!canSubmit) return;
    const parsed = { ...values };
    fields.forEach((f) => { if (f.type === "number" && visible(f)) parsed[f.key] = Number(values[f.key]); });
    onSubmit(parsed);
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onCancel}><X size={18} /></button>
        <div className="sheet-title" style={{ color: accent }}>{title}</div>
        {fields.filter(visible).map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            {f.type === "select" ? (
              <select value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                {f.options.map((o) => {
                  const val = typeof o === "object" ? o.value : o;
                  const lab = typeof o === "object" ? o.label : o;
                  return <option key={val} value={val}>{lab}</option>;
                })}
              </select>
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={values[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
        <div className="sheet-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-fill" style={{ background: accent }} disabled={!canSubmit} onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ScreenHeader({ title, accent, onAdd, addLabel = "Add" }) {
  return (
    <div className="screen-header">
      <h2 style={{ color: accent }}>{title}</h2>
      <button className="btn btn-fill btn-sm" style={{ background: accent }} onClick={onAdd}><Plus size={15} /> {addLabel}</button>
    </div>
  );
}

const currencyField = (defaultCurrency) => ({
  key: "currencyCode", label: "Currency", type: "select", options: CURRENCY_OPTIONS, default: defaultCurrency, required: true,
});

/* ================================ App =================================== */

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid, accent: "#3B5BDB" },
  { key: "mf", label: "Mutual Funds", icon: LineChartIcon, accent: "#1F8A5C" },
  { key: "ss", label: "Stocks", icon: BarChart3, accent: "#0E8E8E" },
  { key: "emi", label: "EMI / Loans", icon: Landmark, accent: "#B4690E" },
  { key: "expense", label: "Expenses", icon: Receipt, accent: "#C2255C" },
  { key: "loans", label: "Personal Loans", icon: HandCoins, accent: "#6C4FA0" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  const [mfFunds, setMfFunds] = useState(demoMF);
  const [stocks, setStocks] = useState(demoSS);
  const [emiLoans, setEmiLoans] = useState(demoEMI);
  const [expenses, setExpenses] = useState(demoExpenses);
  const [budgets, setBudgets] = useState(demoBudgets);
  const [pLoans, setPLoans] = useState(demoLoans);

  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600&display=swap');
        :root {
          --surface: #F7F7FB; --surface-1: #FFFFFF; --surface-2: #EFEFF7;
          --outline: #D6D5E3; --ink: #1B1B1F; --ink-muted: #5E5D6B;
          --primary: #3B5BDB; --primary-container: #E1E6FF;
        }
        * { box-sizing: border-box; }
        .app-root { background: var(--surface); min-height: 100%; font-family: 'Roboto', sans-serif; color: var(--ink); padding-bottom: 40px; }
        .mono { font-family: 'Roboto Mono', monospace; font-variant-numeric: tabular-nums; }
        .top-appbar { background: var(--surface-1); padding: 18px 20px 0; position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .appbar-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .appbar-title { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .appbar-sub { font-size: 11px; color: var(--ink-muted); margin-bottom: 10px; }
        .currency-select { border: 1px solid var(--outline); background: var(--surface-2); color: var(--ink); border-radius: 20px; padding: 6px 12px; font-family: 'Roboto Mono', monospace; font-size: 12px; cursor: pointer; }
        .tabs-row { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .tabs-row::-webkit-scrollbar { display: none; }
        .tab-btn { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border: none; background: none; font-family: 'Roboto', sans-serif; font-size: 13px; font-weight: 500; color: var(--ink-muted); cursor: pointer; white-space: nowrap; border-bottom: 3px solid transparent; flex-shrink: 0; }
        .tab-btn.active { color: var(--ink); }
        .container { max-width: 720px; margin: 0 auto; padding: 20px; }
        .card { background: var(--surface-1); border-radius: 18px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); margin-bottom: 16px; }
        .card-title { font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-muted); margin-bottom: 10px; }
        .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .stat-tile { background: var(--surface-2); border-radius: 14px; padding: 14px; }
        .stat-tile-label { font-size: 11px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px; }
        .stat-tile-value { font-size: 18px; font-weight: 700; font-family: 'Roboto Mono', monospace; }
        .module-card { background: var(--surface-1); border-radius: 18px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; cursor: pointer; border-left: 5px solid transparent; gap: 12px; }
        .module-card-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .module-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
        .module-name { font-weight: 600; font-size: 14.5px; }
        .module-sub { font-size: 12px; color: var(--ink-muted); margin-top: 2px; }
        .screen-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .screen-header h2 { font-size: 18px; font-weight: 700; margin: 0; }
        .btn { border: 1px solid var(--outline); background: var(--surface-1); color: var(--ink); border-radius: 24px; padding: 9px 16px; font-family: 'Roboto'; font-size: 13.5px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .btn-sm { padding: 8px 14px; font-size: 13px; }
        .btn-fill { color: #fff; border: none; }
        .btn-fill:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn-danger { color: #B3261E; border-color: #B3261E; }
        .row-item { display: flex; justify-content: space-between; align-items: center; background: var(--surface-1); border-radius: 16px; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; gap: 10px; }
        .row-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .avatar { border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .row-name { font-weight: 600; font-size: 14.5px; }
        .row-sub { font-size: 12px; color: var(--ink-muted); margin-top: 2px; }
        .row-right { text-align: right; flex-shrink: 0; }
        .row-value { font-family: 'Roboto Mono', monospace; font-size: 14px; font-weight: 600; }
        .gain-text { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
        .gain-text.pos { color: #1F8A5C; } .gain-text.neg { color: #B3261E; }
        .gain-text.lg { font-size: 17px; }
        .muted-pct { color: var(--ink-muted); font-size: 0.88em; }
        .progress-track { height: 8px; background: var(--surface-2); border-radius: 6px; overflow: hidden; margin-top: 6px; }
        .progress-fill { height: 100%; border-radius: 6px; }
        .empty-state { text-align: center; padding: 50px 20px; color: var(--ink-muted); background: var(--surface-1); border-radius: 18px; }
        .empty-state h3 { font-size: 15px; color: var(--ink); margin-bottom: 6px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-muted); font-size: 13.5px; background: none; border: none; cursor: pointer; margin-bottom: 14px; padding: 0; }
        .overlay { position: fixed; inset: 0; background: rgba(20,20,30,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 50; }
        @media (min-width: 640px) { .overlay { align-items: center; } }
        .sheet { background: var(--surface-1); width: 100%; max-width: 440px; border-radius: 24px 24px 0 0; padding: 24px; position: relative; max-height: 88vh; overflow-y: auto; }
        @media (min-width: 640px) { .sheet { border-radius: 24px; } }
        .sheet-close { position: absolute; top: 18px; right: 18px; background: none; border: none; color: var(--ink-muted); cursor: pointer; }
        .sheet-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
        .field { margin-bottom: 13px; }
        .field label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink-muted); margin-bottom: 5px; }
        .field input, .field select { width: 100%; padding: 10px 12px; border: 1px solid var(--outline); border-radius: 10px; background: var(--surface); font-family: 'Roboto'; font-size: 14px; color: var(--ink); }
        .sheet-actions { display: flex; gap: 10px; margin-top: 16px; }
        .sheet-actions .btn { flex: 1; justify-content: center; }
        .table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table th { text-align: left; font-size: 10.5px; text-transform: uppercase; color: var(--ink-muted); padding: 6px 8px; border-bottom: 1px solid var(--outline); font-weight: 600; }
        .table td { padding: 9px 8px; border-bottom: 1px solid var(--surface-2); }
        .ta-right { text-align: right; }
      `}</style>

      <div className="top-appbar">
        <div className="appbar-row">
          <div>
            <div className="appbar-title">Finance Suite</div>
          </div>
          <select className="currency-select" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} title="Default currency for new entries">
            {CURRENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="appbar-sub">Each entry keeps its own currency — this just pre-fills new entries.</div>
        <div className="tabs-row">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} className={`tab-btn ${active ? "active" : ""}`} style={active ? { borderBottomColor: t.accent, color: t.accent } : {}} onClick={() => { setTab(t.key); setSelected(null); }}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="container">
        {tab === "dashboard" && <DashboardScreen mfFunds={mfFunds} stocks={stocks} emiLoans={emiLoans} expenses={expenses} budgets={budgets} pLoans={pLoans} defaultCurrency={defaultCurrency} onNavigate={setTab} />}
        {tab === "mf" && <MFScreen funds={mfFunds} setFunds={setMfFunds} selected={selected} setSelected={setSelected} modal={modal} setModal={setModal} defaultCurrency={defaultCurrency} />}
        {tab === "ss" && <SSScreen stocks={stocks} setStocks={setStocks} selected={selected} setSelected={setSelected} modal={modal} setModal={setModal} defaultCurrency={defaultCurrency} />}
        {tab === "emi" && <EMIScreen loans={emiLoans} setLoans={setEmiLoans} selected={selected} setSelected={setSelected} modal={modal} setModal={setModal} defaultCurrency={defaultCurrency} />}
        {tab === "expense" && <ExpenseScreen expenses={expenses} setExpenses={setExpenses} budgets={budgets} setBudgets={setBudgets} modal={modal} setModal={setModal} defaultCurrency={defaultCurrency} />}
        {tab === "loans" && <LoansScreen loans={pLoans} setLoans={setPLoans} selected={selected} setSelected={setSelected} modal={modal} setModal={setModal} defaultCurrency={defaultCurrency} />}
      </div>
    </div>
  );
}

/* ============================== Dashboard ============================== */

function DashboardScreen({ mfFunds, stocks, emiLoans, expenses, budgets, pLoans, defaultCurrency, onNavigate }) {
  const mfValueByCcy = sumByCurrency(mfFunds, (f) => f.currencyCode, (f) => fundMetrics(f).currentValue);
  const mfInvestedByCcy = sumByCurrency(mfFunds, (f) => f.currencyCode, (f) => fundMetrics(f).netInvested);
  const ssValueByCcy = sumByCurrency(stocks, (s) => s.currencyCode, (s) => stockMetrics(s).currentValue);
  const ssInvestedByCcy = sumByCurrency(stocks, (s) => s.currencyCode, (s) => stockMetrics(s).netInvested);
  const emiOutstandingByCcy = sumByCurrency(emiLoans, (l) => l.currencyCode, (l) => emiSummary(l).outstanding);
  const owedToMeByCcy = sumByCurrency(pLoans.filter((l) => l.direction === "owed_to_me"), (l) => l.currencyCode, loanOutstanding);
  const iOweByCcy = sumByCurrency(pLoans.filter((l) => l.direction === "i_owe"), (l) => l.currencyCode, loanOutstanding);

  const assetsByCcy = mergeCurrencyMaps(mfValueByCcy, ssValueByCcy, owedToMeByCcy);
  const liabilitiesByCcy = mergeCurrencyMaps(emiOutstandingByCcy, iOweByCcy);
  const netWorthByCcy = subtractCurrencyMaps(assetsByCcy, liabilitiesByCcy);
  const gainsByCcy = subtractCurrencyMaps(mergeCurrencyMaps(mfValueByCcy, ssValueByCcy), mergeCurrencyMaps(mfInvestedByCcy, ssInvestedByCcy));

  const { totalSpent, totalBudget } = expenseStatsForMonth(expenses, budgets, monthKey(todayStr()), defaultCurrency);

  return (
    <div>
      <div className="card" style={{ background: "linear-gradient(135deg, #3B5BDB, #6C4FA0)", color: "#fff" }}>
        <div className="card-title" style={{ color: "rgba(255,255,255,0.75)" }}>Net Worth (by currency)</div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", display: "flex", flexWrap: "wrap", gap: 14 }}>
          <MultiCurrency map={netWorthByCcy} />
        </div>
        <div style={{ fontSize: 12.5, marginTop: 8, color: "rgba(255,255,255,0.85)" }}>
          No currency conversion is applied — totals are grouped per currency, not blended into one.
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-tile">
          <div className="stat-tile-label">Investment Gains</div>
          <MultiCurrency map={gainsByCcy} colorForValue={(v) => (v >= 0 ? "#1F8A5C" : "#B3261E")} size={15} />
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">This Month Spent ({defaultCurrency})</div>
          <div className="stat-tile-value">{fmtMoney(totalSpent, sym(defaultCurrency))} <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>/ {fmtMoney(totalBudget, sym(defaultCurrency))}</span></div>
        </div>
      </div>

      <ModuleCard accent="#1F8A5C" icon={LineChartIcon} title="Mutual Funds" sub={`${mfFunds.length} fund${mfFunds.length !== 1 ? "s" : ""}`} valueNode={<MultiCurrency map={mfValueByCcy} size={13.5} />} onClick={() => onNavigate("mf")} />
      <ModuleCard accent="#0E8E8E" icon={BarChart3} title="Stock Shares" sub={`${stocks.length} holding${stocks.length !== 1 ? "s" : ""}`} valueNode={<MultiCurrency map={ssValueByCcy} size={13.5} />} onClick={() => onNavigate("ss")} />
      <ModuleCard accent="#B4690E" icon={Landmark} title="EMI / Loans" sub={`${emiLoans.length} active loan${emiLoans.length !== 1 ? "s" : ""}`} valueNode={<MultiCurrency map={Object.fromEntries(Object.entries(emiOutstandingByCcy).map(([c, v]) => [c, -v]))} colorForValue={() => "#B3261E"} size={13.5} />} onClick={() => onNavigate("emi")} />
      <ModuleCard accent="#C2255C" icon={Receipt} title="Expenses" sub="This month" valueNode={<span className="mono" style={{ fontSize: 13.5, color: "#B3261E" }}>{fmtMoney(-totalSpent, sym(defaultCurrency))}</span>} onClick={() => onNavigate("expense")} />
      <ModuleCard accent="#6C4FA0" icon={HandCoins} title="Personal Loans" sub="Owed to me vs. I owe" valueNode={<MultiCurrency map={subtractCurrencyMaps(owedToMeByCcy, iOweByCcy)} colorForValue={(v) => (v >= 0 ? "#1F8A5C" : "#B3261E")} size={13.5} />} onClick={() => onNavigate("loans")} />
    </div>
  );
}

function ModuleCard({ accent, icon: Icon, title, sub, valueNode, onClick }) {
  return (
    <div className="module-card" style={{ borderLeftColor: accent }} onClick={onClick}>
      <div className="module-card-left">
        <div className="module-icon" style={{ background: accent }}><Icon size={20} /></div>
        <div><div className="module-name">{title}</div><div className="module-sub">{sub}</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {valueNode}
        <ChevronRight size={16} color="var(--ink-muted)" />
      </div>
    </div>
  );
}

/* ============================== Mutual Funds ============================== */

function MFScreen({ funds, setFunds, selected, setSelected, modal, setModal, defaultCurrency }) {
  const accent = "#1F8A5C";
  const fund = funds.find((f) => f.id === selected);

  function addFund(data) {
    setFunds((fs) => [...fs, {
      id: uid(), name: data.name, code: data.code, platform: data.platform, category: data.category, currencyCode: data.currencyCode,
      themeGradient: randomGradient(),
      transactions: [{ id: uid(), date: data.date, amount: Number(data.amount), type: "invest" }],
      balances: [{ date: data.date, value: Number(data.amount) }],
    }]);
    setModal(null);
  }
  function addTxn(data) {
    setFunds((fs) => fs.map((f) => f.id === selected ? { ...f, transactions: [...f.transactions, { id: uid(), date: data.date, amount: Number(data.amount), type: data.type }] } : f));
    setModal(null);
  }
  function addBalance(data) {
    setFunds((fs) => fs.map((f) => {
      if (f.id !== selected) return f;
      const rest = f.balances.filter((b) => b.date !== data.date);
      return { ...f, balances: [...rest, { date: data.date, value: Number(data.value) }] };
    }));
    setModal(null);
  }
  function removeFund(id) { setFunds((fs) => fs.filter((f) => f.id !== id)); setSelected(null); }

  if (fund) {
    const symbol = sym(fund.currencyCode);
    const m = fundMetrics(fund);
    const chartData = m.balances.map((b) => ({ label: fmtDate(b.date), value: b.value }));
    return (
      <div>
        <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={15} /> All funds</button>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar gradient={fund.themeGradient} name={fund.name} size={48} />
              <div><div style={{ fontWeight: 700, fontSize: 16 }}>{fund.name}</div><div className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{fund.code} · {fund.platform} · {fund.category} · {fund.currencyCode}</div></div>
            </div>
            <button className="btn btn-danger" onClick={() => removeFund(fund.id)}><Trash2 size={14} /></button>
          </div>
          <div className="stat-grid">
            <div className="stat-tile"><div className="stat-tile-label">Net Invested</div><div className="stat-tile-value">{fmtMoney(m.netInvested, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Current Value</div><div className="stat-tile-value">{fmtMoney(m.currentValue, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Net Profit</div><GainText value={m.netProfit} pct={m.netProfitPct} symbol={symbol} size="lg" /></div>
            <div className="stat-tile"><div className="stat-tile-label">XIRR</div><div className="stat-tile-value">{m.xirrPct !== null ? fmtPct(m.xirrPct) : "—"}</div></div>
          </div>
        </div>
        {chartData.length > 1 && (
          <div className="card">
            <div className="card-title">Balance Over Time</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#EFEFF7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v / 1000).toFixed(1) + "k"} />
                <Tooltip formatter={(v) => fmtMoney(v, symbol)} />
                <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="screen-header"><h2 style={{ fontSize: 15 }}>Transactions</h2><button className="btn btn-sm" onClick={() => setModal("txn")}><Plus size={14} /> Add</button></div>
        <table className="table"><thead><tr><th>Date</th><th>Type</th><th className="ta-right">Amount</th></tr></thead>
          <tbody>{[...fund.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).map((t) => (
            <tr key={t.id}><td>{fmtDate(t.date)}</td><td>{t.type === "invest" ? "Invested" : "Withdrawn"}</td><td className="ta-right mono">{fmtMoney(t.amount, symbol)}</td></tr>
          ))}</tbody>
        </table>
        <div className="screen-header" style={{ marginTop: 20 }}><h2 style={{ fontSize: 15 }}>Balance Updates</h2><button className="btn btn-sm" onClick={() => setModal("balance")}><Plus size={14} /> Update</button></div>
        <table className="table"><thead><tr><th>Date</th><th className="ta-right">Balance</th></tr></thead>
          <tbody>{[...m.balances].sort((a, b) => new Date(b.date) - new Date(a.date)).map((b, i) => (
            <tr key={i}><td>{fmtDate(b.date)}</td><td className="ta-right mono">{fmtMoney(b.value, symbol)}</td></tr>
          ))}</tbody>
        </table>

        <FormModal open={modal === "txn"} title="Add transaction" accent={accent} onCancel={() => setModal(null)} onSubmit={addTxn}
          fields={[
            { key: "type", label: "Type", type: "select", options: ["invest", "withdraw"], default: "invest", required: true },
            { key: "date", label: "Date", type: "date", default: todayStr(), required: true },
            { key: "amount", label: "Amount", type: "number", placeholder: "1000", required: true },
          ]} />
        <FormModal open={modal === "balance"} title="Update balance" accent={accent} onCancel={() => setModal(null)} onSubmit={addBalance}
          fields={[
            { key: "date", label: "Date", type: "date", default: todayStr(), required: true },
            { key: "value", label: "Current balance", type: "number", placeholder: "14350", required: true },
          ]} />
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Mutual Funds" accent={accent} onAdd={() => setModal("fund")} addLabel="Add fund" />
      {funds.length === 0 ? <div className="empty-state"><h3>No funds yet</h3><p>Add your first mutual fund to start tracking it.</p></div> :
        funds.map((f) => {
          const m = fundMetrics(f);
          const symbol = sym(f.currencyCode);
          return (
            <div className="row-item" key={f.id} onClick={() => setSelected(f.id)}>
              <div className="row-left">
                <Avatar gradient={f.themeGradient} name={f.name} />
                <div><div className="row-name">{f.name}</div><div className="row-sub">{f.code} · {f.category} · {f.currencyCode}</div></div>
              </div>
              <div className="row-right">
                <div className="row-value">{fmtMoney(m.currentValue, symbol)}</div>
                <GainText value={m.netProfit} pct={m.netProfitPct} symbol={symbol} />
              </div>
            </div>
          );
        })}
      <FormModal open={modal === "fund"} title="Add mutual fund" accent={accent} onCancel={() => setModal(null)} onSubmit={addFund}
        fields={[
          { key: "name", label: "Fund name", placeholder: "e.g. Vanguard Total World Stock ETF", required: true },
          { key: "code", label: "Fund code", placeholder: "e.g. VT", required: true },
          { key: "platform", label: "Invested via", placeholder: "e.g. Fidelity", required: true },
          { key: "category", label: "Category", type: "select", options: ["Equity", "Debt", "Hybrid", "International", "Other"], default: "Equity", required: true },
          currencyField(defaultCurrency),
          { key: "date", label: "Initial investment date", type: "date", default: todayStr(), required: true },
          { key: "amount", label: "Amount invested", type: "number", placeholder: "5000", required: true },
        ]} />
    </div>
  );
}

/* ============================== Stock Shares ============================== */

function SSScreen({ stocks, setStocks, selected, setSelected, modal, setModal, defaultCurrency }) {
  const accent = "#0E8E8E";
  const stock = stocks.find((s) => s.id === selected);

  function addStock(data) {
    setStocks((ss) => [...ss, {
      id: uid(), name: data.name, ticker: data.ticker, platform: data.platform, currencyCode: data.currencyCode, themeGradient: randomGradient(),
      transactions: [{ id: uid(), date: data.date, qty: Number(data.qty), price: Number(data.price), type: "buy" }],
      prices: [{ date: data.date, price: Number(data.price) }],
    }]);
    setModal(null);
  }
  function addTxn(data) {
    setStocks((ss) => ss.map((s) => s.id === selected ? { ...s, transactions: [...s.transactions, { id: uid(), date: data.date, qty: Number(data.qty), price: Number(data.price), type: data.type }] } : s));
    setModal(null);
  }
  function addPrice(data) {
    setStocks((ss) => ss.map((s) => {
      if (s.id !== selected) return s;
      const rest = s.prices.filter((p) => p.date !== data.date);
      return { ...s, prices: [...rest, { date: data.date, price: Number(data.price) }] };
    }));
    setModal(null);
  }
  function removeStock(id) { setStocks((ss) => ss.filter((s) => s.id !== id)); setSelected(null); }

  if (stock) {
    const symbol = sym(stock.currencyCode);
    const m = stockMetrics(stock);
    const chartData = m.prices.map((p) => ({ label: fmtDate(p.date), value: p.price }));
    return (
      <div>
        <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={15} /> All holdings</button>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar gradient={stock.themeGradient} name={stock.name} size={48} />
              <div><div style={{ fontWeight: 700, fontSize: 16 }}>{stock.name}</div><div className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{stock.ticker} · {stock.platform} · {stock.currencyCode}</div></div>
            </div>
            <button className="btn btn-danger" onClick={() => removeStock(stock.id)}><Trash2 size={14} /></button>
          </div>
          <div className="stat-grid">
            <div className="stat-tile"><div className="stat-tile-label">Qty Held</div><div className="stat-tile-value">{m.qtyHeld}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Avg Buy Price</div><div className="stat-tile-value">{fmtMoney(m.avgBuyPrice, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Current Price</div><div className="stat-tile-value">{fmtMoney(m.currentPrice, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Current Value</div><div className="stat-tile-value">{fmtMoney(m.currentValue, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Net Profit</div><GainText value={m.netProfit} pct={m.netProfitPct} symbol={symbol} size="lg" /></div>
            <div className="stat-tile"><div className="stat-tile-label">XIRR</div><div className="stat-tile-value">{m.xirrPct !== null ? fmtPct(m.xirrPct) : "—"}</div></div>
          </div>
        </div>
        {chartData.length > 1 && (
          <div className="card">
            <div className="card-title">Price Over Time</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#EFEFF7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip formatter={(v) => fmtMoney(v, symbol)} />
                <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="screen-header"><h2 style={{ fontSize: 15 }}>Transactions</h2><button className="btn btn-sm" onClick={() => setModal("txn")}><Plus size={14} /> Add</button></div>
        <table className="table"><thead><tr><th>Date</th><th>Type</th><th className="ta-right">Qty</th><th className="ta-right">Price</th></tr></thead>
          <tbody>{[...stock.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).map((t) => (
            <tr key={t.id}><td>{fmtDate(t.date)}</td><td>{t.type === "buy" ? "Buy" : "Sell"}</td><td className="ta-right mono">{t.qty}</td><td className="ta-right mono">{fmtMoney(t.price, symbol)}</td></tr>
          ))}</tbody>
        </table>
        <div className="screen-header" style={{ marginTop: 20 }}><h2 style={{ fontSize: 15 }}>Price Updates</h2><button className="btn btn-sm" onClick={() => setModal("price")}><Plus size={14} /> Update</button></div>
        <table className="table"><thead><tr><th>Date</th><th className="ta-right">Price</th></tr></thead>
          <tbody>{[...m.prices].sort((a, b) => new Date(b.date) - new Date(a.date)).map((p, i) => (
            <tr key={i}><td>{fmtDate(p.date)}</td><td className="ta-right mono">{fmtMoney(p.price, symbol)}</td></tr>
          ))}</tbody>
        </table>

        <FormModal open={modal === "txn"} title="Add transaction" accent={accent} onCancel={() => setModal(null)} onSubmit={addTxn}
          fields={[
            { key: "type", label: "Type", type: "select", options: ["buy", "sell"], default: "buy", required: true },
            { key: "date", label: "Date", type: "date", default: todayStr(), required: true },
            { key: "qty", label: "Quantity", type: "number", placeholder: "10", required: true },
            { key: "price", label: "Price per share", type: "number", placeholder: "200", required: true },
          ]} />
        <FormModal open={modal === "price"} title="Update current price" accent={accent} onCancel={() => setModal(null)} onSubmit={addPrice}
          fields={[
            { key: "date", label: "Date", type: "date", default: todayStr(), required: true },
            { key: "price", label: "Price per share", type: "number", placeholder: "214", required: true },
          ]} />
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Stock Shares" accent={accent} onAdd={() => setModal("stock")} addLabel="Add stock" />
      {stocks.length === 0 ? <div className="empty-state"><h3>No holdings yet</h3><p>Add your first stock to start tracking it.</p></div> :
        stocks.map((s) => {
          const m = stockMetrics(s);
          const symbol = sym(s.currencyCode);
          return (
            <div className="row-item" key={s.id} onClick={() => setSelected(s.id)}>
              <div className="row-left">
                <Avatar gradient={s.themeGradient} name={s.name} />
                <div><div className="row-name">{s.name}</div><div className="row-sub mono">{s.ticker} · {m.qtyHeld} sh · {s.currencyCode}</div></div>
              </div>
              <div className="row-right">
                <div className="row-value">{fmtMoney(m.currentValue, symbol)}</div>
                <GainText value={m.netProfit} pct={m.netProfitPct} symbol={symbol} />
              </div>
            </div>
          );
        })}
      <FormModal open={modal === "stock"} title="Add stock holding" accent={accent} onCancel={() => setModal(null)} onSubmit={addStock}
        fields={[
          { key: "name", label: "Company name", placeholder: "e.g. Apple Inc.", required: true },
          { key: "ticker", label: "Ticker", placeholder: "e.g. AAPL", required: true },
          { key: "platform", label: "Broker / platform", placeholder: "e.g. Charles Schwab", required: true },
          currencyField(defaultCurrency),
          { key: "date", label: "Purchase date", type: "date", default: todayStr(), required: true },
          { key: "qty", label: "Quantity bought", type: "number", placeholder: "10", required: true },
          { key: "price", label: "Buy price per share", type: "number", placeholder: "185", required: true },
        ]} />
    </div>
  );
}

/* ============================== EMI / Loans ============================== */

function EMIScreen({ loans, setLoans, selected, setSelected, modal, setModal, defaultCurrency }) {
  const accent = "#B4690E";
  const loan = loans.find((l) => l.id === selected);

  function addLoan(data) {
    setLoans((ls) => [...ls, {
      id: uid(), name: data.name, lender: data.lender, currencyCode: data.currencyCode,
      principal: Number(data.principal), tenureMonths: Number(data.tenure), startDate: data.date,
      repaymentMode: data.repaymentMode,
      annualRatePct: data.repaymentMode === "interest" ? Number(data.rate) : 0,
      totalToReturn: data.repaymentMode === "fixedTotal" ? Number(data.totalToReturn) : undefined,
    }]);
    setModal(null);
  }
  function removeLoan(id) { setLoans((ls) => ls.filter((l) => l.id !== id)); setSelected(null); }

  if (loan) {
    const symbol = sym(loan.currencyCode);
    const sum = emiSummary(loan);
    return (
      <div>
        <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={15} /> All loans</button>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{loan.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                {loan.lender} · {loan.currencyCode} · {loan.repaymentMode === "fixedTotal" ? "Fixed total (no interest)" : `${loan.annualRatePct}% p.a.`} · {loan.tenureMonths} months
              </div>
            </div>
            <button className="btn btn-danger" onClick={() => removeLoan(loan.id)}><Trash2 size={14} /></button>
          </div>
          <div className="stat-grid">
            <div className="stat-tile"><div className="stat-tile-label">Monthly Installment</div><div className="stat-tile-value">{fmtMoney(sum.emi, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Outstanding</div><div className="stat-tile-value">{fmtMoney(sum.outstanding, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Paid So Far</div><div className="stat-tile-value">{fmtMoney(sum.paidSoFar, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">{loan.repaymentMode === "fixedTotal" ? "Markup So Far" : "Interest So Far"}</div><div className="stat-tile-value">{fmtMoney(sum.interestSoFar, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Months Remaining</div><div className="stat-tile-value">{sum.monthsRemaining}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">{loan.repaymentMode === "fixedTotal" ? "Total Markup (Life)" : "Total Interest (Life)"}</div><div className="stat-tile-value">{fmtMoney(sum.totalInterest, symbol)}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Schedule (next 12 installments from today)</div>
          <table className="table"><thead><tr><th>#</th><th className="ta-right">Installment</th><th className="ta-right">{loan.repaymentMode === "fixedTotal" ? "Markup" : "Interest"}</th><th className="ta-right">Principal</th><th className="ta-right">Balance</th></tr></thead>
            <tbody>{sum.rows.slice(sum.elapsed, sum.elapsed + 12).map((r) => (
              <tr key={r.month}><td>#{r.month}</td><td className="ta-right mono">{fmtMoney(r.emi, symbol)}</td><td className="ta-right mono">{fmtMoney(r.interest, symbol)}</td><td className="ta-right mono">{fmtMoney(r.principalComp, symbol)}</td><td className="ta-right mono">{fmtMoney(r.balance, symbol)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="EMI / Loans" accent={accent} onAdd={() => setModal("loan")} addLabel="Add loan" />
      {loans.length === 0 ? <div className="empty-state"><h3>No loans yet</h3><p>Add a loan to auto-calculate its repayment schedule.</p></div> :
        loans.map((l) => {
          const symbol = sym(l.currencyCode);
          const sum = emiSummary(l);
          return (
            <div className="row-item" key={l.id} onClick={() => setSelected(l.id)}>
              <div className="row-left">
                <div className="avatar" style={{ width: 40, height: 40, background: accent }}>{initials(l.name)}</div>
                <div><div className="row-name">{l.name}</div><div className="row-sub">{l.lender} · {fmtMoney(sum.emi, symbol)}/mo{l.repaymentMode === "fixedTotal" ? " · no-interest" : ""}</div></div>
              </div>
              <div className="row-right">
                <div className="row-value" style={{ color: "#B3261E" }}>{fmtMoney(sum.outstanding, symbol)}</div>
                <div className="row-sub">{sum.monthsRemaining} mo left</div>
              </div>
            </div>
          );
        })}
      <FormModal open={modal === "loan"} title="Add loan" accent={accent} onCancel={() => setModal(null)} onSubmit={addLoan}
        fields={[
          { key: "name", label: "Loan name", placeholder: "e.g. Home Mortgage", required: true },
          { key: "lender", label: "Lender / bank", placeholder: "e.g. Chase Bank", required: true },
          currencyField(defaultCurrency),
          { key: "principal", label: "Principal amount", type: "number", placeholder: "320000", required: true },
          {
            key: "repaymentMode", label: "Repayment type", type: "select",
            options: [{ value: "interest", label: "Interest rate (reducing balance)" }, { value: "fixedTotal", label: "Fixed total to return (no-interest / Sharia)" }],
            default: "interest", required: true,
          },
          { key: "rate", label: "Annual interest rate (%)", type: "number", placeholder: "6.4", showIf: (v) => v.repaymentMode === "interest", required: true },
          { key: "totalToReturn", label: "Total amount to return", type: "number", placeholder: "102000", showIf: (v) => v.repaymentMode === "fixedTotal", required: true },
          { key: "tenure", label: "Tenure (months)", type: "number", placeholder: "48", required: true },
          { key: "date", label: "Start date", type: "date", default: todayStr(), required: true },
        ]} />
    </div>
  );
}

/* ============================== Expenses ============================== */

function ExpenseScreen({ expenses, setExpenses, budgets, setBudgets, modal, setModal, defaultCurrency }) {
  const accent = "#C2255C";
  const [month, setMonth] = useState(monthKey(todayStr()));
  const stats = expenseStatsForMonth(expenses, budgets, month, defaultCurrency);
  const symbol = sym(defaultCurrency);

  function addExpense(data) {
    setExpenses((es) => [...es, { id: uid(), date: data.date, category: data.category, amount: Number(data.amount), note: data.note, currencyCode: data.currencyCode }]);
    setModal(null);
  }
  function updateBudget(cat, val) { setBudgets((b) => ({ ...b, [cat]: Number(val) || 0 })); }

  return (
    <div>
      <ScreenHeader title="Expenses" accent={accent} onAdd={() => setModal("expense")} addLabel="Log expense" />
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Month</div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ border: "1px solid var(--outline)", borderRadius: 8, padding: "6px 10px", fontFamily: "'Roboto Mono', monospace", fontSize: 12.5 }} />
        </div>
        <div className="stat-grid">
          <div className="stat-tile"><div className="stat-tile-label">Total Spent ({defaultCurrency})</div><div className="stat-tile-value">{fmtMoney(stats.totalSpent, symbol)}</div></div>
          <div className="stat-tile"><div className="stat-tile-label">Total Budget</div><div className="stat-tile-value">{fmtMoney(stats.totalBudget, symbol)}</div></div>
        </div>
        {Object.keys(stats.otherTotals).length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-muted)" }}>
            Also spent this month in other currencies: <MultiCurrency map={stats.otherTotals} size={12} /> (not counted toward the {defaultCurrency} budgets below)
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Budget by Category ({defaultCurrency})</div>
        {EXPENSE_CATEGORIES.map((c) => {
          const spent = stats.byCategory[c] || 0;
          const budget = Number(budgets[c] || 0);
          const pct = budget ? (spent / budget) * 100 : 0;
          const over = budget && spent > budget;
          return (
            <div key={c} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                <span style={{ fontWeight: 500 }}>{c}</span>
                <span className="mono" style={{ color: over ? "#B3261E" : "var(--ink-muted)" }}>{fmtMoney(spent, symbol)} / {fmtMoney(budget, symbol)}</span>
              </div>
              <ProgressBar pct={pct} color={over ? "#B3261E" : accent} />
              <input type="number" value={budgets[c]} onChange={(e) => updateBudget(c, e.target.value)} style={{ marginTop: 6, width: 110, border: "1px solid var(--outline)", borderRadius: 8, padding: "4px 8px", fontSize: 11.5, fontFamily: "'Roboto Mono', monospace" }} />
            </div>
          );
        })}
      </div>

      <div className="card-title" style={{ padding: "0 4px" }}>Recent Entries</div>
      {[...stats.inMonth].sort((a, b) => new Date(b.date) - new Date(a.date)).map((e) => (
        <div className="row-item" key={e.id} style={{ cursor: "default" }}>
          <div className="row-left">
            <div className="avatar" style={{ width: 36, height: 36, background: accent, fontSize: 11 }}>{e.category.slice(0, 2).toUpperCase()}</div>
            <div><div className="row-name">{e.category}</div><div className="row-sub">{fmtDate(e.date)}{e.note ? " · " + e.note : ""}</div></div>
          </div>
          <div className="row-value">{fmtMoney(e.amount, sym(e.currencyCode))}</div>
        </div>
      ))}

      <FormModal open={modal === "expense"} title="Log an expense" accent={accent} onCancel={() => setModal(null)} onSubmit={addExpense}
        fields={[
          { key: "date", label: "Date", type: "date", default: todayStr(), required: true },
          { key: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES, default: "Food", required: true },
          currencyField(defaultCurrency),
          { key: "amount", label: "Amount", type: "number", placeholder: "50", required: true },
          { key: "note", label: "Note (optional)", placeholder: "e.g. groceries" },
        ]} />
    </div>
  );
}

/* ============================== Personal Loans (no category, both directions) ============================== */

function LoansScreen({ loans, setLoans, selected, setSelected, modal, setModal, defaultCurrency }) {
  const accent = "#6C4FA0";
  const loan = loans.find((l) => l.id === selected);
  const owedToMeByCcy = sumByCurrency(loans.filter((l) => l.direction === "owed_to_me"), (l) => l.currencyCode, loanOutstanding);
  const iOweByCcy = sumByCurrency(loans.filter((l) => l.direction === "i_owe"), (l) => l.currencyCode, loanOutstanding);
  const netByCcy = subtractCurrencyMaps(owedToMeByCcy, iOweByCcy);

  function addLoan(data) {
    setLoans((ls) => [...ls, { id: uid(), person: data.person, direction: data.direction, currencyCode: data.currencyCode, principal: Number(data.principal), date: data.date, note: data.note, repayments: [] }]);
    setModal(null);
  }
  function addRepayment(data) {
    setLoans((ls) => ls.map((l) => l.id === selected ? { ...l, repayments: [...l.repayments, { date: data.date, amount: Number(data.amount) }] } : l));
    setModal(null);
  }
  function removeLoan(id) { setLoans((ls) => ls.filter((l) => l.id !== id)); setSelected(null); }

  if (loan) {
    const symbol = sym(loan.currencyCode);
    const outstanding = loanOutstanding(loan);
    return (
      <div>
        <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={15} /> All personal loans</button>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{loan.person}</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{loan.direction === "owed_to_me" ? "Money lent out" : "Money I owe"} · {loan.currencyCode} · since {fmtDate(loan.date)}</div>
            </div>
            <button className="btn btn-danger" onClick={() => removeLoan(loan.id)}><Trash2 size={14} /></button>
          </div>
          <div className="stat-grid">
            <div className="stat-tile"><div className="stat-tile-label">Principal</div><div className="stat-tile-value">{fmtMoney(loan.principal, symbol)}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Outstanding</div><div className="stat-tile-value" style={{ color: loan.direction === "owed_to_me" ? "#1F8A5C" : "#B3261E" }}>{fmtMoney(outstanding, symbol)}</div></div>
          </div>
        </div>
        <div className="screen-header"><h2 style={{ fontSize: 15 }}>Repayments</h2><button className="btn btn-sm" onClick={() => setModal("repay")}><Plus size={14} /> Add</button></div>
        <table className="table"><thead><tr><th>Date</th><th className="ta-right">Amount</th></tr></thead>
          <tbody>{[...loan.repayments].sort((a, b) => new Date(b.date) - new Date(a.date)).map((r, i) => (
            <tr key={i}><td>{fmtDate(r.date)}</td><td className="ta-right mono">{fmtMoney(r.amount, symbol)}</td></tr>
          ))}</tbody>
        </table>
        <FormModal open={modal === "repay"} title="Add repayment" accent={accent} onCancel={() => setModal(null)} onSubmit={addRepayment}
          fields={[
            { key: "date", label: "Date", type: "date", default: todayStr(), required: true },
            { key: "amount", label: "Amount", type: "number", placeholder: "100", required: true },
          ]} />
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Personal Loans" accent={accent} onAdd={() => setModal("ploan")} addLabel="Add" />
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-tile"><div className="stat-tile-label">Owed to Me</div><MultiCurrency map={owedToMeByCcy} colorForValue={() => "#1F8A5C"} size={15} /></div>
        <div className="stat-tile"><div className="stat-tile-label">I Owe</div><MultiCurrency map={iOweByCcy} colorForValue={() => "#B3261E"} size={15} /></div>
      </div>
      <div className="card" style={{ textAlign: "center" }}>
        <div className="card-title">Net Position (by currency)</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}><MultiCurrency map={netByCcy} colorForValue={(v) => (v >= 0 ? "#1F8A5C" : "#B3261E")} size={18} /></div>
      </div>
      {loans.length === 0 ? <div className="empty-state"><h3>No personal loans yet</h3></div> :
        loans.map((l) => {
          const outstanding = loanOutstanding(l);
          const symbol = sym(l.currencyCode);
          return (
            <div className="row-item" key={l.id} onClick={() => setSelected(l.id)}>
              <div className="row-left">
                <div className="avatar" style={{ width: 40, height: 40, background: l.direction === "owed_to_me" ? "#1F8A5C" : "#B3261E" }}>{initials(l.person)}</div>
                <div><div className="row-name">{l.person}</div><div className="row-sub">{l.direction === "owed_to_me" ? "Lent to them" : "Borrowed from them"} · {l.currencyCode}</div></div>
              </div>
              <div className="row-value" style={{ color: l.direction === "owed_to_me" ? "#1F8A5C" : "#B3261E" }}>{fmtMoney(outstanding, symbol)}</div>
            </div>
          );
        })}
      <FormModal open={modal === "ploan"} title="Add personal loan" accent={accent} onCancel={() => setModal(null)} onSubmit={addLoan}
        fields={[
          { key: "person", label: "Person / lender name", placeholder: "e.g. Bilal", required: true },
          { key: "direction", label: "Direction", type: "select", options: [{ value: "owed_to_me", label: "Money I lent out" }, { value: "i_owe", label: "Money I owe" }], default: "owed_to_me", required: true },
          currencyField(defaultCurrency),
          { key: "principal", label: "Amount", type: "number", placeholder: "500", required: true },
          { key: "date", label: "Date", type: "date", default: todayStr(), required: true },
          { key: "note", label: "Note (optional)", placeholder: "e.g. bike repair" },
        ]} />
    </div>
  );
}
