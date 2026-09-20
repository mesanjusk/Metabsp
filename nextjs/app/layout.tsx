import { headers } from 'next/headers';
import ThemeRegistry from '@/lib/ui/ThemeRegistry';
import { AuthProvider } from '@/lib/ui/AuthContext';
import { ToastContainer } from '@/lib/ui/components/Toast';
import PwaProvider from '@/lib/ui/app/PwaProvider';

export const metadata = {
  title: 'SanjuSK — WhatsApp Business Solution Provider',
  applicationName: 'SanjuSK',
  manifest: '/manifest.webmanifest',
  // Names the installed app on an iOS home screen and keeps it in standalone mode; iOS reads none
  // of this from the web manifest.
  appleWebApp: { capable: true, title: 'SanjuSK', statusBarStyle: 'default' as const },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  description:
    'A WhatsApp Business Solution Provider on Meta’s official Cloud API: shared inbox, message templates, broadcasts, automations and a REST API.',
  // Meta reads this from the home page to prove we control the domain, which
  // is what unlocks the Business Manager domain-scoped permissions. It lives
  // in the root metadata rather than in the landing page so it is present on
  // every route — Meta's crawler has been known to follow a redirect (a
  // signed-in visitor is bounced from `/` to the dashboard) and check
  // whatever it lands on.
  other: {
    'facebook-domain-verification': '6yo212xlow0dqvwuhh3tl9tup31bzk',
  },
};

/**
 * Viewport, separately from metadata because Next requires it that way since 14.
 *
 * `viewportFit: 'cover'` is the piece that makes the rest of the mobile layout possible: without
 * it the page is laid out inside the safe area and `env(safe-area-inset-*)` reports 0 everywhere,
 * so the tab bar cannot be lifted clear of a phone's gesture pill. With it, the page owns the full
 * screen and every inset is honoured explicitly — see DashboardShell.
 *
 * `maximumScale` is deliberately absent. Locking zoom is the single most common accessibility
 * failure in an app that wants to feel native, and it is not needed: every tap target here already
 * clears 44px.
 *
 * themeColor paints the Android status bar and the desktop title bar the brand teal, in both
 * schemes, which is most of what separates an installed app from a browser tab.
 */
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F4FE' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
};

/**
 * Page background and foreground, as plain CSS custom properties.
 *
 * These deliberately do NOT come from the MUI theme, and that is the whole
 * point. The Emotion cache this app uses is created with `prepend: true`, so
 * every style the client inserts lands ABOVE the server-rendered ones in the
 * cascade. The server can only ever render the light theme — it cannot know a
 * preference that lives in localStorage and a media query — so its light
 * `body { background; color }` rule permanently outranked anything the client
 * inserted afterwards. A visitor whose OS is set to dark got a light page
 * background with dark body text behind correctly-dark cards: unreadable, and
 * invisible to anyone testing in light mode.
 *
 * Custom properties resolved against `data-theme` sidestep the cascade fight
 * entirely, and are applied before first paint by the script below — so there
 * is no flash of the wrong background either.
 */
const COLOR_SCHEME_CSS = `
:root {
  --app-bg: #F6F4FE;
  --app-fg: #171717;
  color-scheme: light;
}
:root[data-theme='dark'] {
  --app-bg: #0A0A0A;
  --app-fg: #F2F2F2;
  color-scheme: dark;
}
html, body {
  background-color: var(--app-bg);
  color: var(--app-fg);
}
`;

/**
 * Runs before first paint, so the correct background is on screen from the
 * very first frame rather than after hydration. Wrapped in try/catch because
 * reading localStorage throws outright in a private window with site data
 * blocked, and a theme preference is never worth breaking a page over.
 */
const COLOR_SCHEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('metabsp:color-scheme');
    var dark = stored === 'dark' ||
      ((!stored || stored === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
`;

/**
 * AuthProvider has to sit above everything that calls useAuth — including the
 * public marketing pages, since the landing page redirects a signed-in visitor
 * to the dashboard. Without it those pages fail to prerender outright.
 */
/**
 * Every route renders per request.
 *
 * The Content-Security-Policy carries a per-request nonce (see middleware.ts),
 * and a page prerendered at build time would embed whichever nonce happened to
 * be current then — which matches nothing at request time, so the browser
 * blocks its own hydration script and the page arrives dead. Rendering
 * dynamically is what makes a nonce-based policy possible at all.
 *
 * The cost is small here specifically: this app runs as a persistent Node
 * process, not as functions, so there is no cold start to pay per request.
 */
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Middleware puts the nonce here. Absent only if something bypassed
  // middleware entirely, in which case the inline script below is dropped
  // rather than emitted unnonced — the page still works, it just starts in
  // light mode until hydration corrects it.
  const nonce = (await headers()).get('x-nonce') || undefined;

  return (
    <html lang="en" style={{ height: '100%' }} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_CSS }} />
        {nonce ? <script nonce={nonce} dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_SCRIPT }} /> : null}
      </head>
      <body style={{ height: '100%', margin: 0 }}>
        <ThemeRegistry>
          <AuthProvider>
            {children}
            {/* Mounted once at the root so any component can call toast()
                without threading a prop through the tree. */}
            <ToastContainer />
            {/* Registers the service worker and offers the install prompt. Rendering it at the
                root rather than inside the dashboard matters: a visitor who lands on the marketing
                page should be able to install the app from there too. */}
            <PwaProvider />
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
