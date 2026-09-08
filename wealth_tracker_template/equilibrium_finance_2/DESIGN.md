---
name: Equilibrium Finance
colors:
  surface: '#f8f9ff'
  surface-dim: '#d8dae0'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#e5eeff'
  surface-container-high: '#e7e8ee'
  surface-container-highest: '#e1e2e8'
  on-surface: '#191c20'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2e3135'
  inverse-on-surface: '#eff0f6'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#9af2c5'
  on-secondary-container: '#0c714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#131b2e'
  on-tertiary-container: '#7b839b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#9df4c8'
  secondary-fixed-dim: '#81d8ad'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#dae2fc'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3e465b'
  background: '#f8f9ff'
  on-background: '#191c20'
  surface-variant: '#e1e2e8'
  currency-primary: '#0b1c30'
  currency-secondary: '#45464d'
  success: '#006c49'
typography:
  headline-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  currency-display:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-caps:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
---

## Brand & Style

The design system is engineered for high-stakes financial environments where clarity, precision, and trust are paramount. The brand personality is authoritative yet accessible, positioning the platform as a sophisticated tool for serious wealth management and multi-currency exchange.

The aesthetic follows a **Modern Corporate** style with **Minimalist** leanings. It prioritizes information density and structural logic over decorative flair. The emotional response is one of "calm control"—the user feels empowered by data rather than overwhelmed by it. High whitespace in navigational areas is balanced by high-density data grids, ensuring that critical figures and currency conversions are always the focal point.

## Colors

The palette is anchored by a deep, high-contrast primary for branding and a specialized currency color scale. 

- **Primary & Neutral:** Deep navy and pure black provide stability, while the surface system uses a range of "Balanced Grays" and cool blues to reduce eye strain.
- **Currency Semantics:** `currency-primary` is reserved for the active or "base" currency value to ensure maximum prominence. `currency-secondary` is used for converted values, exchange rates, and secondary denominations.
- **Functional Colors:** "Success Green" is reserved strictly for positive financial trends and completed transactions. "Error Red" handles negative fluctuations and failed states.

## Typography

This system utilizes a tiered typographic approach to separate narrative content from financial data. 

**Manrope** provides a refined executive feel for headlines. **Work Sans** is the workhorse for UI labels and body text. 

For all numeric data, including currency indicators and transaction IDs, **JetBrains Mono** is mandatory. Its monospaced nature ensures that columns of numbers align perfectly in tables. 
- **Currency Symbols:** Symbols ($, €, £) should be sized identically to the numeric value but can use `currency-secondary` color to de-emphasize the symbol relative to the amount.
- **Prefixes/Suffixes:** Use `label-caps` for ISO codes (USD, GBP) when they appear as suffixes to monospaced values.

## Layout & Spacing

The system employs a **Fixed Grid** model on desktop to maintain a controlled, professional presentation of complex financial dashboards.

- **Desktop (1440px+):** 12 columns, 24px gutters, 80px margins.
- **Tablet (768px - 1439px):** 8 columns, 16px gutters, 40px margins.
- **Mobile (<767px):** 4 columns, 16px gutters, 16px margins.

Use a "Compact" vertical rhythm (8px or 12px) for data-heavy grids and a "Spacious" rhythm (48px+) for marketing surfaces. Currency conversion widgets should use `md` spacing between input groups to maintain clear logical separation.

## Elevation & Depth

To maintain a "flat but layered" professional look, the design system uses **Tonal Layers** and **Low-Contrast Outlines**.

- **Surfaces:** The primary background is the lightest neutral. Elevated widgets use `surface-container-low` to create subtle depth without shadows.
- **Borders:** Interactive elements like cards and inputs use a 1px `outline-variant` border.
- **High Elevation:** Shadows are reserved exclusively for "High-Trust" overlays like modals or currency pickers. Use a soft, diffused blue-tinted shadow: `0 10px 25px -5px rgba(11, 28, 48, 0.1)`.

## Shapes

The shape language is **Soft**, providing a professional edge that feels modern but stable.

- **Inputs, Buttons, & Currency Toggles:** 4px (Soft) radius.
- **Cards & Dashboard Widgets:** 8px (Large) radius.
- **Status Pills:** Use the `full` (9999px) radius to distinguish non-interactive status chips from buttons.
- **Selection Indicators:** Use sharp or 2px radii for chart elements to maintain geometric precision.

## Components

### Buttons
Primary buttons use the primary navy/black with white text. Multi-currency "Switch" or "Convert" buttons should utilize a secondary ghost style (outline only) to remain secondary to the data entry.

### Multi-Currency Inputs
Input fields for currency must always include a persistent prefix or suffix (using `data-tabular`) and a currency picker. The active currency value uses `currency-primary` and `currency-display` typography for high visibility.

### Data Tables
Tables are the core of the experience. Use `data-tabular` for all numeric cells. Use `label-caps` for headers. Alignment is critical: numeric columns must be right-aligned to ensure decimal points and currency symbols line up vertically.

### Chips & Transaction States
- **Pending:** Amber background-tint with Amber text.
- **Completed:** Success Green tint with Success Green text.
- **Currency Tags:** Use a neutral `surface-container-high` background with `label-caps` text for ISO currency tags (e.g., "BASE", "QUOTE").

### Input Fields
Inputs must have a 2px primary color ring on focus. Labels should never be replaced by placeholders; they remain visible as `label-caps` above the input area to maintain context during complex multi-step financial flows.