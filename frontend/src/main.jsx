import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App.jsx';
import './apiClient.js';
import theme from './theme.js';
import './index.css';

// App.jsx already wraps itself in AuthProvider + BulkAuthProvider — this used
// to double-wrap AuthProvider here too, which was redundant.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
