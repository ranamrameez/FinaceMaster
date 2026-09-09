---
name: Equilibrium Finance
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
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
  tertiary-container: '#2a1700'
  on-tertiary-container: '#b87500'
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
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
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
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

The design system is engineered for high-stakes financial environments where clarity, precision, and trust are paramount. The brand personality is authoritative yet accessible, positioning the platform as a sophisticated tool for serious wealth management.

The aesthetic follows a **Modern Corporate** style with **Minimalist** leanings. It prioritizes information density and structural logic over decorative flair. The emotional response should be one of "calm control"—the user feels empowered by data rather than overwhelmed by it. High whitespace in navigational areas is balanced by high-density data grids, ensuring that critical figures are always the focal point.

## Colors

The palette is anchored by "Trust Blue" (#0F172A), a deep, nearly-black navy used for primary branding and headers to convey stability. "Success Green" (#10B981) is reserved strictly for positive financial trends, gains, and completed transaction states. 

"Balanced Gray" serves as the foundational background color to reduce eye strain during long sessions. Neutral scales are used to create a clear hierarchy between labels (mid-tone grays) and secondary data. For data visualizations, use a sequential scale of blues and teals, ensuring high contrast against the white surface containers.

## Typography

This design system utilizes a tiered typographic approach. **Manrope** is used for headlines to provide a modern, refined executive feel. **Work Sans** handles the bulk of body text due to its exceptional legibility and professional character. 

Crucially, **JetBrains Mono** is employed for numerical data, currency indicators, and transaction IDs. Its monospaced nature ensures that columns of numbers align perfectly in tables, allowing users to scan for magnitude and changes effortlessly. Use `label-caps` for table headers and metadata categories to distinguish them from the data they describe.

## Layout & Spacing

The system employs a **Fixed Grid** model on desktop (12 columns, 1440px max-width) to maintain a controlled, professional presentation of complex dashboards. 

- **Desktop:** 12 columns, 24px gutters, 80px side margins.
- **Tablet:** 8 columns, 16px gutters, 40px side margins.
- **Mobile:** 4 columns, 16px gutters, 16px side margins.

Data-heavy tables should use a "Compact" vertical rhythm (8px or 12px cell padding) to maximize the information visible above the fold, while marketing and landing pages should use "Spacious" rhythm (48px+ padding) to improve readability and brand perception.

## Elevation & Depth

To maintain a "flat but layered" professional look, this design system uses **Tonal Layers** and **Low-Contrast Outlines** instead of heavy shadows. 

The primary surface is white. Secondary containers (like sidebar navigation or secondary widgets) use "Balanced Gray" (#F8FAFC). Interactive elements like cards use a subtle 1px border (#E2E8F0) that darkens slightly on hover. Shadows are reserved exclusively for "High-Trust" overlays like modals or dropdown menus, utilizing a very soft, highly diffused blue-tinted shadow (e.g., `0 10px 25px -5px rgba(15, 23, 42, 0.1)`).

## Shapes

The shape language is **Soft** (0.25rem base radius). This subtle rounding takes the "edge" off the corporate aesthetic without appearing too playful or informal. 

- **Inputs & Buttons:** 4px (Soft) radius.
- **Cards & Modals:** 8px (Large) radius.
- **Status Indicators:** Fully rounded (pill) to distinguish them from interactive buttons.
- **Data Bars:** Sharp or very slightly rounded (2px) to maintain the geometric integrity of charts.

## Components

### Buttons
Primary buttons use "Trust Blue" with white text. Secondary buttons use a white fill with a 1px border. Success actions (e.g., "Confirm Investment") may use "Success Green" to provide positive reinforcement.

### Data Visualization
Charts should use a consistent stroke weight of 2px. Grid lines within charts must be the lightest gray possible (#F1F5F9). Use a palette of Blues and Teals for multi-series data, ensuring the primary series is always the darkest.

### Multi-Currency Indicators
Currency symbols should be styled in the `data-tabular` font. When displaying multiple currencies, use the ISO code (USD, EUR) in `label-caps` next to the value. Positive changes are indicated by a leading "+" and Success Green text; negative by a "−" and Error Red.

### Transaction States
- **Pending:** Amber background-tint with Amber text, utilizing a "Clock" icon.
- **Completed:** Success Green tint with Success Green text, utilizing a "Check" icon.
- **Failed:** Red tint with Red text, utilizing an "Alert" icon.
These states should appear as "Chips" with high-contrast text for immediate recognizability.

### Input Fields
Inputs should have a clear "Focus" state using a 2px Trust Blue ring. Labels must always be visible (never placeholder-only) to ensure users don't lose context while filling out complex financial forms.