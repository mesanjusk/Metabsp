import { alpha, createTheme } from '@mui/material/styles';

const WHATSAPP_GREEN = '#25d366';
const WHATSAPP_DARK = '#111b21';
const WHATSAPP_PANEL = '#202c33';
const BG = '#e9edef';
const PAPER = '#ffffff';
const BORDER = '#d1d7db';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: WHATSAPP_GREEN,
      dark: '#128c7e',
      contrastText: '#05260f',
    },
    secondary: {
      main: WHATSAPP_DARK,
      dark: '#0b141a',
      contrastText: '#fff',
    },
    background: {
      default: BG,
      paper: PAPER,
    },
    text: {
      primary: '#111b21',
      secondary: '#667781',
    },
    divider: BORDER,
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: "Inter, Roboto, 'Segoe UI', Arial, sans-serif",
    fontSize: 13,
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 700 },
  },
  Components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: '100%' },
        body: { height: '100%' },
        '#root': { height: '100%' },
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
          fontWeight: 600,
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
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '&.Mui-selected': {
            backgroundColor: alpha(WHATSAPP_GREEN, 0.12),
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderTop: `1px solid ${BORDER}`,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            color: WHATSAPP_PANEL,
          },
        },
      },
    },
  },
});

export default lightTheme;
