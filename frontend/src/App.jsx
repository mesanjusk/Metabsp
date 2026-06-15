import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Box } from '@mui/material';
import { ToastContainer } from './Components/Toast';
import { useAuth } from './context/AuthContext';
import { ROUTES } from './constants/routes';
import Layout from './Pages/Layout';
import Login from './Pages/login';
import WhatsAppCloudDashboard from './Pages/WhatsAppCloudDashboard';

function AuthRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? ROUTES.WHATSAPP : ROUTES.LOGIN} replace />;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <ToastContainer />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
        <Routes>
          <Route
            path={ROUTES.LOGIN}
            element={isAuthenticated ? <Navigate to={ROUTES.WHATSAPP} replace /> : <Login />}
          />
          <Route
            path={ROUTES.WHATSAPP}
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<WhatsAppCloudDashboard />} />
          </Route>
          <Route path={ROUTES.ROOT} element={<AuthRedirect />} />
          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? ROUTES.WHATSAPP : ROUTES.LOGIN} replace />}
          />
        </Routes>
      </Box>
    </Router>
  );
}
