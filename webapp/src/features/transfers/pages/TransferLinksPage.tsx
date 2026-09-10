import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { PlusIcon } from '../../../components/icons';
import { Field, Select } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/IconButton';
import { emiSummary } from '../../../lib/calc/emiModule';
import { CURRENCIES } from '../../../lib/currencies';
import { AddAccountForm } from '../../bank/pages/BankPage';
import { AddCreditCardForm } from '../../bank/pages/CreditCardsSection';
import { AddLoanForm as AddEMILoanForm } from '../../emi/pages/EMIPage';
import { AddLoanForm as AddPersonalLoanForm } from '../../personalLoans/pages/PersonalLoansPage';
import { AddPropertyForm } from '../../rentals/pages/RentalsPage';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { useCreditCardWorkbookStore } from '../../../store/creditCardWorkbookStore';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import { usePersonalLoansWorkbookStore } from '../../../store/personalLoansWorkbookStore';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../../../store/rentalsWorkbookStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import type { EMILoan } from '../../../types/emiWorkbook';
import { LINK_MODULES, LINK_MODULE_LABELS, type LinkModule, type LinkSideConfig } from '../../../types/interEntityTransfer';

/** This file used to be the standalone Transfers PAGE (route `/transfers`) —
 * removed 2026-08-28 ("This entirely removes the transfers page and the
 * problem of duplicated transaction cards") in favor of one app-wide
 * "Transfers" FAB + `TransactionEntryModal` reachable from every module,
 * which folds in everything `CreateLinkForm` used to do. What's left here
 * is the shared linking INFRASTRUCTURE every module page (and the new
 * modal) still imports: `SideFields`, `useSideCurrency`, `resolveCurrency`,
 * `nextUnpaidEmiMonth`, `linkTargetPath` — kept in this file rather than
 * moved, since every existing importer already points here. */

interface CurrencyContext {
  cashCurrency: string;
  bankAccounts: { id: string; currencyCode: string }[];
  qseCurrency: string;
  psxCurrency: string;
  fundsCurrency: string;
  properties: { id: string; currencyCode: string }[];
  loans: { id: string; currencyCode: string }[];
  emiLoans: { id: string; currencyCode: string }[];
  creditCards: { id: string; currencyCode: string }[];
}

/** EMI/Loans has no per-repayment picker in v1 — a link always applies to
 * "the next installment not yet covered by an actual payment," same
 * simplicity as Personal Loans' plain loan picker. Clamped to the
 * schedule's own length so a fully-repaid loan doesn't produce an
 * out-of-range month. */
export function nextUnpaidEmiMonth(loan: EMILoan): number {
  const sum = emiSummary(loan);
  return Math.min(sum.elapsed + 1, sum.rows.length);
}

/** Resolves the display currency for one side — a plain function (not a
 * hook) so it can be called per-row inside a `.map()`, e.g. in a batch
 * transaction list, where the store selectors are read once at the top of
 * the component instead of once per row. */
function resolveCurrency(cfg: LinkSideConfig, ctx: CurrencyContext): string | null {
  switch (cfg.module) {
    case 'cash': return cfg.currencyCode || ctx.cashCurrency;
    case 'bank': return ctx.bankAccounts.find((a) => a.id === cfg.ref)?.currencyCode ?? null;
    case 'qse': return ctx.qseCurrency;
    case 'psx': return ctx.psxCurrency;
    // Unlike QSE/PSX, Funds has no single portfolio currency (funds can be
    // added in different currencies) — `defaultCurrency` is a pragmatic
    // stand-in, same simplification the unused `cashSummary`/
    // `buildCashLedger` calls in `useFundsDerived` already made implicitly
    // by treating every Transfer as one currency.
    case 'funds': return ctx.fundsCurrency;
    case 'rentals': return ctx.properties.find((p) => p.id === cfg.ref)?.currencyCode ?? null;
    case 'personalLoans': return ctx.loans.find((l) => l.id === cfg.ref)?.currencyCode ?? null;
    case 'emi': return ctx.emiLoans.find((l) => l.id === cfg.ref)?.currencyCode ?? null;
    case 'creditCard': return ctx.creditCards.find((c) => c.id === cfg.ref)?.currencyCode ?? null;
  }
}

/** Resolves the display currency for one side, so the form can warn about
 * a currency mismatch before it's created — the link itself never converts
 * (no live FX-rate source, per MODULES_PLAN.md's cross-cutting decision),
 * so a mismatch here means the two ledger rows won't reconcile in the same
 * units even though the app treats the number as equal on both sides. */
export function useSideCurrency(cfg: LinkSideConfig): string | null {
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const qseCurrency = useWorkbookStore((s) => s.workbook.settings.currency);
  const psxCurrency = usePSXWorkbookStore((s) => s.workbook.settings.currency);
  const fundsCurrency = useFundsWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const creditCards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  return resolveCurrency(cfg, { cashCurrency, bankAccounts, qseCurrency, psxCurrency, fundsCurrency, properties, loans, emiLoans, creditCards });
}

interface NameContext {
  bankAccounts: { id: string; name: string }[];
  properties: { id: string; name: string }[];
  loans: { id: string; person: string }[];
  emiLoans: { id: string; name: string }[];
  creditCards: { id: string; name: string }[];
}

/** Same "plain function + a `use*` wrapper that reads the stores once"
 * split as `resolveCurrency`/`useSideCurrency` above — a human-readable
 * label for one side of a link: the module's own name
 * (`LINK_MODULE_LABELS`), plus the specific account/property/loan's own
 * name in parentheses for the modules with more than one named
 * sub-entity. Falls back to the bare module label if the referenced
 * entity was since deleted (`ref` no longer resolves) rather than
 * throwing or showing a raw id. */
function describeSide(cfg: LinkSideConfig, ctx: NameContext): string {
  const base = LINK_MODULE_LABELS[cfg.module];
  switch (cfg.module) {
    case 'bank': {
      const name = ctx.bankAccounts.find((a) => a.id === cfg.ref)?.name;
      return name ? `${base} (${name})` : base;
    }
    case 'rentals': {
      const name = ctx.properties.find((p) => p.id === cfg.ref)?.name;
      return name ? `${base} (${name})` : base;
    }
    case 'personalLoans': {
      const name = ctx.loans.find((l) => l.id === cfg.ref)?.person;
      return name ? `${base} (${name})` : base;
    }
    case 'emi': {
      const name = ctx.emiLoans.find((l) => l.id === cfg.ref)?.name;
      return name ? `${base} (${name})` : base;
    }
    case 'creditCard': {
      const name = ctx.creditCards.find((c) => c.id === cfg.ref)?.name;
      return name ? `${base} (${name})` : base;
    }
    default:
      return base;
  }
}

/** User-requested (2026-09-06): "for linked transfers, we must mention
 * From & To accounts as well in addition to the link" — the existing
 * "🔗 Linked" tag on a linked record only ever said "Linked," with no
 * indication of WHICH two accounts the link actually connects (the user
 * has to click through to the other side to find out). Returns a
 * `(cfg) => string` describer, called with both `link.from` and
 * `link.to` at each call site to build a "🔗 <From> → <To>" tag —
 * reading the same regardless of which side's own table it's shown on,
 * since it describes the WHOLE link, not just "the other side" relative
 * to this row. */
export function useLinkSideLabel(): (cfg: LinkSideConfig) => string {
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const creditCards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  return (cfg: LinkSideConfig) => describeSide(cfg, { bankAccounts, properties, loans, emiLoans, creditCards });
}

/** Best-effort "go see the other side" route for a linked transaction's tag
 * (user-requested: "add nav link between the linked trcs"). Only Bank has a
 * real per-record route (`/bank/account/:id`) — every other module routes
 * to its own list/landing page, since none of them have a per-record route
 * to deep-link into yet. */
export function linkTargetPath(cfg: LinkSideConfig): string {
  switch (cfg.module) {
    case 'bank': return cfg.ref ? `/bank/account/${cfg.ref}` : '/bank';
    case 'cash': return '/cash';
    case 'qse': return '/transactions';
    case 'psx': return '/psx/transactions';
    case 'rentals': return '/rentals';
    case 'personalLoans': return '/personal-loans';
    case 'emi': return '/emi-loans';
    case 'funds': return '/funds';
    case 'creditCard': return '/bank';
  }
}

const REF_PICKER_LABELS: Partial<Record<LinkModule, string>> = {
  bank: 'Account',
  rentals: 'Property',
  personalLoans: 'Loan',
  emi: 'Loan',
  creditCard: 'Card',
};

/** One "side" of a transaction — which finance it belongs to, and (for the
 * modules with more than one named entity) which specific one.
 *
 * User-reported (2026-08-28): "Layout for this should ---> Amount:
 * Transfer -> To/From (dropdown): Currency (dropdown): filtered accounts
 * (with + button to add a missing finance e.g. loan to a new person)."
 * Reordered to exactly that: module dropdown, then a real Currency dropdown
 * (not just a read-only badge — the earlier "Link To always shows USD"
 * fix already made Cash's currency choosable; this extends the same idea
 * to every module with a currency-carrying entity list) that FILTERS the
 * ref dropdown below it, plus a "+" quick-add button next to the ref
 * dropdown that opens that module's own existing add-entity form in a
 * `Modal` — reused directly (`AddAccountForm`/`AddPropertyForm`/
 * `AddLoanForm` ×2, each already exported with an `initialCurrency` prop
 * and an `onSaved(id)` callback for exactly this) rather than duplicating
 * a second add-form per module.
 *
 * `preferredCurrency` (optional, added 2026-09-07): user-reported "the
 * default currency should be of the Account 1 rather than rare inter
 * currency inter finance transfer." Before this, switching this side's
 * MODULE (e.g. "Other finance" from Cash to Bank) always defaulted to
 * whichever entity happened to be first in that module's own list — an
 * essentially arbitrary currency, easy to land on a real cross-currency
 * pair by accident. When set (the caller passes the OTHER side's already-
 * resolved currency), a module change now prefers an entity/currency that
 * actually matches it, so a same-currency transfer is the default unless
 * the user deliberately picks otherwise. Only ever passed for the "Other
 * finance" side — Account 1 has nothing to lean toward, it's the anchor. */
export function SideFields({ label, cfg, onChange, preferredCurrency }: { label: string; cfg: LinkSideConfig; onChange: (cfg: LinkSideConfig) => void; preferredCurrency?: string }) {
  const bankAccounts = useBankWorkbookStore((s) => s.workbook.settings.accounts);
  const properties = useRentalsWorkbookStore((s) => s.workbook.settings.properties);
  const loans = usePersonalLoansWorkbookStore((s) => s.workbook.loans);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const creditCards = useCreditCardWorkbookStore((s) => s.workbook.cards);
  const cashCurrency = useCashWorkbookStore((s) => s.workbook.settings.defaultCurrency);
  const currency = useSideCurrency(cfg);
  const [addOpen, setAddOpen] = useState(false);

  const entitiesForModule = (module: LinkModule): { id: string; label: string; currencyCode: string }[] => {
    switch (module) {
      // Archived accounts are hidden from this "pick where a NEW linked
      // transaction goes" list (2026-09-03) — same "hide from pickers for
      // new activity, never from totals" rule as `AccountsList`'s own
      // filter; see `BankAccount.isActive`'s own doc comment.
      case 'bank': return bankAccounts.filter((a) => a.isActive !== false).map((a) => ({ id: a.id, label: `${a.name} (${a.currencyCode})`, currencyCode: a.currencyCode }));
      // Same archived-hiding rule extended to every other linkable entity
      // list with its own `isActive` flag (2026-09-03) — see each type's
      // own doc comment (`Property`/`PersonalLoan`/`EMILoan`).
      case 'rentals': return properties.filter((p) => p.isActive !== false).map((p) => ({ id: p.id, label: `${p.name} (${p.currencyCode})`, currencyCode: p.currencyCode }));
      case 'personalLoans': return loans.filter((l) => l.isActive !== false).map((l) => ({ id: l.id, label: `${l.person} (${l.currencyCode})`, currencyCode: l.currencyCode }));
      case 'emi': return emiLoans.filter((l) => l.isActive !== false).map((l) => ({ id: l.id, label: `${l.name} (${l.currencyCode})`, currencyCode: l.currencyCode }));
      case 'creditCard': return creditCards.filter((c) => c.isActive !== false).map((c) => ({ id: c.id, label: `${c.name} (${c.currencyCode})`, currencyCode: c.currencyCode }));
      default: return [];
    }
  };
  const hasRefPicker = cfg.module === 'bank' || cfg.module === 'rentals' || cfg.module === 'personalLoans' || cfg.module === 'emi' || cfg.module === 'creditCard';
  const entities = entitiesForModule(cfg.module);
  const filteredEntities = cfg.currencyCode ? entities.filter((e) => e.currencyCode === cfg.currencyCode) : entities;
  const refLabel = REF_PICKER_LABELS[cfg.module];

  return (
    <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
      <Field label={label}>
        <Select
          value={cfg.module}
          onChange={(e) => {
            const module = e.target.value as LinkModule;
            const list = entitiesForModule(module);
            // Prefer an entity matching `preferredCurrency` (Account 1's own
            // currency) over just grabbing the first one in the list — see
            // this function's own doc comment.
            const preferred = preferredCurrency ? list.find((en) => en.currencyCode === preferredCurrency) : undefined;
            onChange({
              module,
              ref: preferred?.id ?? list[0]?.id,
              currencyCode: module === 'cash' ? (preferredCurrency ?? cashCurrency) : (preferred?.currencyCode ?? list[0]?.currencyCode),
            });
          }}
        >
          {LINK_MODULES.map((m) => <option key={m} value={m}>{LINK_MODULE_LABELS[m]}</option>)}
        </Select>
      </Field>
      {hasRefPicker && (
        <>
          <Field label="Currency">
            <Select
              // User-reported (2026-09-07): restoring a remembered account
              // (which sets `cfg.ref` directly, without going through this
              // component's own module-change handler) left `cfg.currencyCode`
              // unset, so this used to fall straight to `entities[0]` — an
              // arbitrary, often-wrong currency shown right next to the
              // correctly-restored account. Once a `ref` is already selected,
              // prefer THAT entity's own real currency over the first one in
              // the list.
              value={cfg.currencyCode ?? entities.find((en) => en.id === cfg.ref)?.currencyCode ?? entities[0]?.currencyCode ?? 'USD'}
              onChange={(e) => {
                const code = e.target.value;
                const match = entities.find((en) => en.currencyCode === code);
                onChange({ ...cfg, currencyCode: code, ref: match?.id });
              }}
            >
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </Field>
          {/* User-reported (app-wide audit): "+ of add account in popups...
             moving in next line" — this ref-picker Select sits inside a
             Field whose default width (180px) is sized for ONE plain
             control. The real cause (confirmed via a real computed-style
             check, not guessed): the base CSS rule `select{width:100%}`
             gives the select a flex-basis equal to the FULL 180px
             container — flexbox decides whether a `.row` needs to wrap
             using that hypothetical (pre-shrink) size, so the select
             alone already "fills" the row before the IconButton beside it
             is even considered, and flex-wrap bumps the button to a new
             line rather than ever trying to shrink the select down first.
             A `min-width` override (tried first, confirmed NOT to fix
             this via the same live measurement) can't help, since the
             problem isn't a width FLOOR — it's the item's own hypothetical
             size already exceeding the container. Only an explicit,
             smaller `width` (via `Select`'s own `width` prop, which sets a
             real inline style that overrides the 100% CSS rule) fixes it,
             by giving the select a small enough flex-basis from the
             start that the button fits beside it on the very first
             layout pass. `style={{minWidth:110}}` is ALSO required
             alongside `width` — confirmed via a second live measurement
             that `width` alone still rendered at 160px, since `.row > *`'s
             separate `min-width:160px` floor is a hard floor that wins
             over a smaller explicit `width` regardless; only overriding
             BOTH together actually shrinks the rendered element. */}
          <Field label={refLabel}>
            <div className="row" style={{ gap: 4, alignItems: 'center' }}>
              <Select value={cfg.ref ?? ''} onChange={(e) => onChange({ ...cfg, ref: e.target.value })} width={110} style={{ minWidth: 110 }}>
                {!filteredEntities.length && <option value="">None in this currency</option>}
                {filteredEntities.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
              </Select>
              <IconButton
                label={`Add a missing ${(refLabel ?? 'finance').toLowerCase()}`}
                icon={<PlusIcon size={13} />}
                onClick={() => setAddOpen(true)}
              />
            </div>
          </Field>
        </>
      )}
      {/* User-reported (2026-08-28): "Link To always shows USD instead of
         filling default currency... even hand to hand cash currency
         exchange can happen. so make all finance combos choosable!" —
         Cash has no single fixed currency the way a Bank account does (a
         Cash entry can be logged in any currency), so it needs a real
         picker here rather than silently assuming `settings.defaultCurrency`
         — this is also what fixes `buildSideRecord`'s own currencyCode
         actually being populated instead of falling back to a hardcoded
         'USD' (see that function's own comment). */}
      {cfg.module === 'cash' && (
        <Field label="Currency">
          <Select value={cfg.currencyCode ?? cashCurrency} onChange={(e) => onChange({ ...cfg, currencyCode: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
      )}
      {currency && !hasRefPicker && cfg.module !== 'cash' && <span className="text-muted">{currency}</span>}
      {addOpen && cfg.module === 'bank' && (
        <Modal title="Add a missing account" onClose={() => setAddOpen(false)}>
          <AddAccountForm initialCurrency={cfg.currencyCode} onSaved={(id) => { onChange({ ...cfg, ref: id }); setAddOpen(false); }} />
        </Modal>
      )}
      {addOpen && cfg.module === 'rentals' && (
        <Modal title="Add a missing property" onClose={() => setAddOpen(false)}>
          <AddPropertyForm initialCurrency={cfg.currencyCode} onSaved={(id) => { onChange({ ...cfg, ref: id }); setAddOpen(false); }} />
        </Modal>
      )}
      {addOpen && cfg.module === 'personalLoans' && (
        <Modal title="Add a missing loan" onClose={() => setAddOpen(false)}>
          <AddPersonalLoanForm initialCurrency={cfg.currencyCode} onSaved={(id) => { onChange({ ...cfg, ref: id }); setAddOpen(false); }} />
        </Modal>
      )}
      {addOpen && cfg.module === 'emi' && (
        <Modal title="Add a missing loan" onClose={() => setAddOpen(false)}>
          <AddEMILoanForm initialCurrency={cfg.currencyCode} onSaved={(id) => { onChange({ ...cfg, ref: id }); setAddOpen(false); }} />
        </Modal>
      )}
      {addOpen && cfg.module === 'creditCard' && (
        <Modal title="Add a missing credit card" onClose={() => setAddOpen(false)}>
          <AddCreditCardForm initialCurrency={cfg.currencyCode} onSaved={(id) => { onChange({ ...cfg, ref: id }); setAddOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}
