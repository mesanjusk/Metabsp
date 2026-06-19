import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';

// ── Metabsp (WhatsApp Cloud) providers & components ─────────────────────────
import { AuthProvider }       from './context/AuthContext';
import { ToastContainer }     from './Components/Toast';
import { ROUTES }             from './constants/routes';
import Layout                 from './Pages/Layout';
import Login                  from './Pages/login';
import CloudSignup            from './Pages/Signup';
import CloudForgotPassword    from './Pages/ForgotPassword';
import WhatsAppCloudDashboard from './Pages/WhatsAppCloudDashboard';
import PublicLanding          from './Pages/PublicLanding';
import PrivacyPolicy          from './Pages/PrivacyPolicy';
import TechProviderHub        from './Pages/techProvider/TechProviderHub';
import TechProviderLayout     from './Pages/techProvider/TechProviderLayout';
import MyWabas                from './Pages/techProvider/MyWabas';
import EmbeddedSignupBuilder  from './Pages/techProvider/EmbeddedSignupBuilder';
import WebhookViewer          from './Pages/techProvider/WebhookViewer';
import PaidMessaging          from './Pages/techProvider/PaidMessaging';
import BusinessAssets         from './Pages/techProvider/BusinessAssets';
import { useAuth }            from './context/AuthContext';
import theme                  from './theme';

// ── Bulk (WhatsApp Automation) providers & components ────────────────────────
import { AuthProvider as BulkAuthProvider } from './context/BulkAuthContext';
import { LiveProvider }    from './context/LiveContext';
import ProtectedRoute      from './components/ProtectedRoute';
import AppShell            from './components/AppShell';
import AppUpdatePrompt     from './components/pwa/AppUpdatePrompt';
import { MODULE_PERMISSIONS } from './utils/accessControl';

// ── Bulk pages ────────────────────────────────────────────────────────────────
import LoginPage              from './pages/LoginPage';
import SignupPage             from './pages/SignupPage';
import ForgotPasswordPage     from './pages/ForgotPasswordPage';
import DashboardPage          from './pages/DashboardPage';
import NotificationsPage      from './pages/NotificationsPage';
import AdminPage              from './pages/AdminPage';
import WhatsAppPage           from './pages/WhatsAppPage';
import SuperAdminSettingsPage from './pages/SuperAdminSettingsPage';
import RolesPage              from './pages/RolesPage';
import UsersPage              from './pages/UsersPage';

// ─────────────────────────────────────────────────────────────────────────────
// Metabsp WhatsApp Cloud redirect / protected route helpers
// ─────────────────────────────────────────────────────────────────────────────
function AuthRedirect() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to={ROUTES.WHATSAPP} replace /> : <PublicLanding />;
}

function CloudProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  return children;
}

function BulkLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}

const bulkProtectedPages = [
  ['/dashboard',            <DashboardPage />,         MODULE_PERMISSIONS.dashboard],
  ['/notifications',        <NotificationsPage />,     MODULE_PERMISSIONS.notifications],
  ['/admin',                <AdminPage />,             MODULE_PERMISSIONS.admin],
  ['/whatsapp-bulk',        <WhatsAppPage />,          MODULE_PERMISSIONS.whatsapp],
  ['/super-admin/settings', <SuperAdminSettingsPage />,MODULE_PERMISSIONS.superAdminSettings],
  ['/roles',                <RolesPage />,             null],
  ['/users',                <UsersPage />,             null],
];

// ─────────────────────────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AuthProvider>
        <BulkAuthProvider>
          <LiveProvider>

            <Router>
              <ToastContainer />
              <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
                <Routes>

                  {/* ── Metabsp WhatsApp Cloud routes ──────────────────────── */}
                  <Route path={ROUTES.LOGIN} element={<LoginCloudGate />} />
                  <Route path={ROUTES.SIGNUP} element={<CloudSignup />} />
                  <Route path={ROUTES.FORGOT_PASSWORD} element={<CloudForgotPassword />} />
                  <Route
                    path={ROUTES.WHATSAPP}
                    element={
                      <CloudProtectedRoute>
                        <Layout />
                      </CloudProtectedRoute>
                    }
                  >
                    <Route index element={<WhatsAppCloudDashboard />} />
                  </Route>

                  {/* ── Tech Provider routes (Metabsp auth protected) ───────── */}
                  <Route
                    path="/tech-provider"
                    element={
                      <CloudProtectedRoute>
                        <TechProviderLayout />
                      </CloudProtectedRoute>
                    }
                  >
                    <Route index element={<TechProviderHub />} />
                    <Route path="wabas" element={<MyWabas />} />
                    <Route path="embedded-signup" element={<EmbeddedSignupBuilder />} />
                    <Route path="webhooks" element={<WebhookViewer />} />
                    <Route path="paid-messaging" element={<PaidMessaging />} />
                    <Route path="assets" element={<BusinessAssets />} />
                  </Route>

                  {/* ── Public pages (no auth required) ───────────────────── */}
                  <Route path="/privacy-policy"  element={<PrivacyPolicy />} />

                  {/* ── Bulk auth routes ────────────────────────────────────── */}
                  <Route path="/bulk-login"      element={<LoginPage />} />
                  <Route path="/signup"          element={<SignupPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                  {/* ── Bulk protected routes ───────────────────────────────── */}
                  {bulkProtectedPages.map(([path, page, permission]) => (
                    <Route
                      key={path}
                      path={path}
                      element={
                        <ProtectedRoute permission={permission}>
                          <BulkLayout>{page}</BulkLayout>
                        </ProtectedRoute>
                      }
                    />
                  ))}

                  <Route path="/" element={<AuthRedirect />} />
                  <Route path="*" element={<AuthRedirect />} />

                </Routes>

                <AppUpdatePrompt />
              </Box>
            </Router>

          </LiveProvider>
        </BulkAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function LoginCloudGate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to={ROUTES.WHATSAPP} replace /> : <Login />;
}
