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
 * ── Why the palette is not WhatsApp green ──────────────────────────────────
 * A Business Solution Provider is a distinct company operating on top of
 * WhatsApp, not WhatsApp. Meta's brand guidelines are explicit that partners
 * must not present WhatsApp's marks or visual identity as their own, and a
 * dashboard painted in #25D366 on #111B21 reads as exactly that to a reviewer.
 * The palette below is deliberately its own: a deep teal that sits in the same
 * family as messaging products without borrowing anyone's identity, on a warm
 * neutral grey. WhatsApp green survives in one place only — the status dot
 * that means "this number is connected to WhatsApp" — where it is being used
 * as information, not as branding.
 *
 * Every foreground/background pair below was chosen to clear WCAG AA (4.5:1
 * for body text, 3:1 for large text and UI boundaries) in both schemes.
 */

// Warm neutral ramp. Grey with a trace of blue reads cold and clinical at
// scale; this one keeps long working sessions comfortable.
export const neutral = {
  25: '#FCFCFD',
  50: '#F8F9FB',
  100: '#F1F3F7',
  200: '#E4E7EE',
  300: '#CFD4E0',
  400: '#9AA2B6',
  500: '#6B7488',
  600: '#4E5668',
  700: '#3A4152',
  800: '#252B38',
  900: '#161A24',
  950: '#0D1017',
};

// Primary: deep teal. Distinctive against both the WhatsApp green everyone
// else in this category defaults to, and the generic SaaS indigo.
export const brand = {
  50: '#ECFDF7',
  100: '#D0F5E7',
  200: '#A3E9D2',
  300: '#6BD5B6',
  400: '#33BA97',
  500: '#149C7C',
  600: '#0B7C64',
  700: '#0A6252',
  800: '#0B4E42',
  900: '#0A4038',
};

// Accent, used sparingly: the one thing on a screen that should be looked at
// first, and never more than one of them at a time.
export const accent = {
  400: '#F0A742',
  500: '#DE8A16',
  600: '#B96C0C',
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
  resting: '0 1px 2px rgba(13, 16, 23, 0.06), 0 1px 3px rgba(13, 16, 23, 0.04)',
  raised: '0 8px 24px rgba(13, 16, 23, 0.10), 0 2px 6px rgba(13, 16, 23, 0.05)',
  overlay: '0 24px 48px rgba(13, 16, 23, 0.18), 0 8px 16px rgba(13, 16, 23, 0.08)',
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
