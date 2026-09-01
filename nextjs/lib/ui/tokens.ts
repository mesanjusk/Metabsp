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
  lg: 14,
  xl: 20,
  pill: 999,
};

export const layout = {
  sidebarWidth: 248,
  sidebarCollapsedWidth: 72,
  topBarHeight: 60,
  contentMaxWidth: 1440,
};
