import ThemeRegistry from '@/lib/ui/ThemeRegistry';
import { AuthProvider } from '@/lib/ui/AuthContext';
import { ToastContainer } from '@/lib/ui/components/Toast';

export const metadata = {
  title: 'MetaBSP — WhatsApp Business Solution Provider',
  description:
    'A WhatsApp Business Solution Provider on Meta’s official Cloud API: shared inbox, message templates, broadcasts, automations and a REST API.',
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
  --app-bg: #F1F3F7;
  --app-fg: #161A24;
  color-scheme: light;
}
:root[data-theme='dark'] {
  --app-bg: #0D1017;
  --app-fg: #F1F3F7;
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_SCRIPT }} />
      </head>
      <body style={{ height: '100%', margin: 0 }}>
        <ThemeRegistry>
          <AuthProvider>
            {children}
            {/* Mounted once at the root so any component can call toast()
                without threading a prop through the tree. */}
            <ToastContainer />
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
