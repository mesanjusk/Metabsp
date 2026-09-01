'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '@/lib/ui/AuthContext';
import { ROUTES } from '@/lib/constants/routes';
import DashboardShell from '@/lib/ui/app/DashboardShell';

/**
 * Replaces App.jsx's CloudProtectedRoute + Pages/Layout.jsx.
 *
 * The react-router version could redirect during render:
 *
 *     if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
 *
 * That is not safe here. The session lives in localStorage, so on the server
 * isAuthenticated is ALWAYS false — redirecting during render would bounce
 * every signed-in user to /login on their first paint. The check has to wait
 * for the client, which is what the effect does.
 *
 * Until it resolves we render a spinner rather than the dashboard, so a signed
 * -out visitor never sees dashboard chrome flash before the redirect. This is
 * a UX gate, not a security boundary: every /api route authenticates the
 * bearer token server-side regardless of what the browser chooses to render.
 */
export default function DashboardLayout({ children }) {
  const { isAuthenticated, isSessionLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Waiting for isSessionLoading matters: the session is restored from
    // storage in an effect, so on the very first frame nobody is signed in
    // yet. Redirecting then would bounce every signed-in user to the login
    // page and back on every page load.
    if (!isSessionLoading && !isAuthenticated) router.replace(ROUTES.LOGIN);
  }, [isAuthenticated, isSessionLoading, router]);

  if (isSessionLoading || !isAuthenticated) {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
