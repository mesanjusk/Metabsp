import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';

// ── Public pages (no auth required) ──────────────────────────────────────────
import PrivacyPolicyPage    from './pages/public/PrivacyPolicyPage';
import TermsOfServicePage   from './pages/public/TermsOfServicePage';
import CookiePolicyPage     from './pages/public/CookiePolicyPage';
import DataDeletionPage     from './pages/public/DataDeletionPage';
import SecurityInfoPage     from './pages/public/SecurityPage';
import AboutPage            from './pages/public/AboutPage';
import ContactPage          from './pages/public/ContactPage';
import HelpCenterPage       from './pages/public/HelpCenterPage';
import DeveloperDocsPage    from './pages/public/DeveloperDocsPage';
import StatusPage           from './pages/public/StatusPage';
import MetaAppReviewPage    from './pages/public/MetaAppReviewPage';

// ── Auth-protected app pages ──────────────────────────────────────────────────
import TechProviderDashboard  from './pages/TechProviderDashboard';
import WhatsAppManagementPage from './pages/WhatsAppManagementPage';
import OnboardingWizardPage   from './pages/OnboardingWizardPage';
import SecurityDashboardPage  from './pages/SecurityDashboardPage';
import DocumentationPage      from './pages/DocumentationPage';

// ── Metabsp (WhatsApp Cloud) providers & components ─────────────────────────
import { AuthProvider }       from './context/AuthContext';
import { ToastContainer }     from './Components/Toast';
import { ROUTES }             from './constants/routes';
import Layout                 from './Pages/Layout';
import Login                  from './Pages/login';
import CloudSignup            from './Pages/Signup';
import CloudForgotPassword    from './Pages/ForgotPassword';
import WhatsAppCloudDashboard from './Pages/WhatsAppCloudDashboard';
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
import MagicLoginPage         from './pages/MagicLoginPage';
import DashboardPage          from './pages/DashboardPage';
import NotificationsPage      from './pages/NotificationsPage';
import AdminPage              from './pages/AdminPage';
import WhatsAppPage           from './pages/WhatsAppPage';
import SuperAdminSettingsPage from './pages/SuperAdminSettingsPage';
import RolesPage              from './pages/RolesPage';
import UsersPage              from './pages/UsersPage';
import RoutingAdminPage       from './pages/RoutingAdminPage';

// ─────────────────────────────────────────────────────────────────────────────
// Metabsp WhatsApp Cloud redirect / protected route helpers
// ─────────────────────────────────────────────────────────────────────────────
function AuthRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? ROUTES.WHATSAPP : ROUTES.LOGIN} replace />;
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
  ['/admin/routing',        <RoutingAdminPage />,      MODULE_PERMISSIONS.admin],
  ['/whatsapp-bulk',        <WhatsAppPage />,          MODULE_PERMISSIONS.whatsapp],
  ['/super-admin/settings', <SuperAdminSettingsPage />,MODULE_PERMISSIONS.superAdminSettings],
  ['/roles',                <RolesPage />,             null],
  ['/users',                <UsersPage />,             null],
  // ── Meta compliance & management pages ──────────────────────────────────
  ['/tech-provider',        <TechProviderDashboard />, null],
  ['/whatsapp-management',  <WhatsAppManagementPage />,null],
  ['/onboarding',           <OnboardingWizardPage />,  null],
  ['/security',             <SecurityDashboardPage />, null],
  ['/docs',                 <DocumentationPage />,     null],
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

                  {/* ── Bulk auth routes ────────────────────────────────────── */}
                  <Route path="/bulk-login"      element={<LoginPage />} />
                  <Route path="/signup"          element={<SignupPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/magic-login"     element={<MagicLoginPage />} />

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

                  {/* ── Public pages (no auth) ─────────────────────────── */}
                  <Route path="/privacy-policy"   element={<PrivacyPolicyPage />} />
                  <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                  <Route path="/cookie-policy"    element={<CookiePolicyPage />} />
                  <Route path="/data-deletion"    element={<DataDeletionPage />} />
                  <Route path="/security-info"    element={<SecurityInfoPage />} />
                  <Route path="/about"            element={<AboutPage />} />
                  <Route path="/contact"          element={<ContactPage />} />
                  <Route path="/help-center"      element={<HelpCenterPage />} />
                  <Route path="/developer-docs"   element={<DeveloperDocsPage />} />
                  <Route path="/status"           element={<StatusPage />} />
                  <Route path="/meta-app-review"  element={<MetaAppReviewPage />} />

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
