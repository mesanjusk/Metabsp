import { Inter } from 'next/font/google';

/**
 * The product's typeface, actually loaded.
 *
 * `lib/ui/tokens.ts` has named Inter at the head of its font stack since the design system was
 * written — and nothing ever fetched it. No `next/font`, no stylesheet link, no `@font-face`, so
 * every visitor fell through to `-apple-system` / `Segoe UI` / `Roboto` and saw a different
 * typeface on every platform. The theme's tracking is tuned for Inter's metrics (`-0.022em` on the
 * display sizes), and applied to a system font that tracking is simply wrong rather than absent.
 *
 * The giveaway that this was an oversight and not a decision: `lib/http/securityHeaders.js` already
 * allows `fonts.googleapis.com` in style-src and `fonts.gstatic.com` in font-src. Somebody set the
 * policy up for a font nobody ever linked.
 *
 * `next/font/google` rather than that link, now that the choice is being made deliberately: it
 * downloads the files at build time and serves them from this origin, so there is no third-party
 * request on the critical path, no render-blocking stylesheet, and `display: swap` plus a matched
 * fallback means no layout shift when it lands. The CSP entries stay — they cost nothing and the
 * public marketing pages may still want a display face one day.
 */
export const inter = Inter({
  subsets: ['latin'],
  // The weights the theme actually asks for. Loading the variable font whole would ship weight
  // axes nothing in this product uses.
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
  // Metric-matched fallback: the browser renders this until Inter arrives, sized so the swap does
  // not move a single line of text.
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});
