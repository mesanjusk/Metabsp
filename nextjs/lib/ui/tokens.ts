/**
 * Design tokens.
 *
 * One place that decides what the product looks like, so a colour is chosen
 * once and referenced everywhere rather than being retyped as a hex literal in
 * forty components. Before this, panels hardcoded `#111b21`, `#25d366` and
 * `#e9edef` inline — WhatsApp's own consumer chrome — which made the product
 * look like a reskin of the app it integrates with and made any change to the
 * look a find-and-replace across the codebase.
 *
 * ── The palette is lavender on a true greyscale ─────────────────────────────
 * One hue carries the brand and nothing else competes with it: lavender for
 * everything the product owns — chrome, primary actions, focus, charts — on a
 * neutral ramp that runs white to black with no tint at all. The palette was
 * previously a deep teal on a warm grey with an amber accent. Teal reads as an
 * adjacent shade of the WhatsApp green this product integrates with, and a
 * second decorative hue meant two colours were always arguing about which one
 * the eye should go to.
 *
 * A Business Solution Provider is a distinct company operating on top of
 * WhatsApp, not WhatsApp. Meta's brand guidelines are explicit that partners
 * must not present WhatsApp's marks or visual identity as their own, and a
 * dashboard painted in #25D366 on #111B21 reads as exactly that to a reviewer.
 * Lavender cannot be mistaken for it.
 *
 * ── What is still allowed to be another colour ──────────────────────────────
 * `semantic` below, and `WHATSAPP_CONNECTED`. Those are not brand: a red error
 * and a green "this number is connected" carry information, and a monochrome
 * error state is a state the eye stops finding. They appear as an alert, a
 * badge or a status dot — never as chrome, a surface or a chart series.
 *
 * Every foreground/background pair below was chosen to clear WCAG AA (4.5:1
 * for body text, 3:1 for large text and UI boundaries) in both schemes.
 */

// True greyscale, white through black. A grey with a trace of any hue muddies
// the one brand colour doing all of this product's signalling.
export const neutral = {
  25: '#FCFCFC',
  50: '#F8F8F8',
  100: '#F2F2F2',
  200: '#E6E6E6',
  300: '#D0D0D0',
  400: '#9B9B9B',
  500: '#6E6E6E',
  600: '#525252',
  700: '#3D3D3D',
  800: '#272727',
  900: '#171717',
  950: '#0A0A0A',
};

// Primary: lavender. The only hue the product owns, so every step earns its
// place — 600 is the action colour on light, 400 on dark, 900 the nav rail.
export const brand = {
  50: '#F6F4FE',
  100: '#EDE9FD',
  200: '#DCD5FB',
  300: '#C3B6F7',
  400: '#A48EF0',
  500: '#8B6FE8',
  600: '#7551D8',
  700: '#6040B8',
  800: '#4E3495',
  900: '#3E2A77',
};

// There is no second decorative hue any more. `accent` keeps its name so the
// theme and its callers go on working, and points at the deep end of the same
// lavender: a secondary action is now a darker step of the primary rather than
// a different colour competing with it for the eye.
export const accent = {
  400: brand[400],
  500: brand[500],
  600: brand[700],
};

export const semantic = {
  success: { light: '#DCFCE7', main: '#15803D', dark: '#14532D' },
  warning: { light: '#FEF3C7', main: '#B45309', dark: '#78350F' },
  error: { light: '#FEE2E2', main: '#B91C1C', dark: '#7F1D1D' },
  info: { light: '#DBEAFE', main: '#1D4ED8', dark: '#1E3A8A' },
};

// The one sanctioned use of WhatsApp's own green: a connection indicator,
// where the colour carries meaning rather than identity.
export const WHATSAPP_CONNECTED = '#25D366';

/**
 * Shadows are a two-value system on purpose: a resting elevation and a raised
 * one. Products drift into eight barely-distinguishable shadows when each
 * component picks its own; two forces a real decision about hierarchy.
 */
export const shadows = {
  resting: '0 1px 2px rgba(10, 10, 10, 0.06), 0 1px 3px rgba(10, 10, 10, 0.04)',
  raised: '0 8px 24px rgba(10, 10, 10, 0.10), 0 2px 6px rgba(10, 10, 10, 0.05)',
  overlay: '0 24px 48px rgba(10, 10, 10, 0.18), 0 8px 16px rgba(10, 10, 10, 0.08)',
  restingDark: '0 1px 2px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)',
  raisedDark: '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35)',
  overlayDark: '0 24px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.4)',
};

// A 4px base grid. MUI's spacing(1) === 8px, so these are named multiples
// rather than a competing scale.
export const radius = {
  sm: 8,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
};

/**
 * Spacing and surface rules from the premium-dashboard guide, as tokens.
 *
 * The guide's numbers are opinions worth holding to: a 24px gutter, 24px of padding inside every
 * card, and — the one this design system was missing — three background tiers rather than two.
 * "Never flat white-on-white" is the rule, and a card sitting on `paper` inside a section that is
 * also `paper` is exactly that: two surfaces with no edge between them but a border.
 */
export const surface = {
  /** The page itself. */
  base: { light: neutral[100], dark: neutral[950] },
  /** Cards and panels on top of the page. */
  card: { light: '#FFFFFF', dark: neutral[900] },
  /** A tier above a card — a nested block, a table header, a highlighted row. */
  elevated: { light: neutral[50], dark: neutral[800] },
};

/**
 * Sizes the MUI variants do not cover.
 *
 * The guide puts hero KPI numbers at 28–36px; MUI's h4 is 21px here, and it is already the page
 * title. A KPI that shares a size with the heading above it is not a hero number, it is another
 * line of text — so this is its own step rather than a variant override that would resize every
 * heading in the product.
 */
export const typeScale = {
  kpi: '2rem',
};

export const spacing = {
  /** Between cards in a grid. The guide's 12-column gutter. */
  gutter: 24,
  /** Inside a card, equal on all four sides. */
  cardPadding: 24,
  /** The same, on a phone, where 24 on both sides costs a seventh of the width. */
  cardPaddingCompact: 16,
};

export const layout = {
  sidebarWidth: 256,
  sidebarCollapsedWidth: 72,
  topBarHeight: 68,
  contentMaxWidth: 1440,

  /**
   * The mobile tab bar's own height, before the phone's gesture inset.
   *
   * 60 rather than MUI's default 56: the bar carries an icon over a label, and at 56 with a
   * 0.75rem label the two are 2px apart, which is what "the text is overlapping" looks like on a
   * 360px phone. It is also the number the main scroll area pads itself by, so the two are read
   * from here rather than guessed in two places — they were previously 56 and `pb: 7` (also 56),
   * which left the last line of a page sitting exactly under the bar with nothing between them.
   */
  mobileTabBarHeight: 60,

  /**
   * Bottom chrome plus the phone's own inset.
   *
   * `env(safe-area-inset-bottom)` is 34px on a gesture-navigation Android or a notched iPhone and
   * 0 everywhere else, and it only reports a real number because the viewport is declared
   * `viewport-fit=cover` (app/layout.tsx). Without adding it, the tab bar sits *under* the system
   * gesture pill: the labels are half-covered and the last row of any list is unreachable.
   */
  mobileTabBarTotal: 'calc(60px + env(safe-area-inset-bottom, 0px))',
};

/**
 * Chart colours, per scheme.
 *
 * Charts cannot borrow the UI palette wholesale: a series colour has to clear the same surface in
 * both schemes, and two marks in one figure have to stay apart for a reader who cannot separate
 * them by hue — which is a stricter test than "looks fine next to a button".
 *
 * With one brand hue there is no categorical palette to build, and there should not be one: a
 * second hue invented for "series 2" would be the decorative colour this palette just removed. So
 * `series` is an ordinal pair — two steps of the same lavender, far enough apart in lightness to
 * read as two things, each clearing its own surface. It is checked for monotonic lightness, step
 * size, single hue and light-end contrast rather than for categorical hue separation, and a figure
 * using it always labels both marks: a lightness step alone is not identity.
 *
 * A figure that would need a genuinely categorical third colour is the wrong figure — split it
 * into small multiples instead.
 */
export const chart = {
  light: {
    // Dark step first: a lone series, and the larger half of a part-to-whole, take the strong one.
    series: [brand[700], brand[400]],
    grid: neutral[200],
    axis: neutral[500],
    track: neutral[200],
    surface: '#FFFFFF',
  },
  dark: {
    series: [brand[300], brand[700]],
    grid: neutral[800],
    axis: neutral[400],
    track: neutral[800],
    surface: neutral[900],
  },
};

/** The chart palette for a resolved scheme. */
export function chartPalette(mode: 'light' | 'dark' = 'light') {
  return mode === 'dark' ? chart.dark : chart.light;
}
