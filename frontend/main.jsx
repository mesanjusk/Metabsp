import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme.js';
import './index.css';
import { toast } from './Components';
import { initOfflineQueue } from './utils/offlineQueue.js';
import './apiClient.js';
import { AuthProvider } from './context/AuthContext.jsx';

const nativeAlert = window.alert.bind(window);

window.alert = (msg) => {
  if (typeof msg === 'string' && msg.trim()) {
    toast(msg);
    return;
  }
  nativeAlert(msg);
};

initOfflineQueue();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.warn('Service worker registration failed');
    });
  });
}