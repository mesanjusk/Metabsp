import ThemeRegistry from '@/lib/ui/ThemeRegistry';
import { AuthProvider } from '@/lib/ui/AuthContext';
import { ToastContainer } from '@/lib/ui/components/Toast';

export const metadata = {
  title: 'MetaBSP — WhatsApp Business Solution Provider',
  description:
    'A Meta-authorized WhatsApp Business Solution Provider helping businesses communicate at scale.',
};

/**
 * The Vite app wrapped <App/> in ThemeProvider at the entry point and put
 * AuthProvider inside App. Both live here now.
 *
 * AuthProvider has to sit above everything that calls useAuth — including the
 * public marketing pages, since the landing page redirects a signed-in visitor
 * to the dashboard. Without it those pages fail to prerender outright:
 * "useAuth must be used within an AuthProvider".
 *
 * The full-height chain was `html, body, #root` in the Vite CSS. Next renders
 * into <body> directly, so there is no #root and the chain ends there.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', margin: 0 }}>
        <ThemeRegistry>
          <AuthProvider>
            {children}
            {/* The Vite App.jsx mounted this once at the app root; same here, so
                any component can call toast() without threading a prop. */}
            <ToastContainer />
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
