/**
 * Merged App.jsx
 *
 * Combines:
 *  - Metabsp: WhatsApp Cloud BSP routes (Login at /login, WhatsApp Cloud at /whatsapp)
 *  - Bulk-invite: Event management routes (Dashboard at /dashboard, /categories, /events, etc.)
 *
 * The Bulk-invite Baileys WhatsApp page is mounted at /whatsapp-bulk to avoid
 * conflicting with Metabsp's WhatsApp Cloud route at /whatsapp.
 *
 * Two independent auth systems are kept:
 *  - Metabsp AuthProvider (WhatsApp Cloud auth via authStorage/apiClient)
 *  - BulkAuthProvider (Bulk-invite event-management auth via /api/auth)
 * Both are injected at the root so each set of pages can consume its own context.
 */

import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';

// ── Metabsp (WhatsApp Cloud) providers & components ─────────────────────────
import { AuthProvider }       from './context/AuthContext';
import { ToastContainer }     from './Components/Toast';
import { ROUTES }             from './constants/routes';
import Layout                 from './Pages/Layout';
import Login                  from './Pages/login';
import WhatsAppCloudDashboard from './Pages/WhatsAppCloudDashboard';
import { useAuth }            from './context/AuthContext';
import theme                  from './theme';

// ── Bulk-invite (Event Management) providers & components ────────────────────
import { AuthProvider as BulkAuthProvider } from './context/BulkAuthContext';
import { LiveProvider }    from './context/LiveContext';
import ProtectedRoute      from './components/ProtectedRoute';
import AppShell            from './components/AppShell';
import AppUpdatePrompt     from './components/pwa/AppUpdatePrompt';
import { MODULE_PERMISSIONS } from './utils/accessControl';

// ── Bulk-invite pages ────────────────────────────────────────────────────────
import LoginPage              from './pages/LoginPage';
import SignupPage             from './pages/SignupPage';
import ForgotPasswordPage     from './pages/ForgotPasswordPage';
import DashboardPage          from './pages/DashboardPage';
import CategoriesPage         from './pages/CategoriesPage';
import NotificationsPage      from './pages/NotificationsPage';
import AdminPage              from './pages/AdminPage';
import WhatsAppPage           from './pages/WhatsAppPage';
import SuperAdminSettingsPage from './pages/SuperAdminSettingsPage';
import RegistrationClosedPage from './pages/RegistrationClosedPage';
import PublicVolunteerFormPage from './pages/PublicVolunteerFormPage';
import PublicInvitationPage   from './pages/PublicInvitationPage';
import PublicAnchorFormPage   from './pages/PublicAnchorFormPage';
import PublicStudentFormPage  from './pages/PublicStudentFormPage';
import PublicPhotoTemplatePage from './pages/PublicPhotoTemplatePage';
import EventsPage             from './pages/EventsPage';
import StudentsPage           from './pages/StudentsPage';
import AnchorsPage            from './pages/AnchorsPage';
import BudgetPage             from './pages/BudgetPage';
import StagePage              from './pages/StagePage';
import RolesPage              from './pages/RolesPage';
import UsersPage              from './pages/UsersPage';
import ResponsibilitiesPage   from './pages/ResponsibilitiesPage';
import SystemFlowPage         from './pages/SystemFlowPage';
import TemplateConfigPage     from './pages/TemplateConfigPage';

// ─────────────────────────────────────────────────────────────────────────────
// Metabsp WhatsApp Cloud redirect / protected route helpers
// (use the WhatsApp Cloud AuthContext via useAuth from AuthContext.jsx)
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

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-invite AppShell wrapper
// ─────────────────────────────────────────────────────────────────────────────
function BulkLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}

// Bulk-invite protected pages: [path, element, permission]
const bulkProtectedPages = [
  ['/dashboard',             <DashboardPage />,         MODULE_PERMISSIONS.dashboard],
  ['/categories',            <CategoriesPage />,        MODULE_PERMISSIONS.categories],
  ['/notifications',         <NotificationsPage />,     MODULE_PERMISSIONS.notifications],
  ['/admin',                 <AdminPage />,             MODULE_PERMISSIONS.admin],
  ['/whatsapp-bulk',         <WhatsAppPage />,          MODULE_PERMISSIONS.whatsapp],
  ['/super-admin/settings',  <SuperAdminSettingsPage />,MODULE_PERMISSIONS.superAdminSettings],
  ['/events',                <EventsPage />,            null],
  ['/students',              <StudentsPage />,          null],
  ['/anchors',               <AnchorsPage />,           null],
  ['/budget',                <BudgetPage />,            null],
  ['/stage',                 <StagePage />,             null],
  ['/roles',                 <RolesPage />,             null],
  ['/users',                 <UsersPage />,             null],
  ['/responsibilities',      <ResponsibilitiesPage />,  null],
  ['/system-flow',           <SystemFlowPage />,        null],
  ['/template-config',       <TemplateConfigPage />,    null],
];

// ─────────────────────────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Metabsp WhatsApp Cloud auth context */}
      <AuthProvider>
        {/* Bulk-invite event management auth context */}
        <BulkAuthProvider>
          {/* Live socket context (used by bulk-invite pages) */}
          <LiveProvider>

            <Router>
              <ToastContainer />
              <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
                <Routes>

                  {/* ── Metabsp WhatsApp Cloud routes ─────────────────────── */}
                  {/* Login for WhatsApp Cloud BSP */}
                  <Route path={ROUTES.LOGIN} element={<LoginCloudGate />} />

                  {/* WhatsApp Cloud dashboard (protected by Cloud auth) */}
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

                  {/* ── Bulk-invite public routes ─────────────────────────── */}
                  <Route path="/bulk-login"          element={<LoginPage />} />
                  <Route path="/signup"              element={<SignupPage />} />
                  <Route path="/forgot-password"     element={<ForgotPasswordPage />} />
                  <Route path="/volunteer-register"  element={<PublicVolunteerFormPage />} />
                  <Route path="/public-invite"       element={<PublicInvitationPage />} />
                  <Route path="/registration-closed" element={<RegistrationClosedPage />} />
                  <Route path="/public-anchor-form"  element={<PublicAnchorFormPage />} />
                  <Route path="/public-student-form" element={<PublicStudentFormPage />} />
                  <Route path="/public-photo-template" element={<PublicPhotoTemplatePage />} />

                  {/* ── Bulk-invite protected routes ──────────────────────── */}
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

                  {/* ── Root redirect ─────────────────────────────────────── */}
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

/**
 * LoginCloudGate — renders Metabsp Login or redirects if already authenticated.
 * Needs to be inside AuthProvider so it can call useAuth().
 */
function LoginCloudGate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to={ROUTES.WHATSAPP} replace /> : <Login />;
}
