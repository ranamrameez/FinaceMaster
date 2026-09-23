# Standard Page Template Migration

Banking is the verified reference implementation for an app-wide page-template migration. These rules apply to every existing module, not only future pages.

## Locked rules

1. **Document user instructions.** Standing UI/architecture instructions must be recorded in the repository when implemented.
2. **Shared implementation only.** Do not hard-code reusable page HTML/CSS in module pages. Create or reuse shared components and generic classes.
3. **One page filter set.** Tables, summaries, charts, exports and other compatible derived views consume the same filtered dataset. Do not keep independent per-card date/category filters for the same records.
4. **URL-aware state.** Page section selection and meaningful filter state must live in the URL so refresh, back/forward and deep links restore the same view.
5. **TopBar is part of the template.** Page sections use the shared fixed TopBar. Entity switchers and the page filter control belong in its right-side control cluster where applicable.
6. **StandardCard is the migration target.** Header layout:
   - left: collapse arrow + CAPITALIZED title
   - center: compact summary chips
   - right: options/menu actions such as Edit/Delete
7. **Avoid duplicate views.** Consolidate cards/charts that communicate the same breakdown.
8. **Transactions before Analytics.** Detail pages should show the ledger before derived analytics unless a module has a documented semantic reason not to.
9. **Chart presentation.** Reuse shared translucent colors and the shared depth treatment rather than opaque one-off palettes.
10. **Migrate all existing modules.** Cash, Funds, Rentals, Personal Loans, EMI/Loans, Subscriptions, QSE, PSX, Banking, Credit Cards and other existing modules move to the shared template step by step.

## Shared building blocks

- `StandardCard` / `SummaryChip`
- `StandardPageSections`
- `Tabs` compatibility adapter
- `TopBarControls` / `TopBarSelect`
- `TransactionFilterMenu`
- `useUrlTransactionFilters`
- `UsageBar`
- structural classes in `src/main/site.css`
- shared chart visuals in `lib/chartVisuals.ts`

## URL contract

Section navigation:

```
?section=<section-key>
```

Transaction-style filters:

```
?period=1|3|6|12|ytd|custom
&from=YYYY-MM-DD
&to=YYYY-MM-DD
&direction=all|in|out
&category=<category>
&source=all|manual|statement-import
```

Modules may add semantically necessary parameters, but meaningful navigation/filter state must not exist only in component-local state.

## Rollout order

1. Banking account detail reference slice.
2. Banking bank/card/detail siblings.
3. Cash.
4. Personal Loans + EMI/Loans.
5. Funds + Rentals + Subscriptions.
6. QSE + PSX detail/analytics pages.
7. Remaining dashboards/settings/data pages where the same pattern applies.

Each migration removes replaced one-off markup/classes instead of leaving parallel implementations behind.
