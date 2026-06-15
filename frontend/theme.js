import { alpha, createTheme } from '@mui/material/styles';

const SKY = '#38bdf8';
const SKY_DARK = '#0284c7';
const DEEP = '#0f172a';
const SLATE = '#475569';
const PAPER = '#ffffff';
const BG = '#eef6fb';
const BORDER = '#d7e6ef';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: SKY,
      dark: SKY_DARK,
      light: '#7dd3fc',
      contrastText: '#ffffff',
    },
    secondary: {
      main: DEEP,
      dark: '#020617',
      light: '#334155',
      contrastText: '#ffffff',
    },
    success: {
      main: '#22c55e',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
    background: {
      default: BG,
      paper: PAPER,
    },
    text: {
      primary: DEEP,
      secondary: SLATE,
    },
    divider: BORDER,
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "Inter, Roboto, 'Segoe UI', Arial, sans-serif",
    fontSize: 13,
    h5: {
      fontSize: '1.05rem',
      fontWeight: 700,
    },
    subtitle1: {
      fontSize: '0.95rem',
      fontWeight: 700,
    },
    subtitle2: {
      fontSize: '0.88rem',
      fontWeight: 700,
    },
    body2: {
      fontSize: '0.82rem',
    },
    caption: {
      fontSize: '0.74rem',
    },
  },
  Components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: '100%' },
        body: { height: '100%' },
        '#root': { height: '100%' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.92),
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${BORDER}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${BORDER}`,
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 700,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#fff',
        },
      },
    },
  },
});

export default lightTheme;
