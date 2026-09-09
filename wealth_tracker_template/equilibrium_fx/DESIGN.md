---
name: Equilibrium FX
colors:
  surface: '#f8f9ff'
  surface-dim: '#CBDBF5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#eceef3'
  surface-container-high: '#e7e8ee'
  surface-container-highest: '#e1e2e8'
  on-surface: '#191c20'
  on-surface-variant: '#45464d'
  inverse-surface: '#2e3135'
  inverse-on-surface: '#eff0f6'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#07006c'
  on-tertiary-container: '#7073ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#f8f9ff'
  on-background: '#191c20'
  surface-variant: '#e1e2e8'
  pip-up: '#059669'
  pip-down: '#E11D48'
  border-subtle: '#E2E8F0'
typography:
  display-lg:
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
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  rate-display:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  data-tabular:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  cell-px: 12px
  cell-py: 8px
  widget-gap: 16px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style

The design system is engineered for **Analytical Professionalism**, specifically tailored for high-frequency Foreign Exchange environments. The personality is clinical, precise, and authoritative, functioning as a high-density dashboard where market volatility is translated into actionable clarity. 

The aesthetic is **Modern Corporate** with a focus on **Structural Minimalism**. It prioritizes information density over decorative white space, ensuring that real-time market indicators and currency pairs are the primary focus. The emotional response is one of "Technical Mastery"—the UI feels like a high-performance instrument where every pixel serves a functional purpose in the decision-making process.

## Colors

The palette is anchored by a deep navy **Primary** (#0F172A), providing a stable, high-contrast foundation for data. The **Neutral** background (#F8F9FF) is a soft slate designed to reduce glare during extended trading sessions.

The system introduces a specialized semantic pair for FX movements:
- **Pip-Up (Emerald/Teal):** Used for appreciating rates, bid increases, and positive spreads.
- **Pip-Down (Rose/Crimson):** Used for depreciating rates, ask decreases, and negative spreads.

Avoid using these semantic colors for non-market data to maintain their "real-time indicator" status. Neutral data points should use slate grays to prevent visual fatigue.

## Typography

This system exclusively utilizes **Manrope** to maintain a cohesive, modern look, but applies specific OpenType features for financial data. 

All currency rates, pip values, and balance figures must use **Tabular Figures** (`tnum`) to ensure columns align vertically, allowing for immediate visual comparison of magnitudes. **Label-Caps** are used for table headers and secondary metadata, providing a clear structural distinction from the primary data points. Font sizes are slightly reduced across the board to accommodate higher information density without sacrificing legibility.

## Layout & Spacing

The design uses a **Fluid Grid** within a 1440px max-width container. The layout philosophy is modular, treating the FX dashboard as a series of "Quick-Action Widgets" and "Data Grids."

- **Density:** We employ a "Compact" spacing rhythm. Table rows are 32px-40px in height to maximize data "above the fold."
- **Breakpoints:**
  - **Desktop (1280px+):** 12-column grid, 16px gutters.
  - **Tablet (768px-1279px):** 8-column grid, 12px gutters. Sidebars collapse to icon-only views.
  - **Mobile (<768px):** 4-column grid, single-column stack for data tables with horizontal scrolling for rates.

## Elevation & Depth

To maintain a "flat professional" aesthetic, depth is conveyed through **Tonal Layers** and **Low-Contrast Outlines**. 

The main workspace uses the Neutral slate background. Individual widgets and data cards use the white surface-container-lowest with a 1px `border-subtle` (#E2E8F0). Shadows are avoided for standard UI elements to keep the interface "crisp." Soft, blue-tinted shadows are reserved strictly for temporary overlays like currency selectors or time-frame dropdowns to indicate they sit above the analytical plane.

## Shapes

The shape language is **Soft** (0.25rem). This precision-based rounding ensures the UI feels modern without the "consumer-grade" playfulness of pill-shaped elements.

- **Action Buttons:** 4px radius.
- **Data Table Containers:** 4px radius.
- **Rate Change Indicators:** 2px radius (near-sharp) to maintain the technical feel of the data.
- **Sparklines:** Use a 1.5px stroke width with sharp joins to emphasize volatility.

## Components

### Dense Data Tables
Tables are the core of the FX module. Headers use `label-caps` with a subtle bottom border. Rows feature a hover state that tints the background to `surface-container` for precise tracking.

### Quick-Action Trading Widgets
Buy/Sell buttons are integrated directly into the rate displays. "Buy" buttons leverage a subtle `pip-up` tint in the background, while "Sell" uses a `pip-down` tint. The rate values are centered and use the `rate-display` style for maximum visibility.

### Sparklines (Mini-Trend Lines)
Used within tables to show 24h volatility. These should be 60px-80px wide. The line color should dynamically change to `pip-up` if the net change for the period is positive, or `pip-down` if negative. No fill/area gradients are used; only a clean 1.5px stroke.

### Input Fields
FX input fields (e.g., Lot Size, Stop Loss) should use a monospaced-style appearance for the numerical value. Stepper controls (+/-) should be integrated into the field borders to minimize horizontal space usage.

### Status Chips
Market status (Open/Closed) and execution states (Filled/Cancelled) use high-contrast caps text with no background fill, relying on a 1px border of the semantic color to indicate state.