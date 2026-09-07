# FinanceRecorder UI Design Guidelines

This file is the authoritative UI checklist for the React application in
`webapp/`. It turns the Main / Often / Rare redesign principles and later
product decisions into rules that can be audited in the running application.
If an older status note (in `README.md` or `CLAUDE.md`) calls something
"done" but it breaks one of these rules in the real UI, the work is not
done — re-open it.

## Scope and precedence

- These rules apply to every new or changed screen, component, modal, chart,
  and navigation pattern in `webapp/`.
- A task-specific, user-approved decision may refine a rule, but must record
  the exception and its reason near the affected code.
- Prefer a shared component or generic class over a module-specific visual
  variation. A genuine semantic difference may have module-specific content,
  never an accidental duplicate implementation.
- Verify UI claims in a real rendered page. Source review, a passing build,
  or a historical "Done" entry alone is not verification.

## Information architecture

1. Organize every financial module around **Main / Often / Rare**:
   - **Main:** the information and actions used frequently, directly on the
     module landing page.
   - **Often:** entity creation and detail views, reached through a light
     action such as a FAB or card click. Entity details are read-only by
     default and expose an explicit Edit action.
   - **Rare:** account, settings, backup/recovery, sync, and legal content,
     consolidated under the Account or module Settings area rather than
     scattered in footers and toolbars.
2. Each main financial module (for example Funds, Banking, Cash, Rentals,
   EMI/Loans, and Personal Loans) uses the side navigation as its primary
   module-level navigation.
3. Submodules within a module (for example Overview, Transactions/Transfer
   History, Planning, and Analytics) use a navigation bar **pinned to the
   top of the viewport while the page scrolls**, so it is always reachable.
   It must remain clear which submodule is active/in view. This pins the
   existing chip-bar navigation in place — it does not switch to hiding
   other sections. Picking a submodule scrolls to and expands that
   section; sections not currently selected remain present further down
   the page, not removed from the DOM. (This preserves the deliberate fix
   that replaced a hide-other-tabs pattern because it made content feel
   unreachable — see `components/Tabs.tsx`'s own doc comment.)
4. Keep related information together. A user should not have to assemble one
   financial task from disconnected cards, footers, routes, or controls.
5. Native module workflows must let users create, view, edit, and link their
   own records. Do not make a separate transfer screen the only way to link a
   record when an inline native flow is appropriate.

## Layout and cards

1. Use responsive grid layouts for cards and controls. Wrap into useful
   columns; do not compress components merely to keep them on one row.
2. A card is content-sized within the grid by default. Only a card that
   contains a table, wide data grid, or equivalent horizontally dense content
   may span the full available width.
3. Stat-card grids must consume available space with sensible responsive
   columns. Do not leave a large empty area simply because a fixed narrow
   column count was chosen.
4. Do not nest cards. When a parent section already provides card framing,
   use a flat heading, toolbar, chart, or content block inside it.
5. Leave deliberate vertical space between components. Use shared spacing
   utilities and grid gaps rather than one-off margins.
6. Use lighter shadows and clear boundaries. Stat cards use solid, sharper
   color surfaces with only a restrained highlight/gradient, not vague washed
   out gradients. (This is about card *surfaces*; see Charts below for the
   separate rule on chart fill colors, which pulls the opposite direction on
   purpose — legibility of overlapping data, not surface boldness.)
7. Arrange forms and dense information vertically by default. Group related
   controls in compact responsive grids only when that improves scanning and
   input, not to stretch fields across the page.
8. Place related actions together at the top-right of their section or card.
   Do not scatter equivalent actions across headers, body content, and
   footers.

## Shared implementation system

1. `webapp/src/main/site.css` owns generic, class-based layout and component
   rules: grids, spacing, card sizes, toolbars, modal sizing, table wrappers,
   navigation positioning, and reusable visual primitives.
2. Theme styles (`theme.css` and any per-theme files) define and override
   design tokens (colors, shadows, surfaces, typography) rather than
   duplicating structural component CSS.
3. Do not hard-code one-off CSS values in page/component styles when a shared
   class or token describes the same concept. Add a generic class only after
   checking that it represents a reusable pattern.
4. Name classes for what they are, not where they happened to first appear.
   A form label cannot use a class called `footer-note`; rename or replace
   misleading utilities when encountered.
5. Reuse generic components for recurring UI. A card, modal/popup, tab bar,
   form field row, entity detail, and table wrapper should have one shared
   implementation with module-specific fields/content passed in through
   props or composition.
6. Before creating a variation, search the other modules for an approved
   equivalent and either reuse it or bring the siblings onto the same shared
   implementation.

## Charts, color, and readability

1. Charts share consistent responsive sizing and must not force their value
   axis to zero when a relative scale better communicates the data.
2. Chart **fills** (bars, areas, line strokes) use transparent or
   translucent colors so overlapping data stays legible without heavy
   opaque blocks. Text, points, axis labels, and reference values must still
   meet contrast needs on every supported theme. This rule governs chart
   canvases only — it does not apply to stat cards or status badges, which
   follow the solid-surface rule above instead.
3. Use sharper, clearly distinguishable colors for status and data display
   (stat cards, pills, badges). Do not rely on vague low-contrast color
   washes to communicate meaning.
4. Explain uncommon financial terms with tooltips instead of permanently
   expanding pages with explanatory paragraphs. Use plain language wherever
   possible.

## Popups and responsive behavior

1. Popups/modals open at no more than half the usable viewport width on a
   desktop by default, unless the content is a table or other explicitly wide
   workspace.
2. Every popup/modal provides a full-screen toggle. Full-screen is an
   intentional user action, not the default desktop presentation.
3. On small screens, popups remain usable within the viewport, with scrolling
   content and accessible close/full-screen controls.

## Audit and completion standard

For every claimed feature or fix:

1. Check its stated behavior in the running app with representative data.
2. Check sibling modules for the same interaction or visual pattern.
3. Check it against this document.
4. Extract or reuse shared components/CSS before declaring the pattern done.
5. Run the relevant tests, type check/build, lint, and a visual browser check.
6. Record the real result in `README.md` and update `USER_MANUAL.md` when the
   user-facing behavior changes.

One independently verifiable audit fix is one task and one commit. Do not
bundle unrelated visual cleanup, data-model work, or multiple module fixes in
the same commit.
