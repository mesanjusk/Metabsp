import { alpha, createTheme, Theme } from '@mui/material/styles';
import { accent, brand, layout, neutral, radius, semantic, shadows } from './tokens';

/**
 * The MUI theme, built from lib/ui/tokens.ts.
 *
 * Both schemes are produced by one factory so a token can never be defined for
 * light and forgotten for dark — the commonest way a dark mode ends up with an
 * unreadable component nobody noticed.
 *
 * Typography is a real scale rather than MUI's defaults with a couple of
 * weights overridden. Base size is 14px: the previous theme set 13, which put
 * dense tables and chat metadata below comfortable reading size on a laptop.
 */

const fontStack = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(', ');

const monoStack = ['"JetBrains Mono"', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'].join(', ');

const typography = {
  fontFamily: fontStack,
  fontSize: 14,
  // Headings are tightened as they grow: display sizes at default tracking
  // look loose, body sizes at display tracking look cramped.
  h1: { fontSize: '2.75rem', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.022em' },
  h2: { fontSize: '2.125rem', fontWeight: 750, lineHeight: 1.18, letterSpacing: '-0.019em' },
  h3: { fontSize: '1.625rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.014em' },
  h4: { fontSize: '1.3125rem', fontWeight: 700, lineHeight: 1.32, letterSpacing: '-0.01em' },
  h5: { fontSize: '1.0625rem', fontWeight: 650, lineHeight: 1.4, letterSpacing: '-0.005em' },
  h6: { fontSize: '0.9375rem', fontWeight: 650, lineHeight: 1.45 },
  subtitle1: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.6 },
  caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: '0.005em' },
  overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.6, textTransform: 'uppercase' as const },
  button: { fontSize: '0.875rem', fontWeight: 600, letterSpacing: 0, textTransform: 'none' as const },
};

function buildPalette(mode: 'light' | 'dark') {
  const isLight = mode === 'light';

  return {
    mode,
    primary: {
      main: isLight ? brand[600] : brand[400],
      light: isLight ? brand[400] : brand[300],
      dark: isLight ? brand[800] : brand[600],
      contrastText: isLight ? '#FFFFFF' : neutral[950],
    },
    secondary: {
      main: isLight ? accent[600] : accent[400],
      light: accent[400],
      dark: accent[600],
      contrastText: isLight ? '#FFFFFF' : neutral[950],
    },
    success: { ...semantic.success, main: isLight ? semantic.success.main : '#4ADE80', contrastText: isLight ? '#FFFFFF' : neutral[950] },
    warning: { ...semantic.warning, main: isLight ? semantic.warning.main : '#FBBF24', contrastText: isLight ? '#FFFFFF' : neutral[950] },
    error: { ...semantic.error, main: isLight ? semantic.error.main : '#F87171', contrastText: isLight ? '#FFFFFF' : neutral[950] },
    info: { ...semantic.info, main: isLight ? semantic.info.main : '#60A5FA', contrastText: isLight ? '#FFFFFF' : neutral[950] },
    background: {
      // The app sits on the tinted `default`; every card and panel is `paper`
      // on top of it. That one step of contrast is what gives the layout
      // depth without a single shadow.
      default: isLight ? neutral[100] : neutral[950],
      paper: isLight ? '#FFFFFF' : neutral[900],
    },
    text: {
      primary: isLight ? neutral[900] : neutral[100],
      secondary: isLight ? neutral[600] : neutral[400],
      disabled: isLight ? neutral[400] : neutral[600],
    },
    divider: isLight ? neutral[200] : alpha(neutral[300], 0.14),
    action: {
      hover: isLight ? alpha(neutral[900], 0.04) : alpha('#FFFFFF', 0.06),
      selected: isLight ? alpha(brand[600], 0.1) : alpha(brand[400], 0.16),
      disabledBackground: isLight ? neutral[200] : alpha('#FFFFFF', 0.08),
    },
  };
}

function buildComponents(mode: 'light' | 'dark'): Theme['components'] {
  const isLight = mode === 'light';
  const resting = isLight ? shadows.resting : shadows.restingDark;
  const raised = isLight ? shadows.raised : shadows.raisedDark;
  const overlay = isLight ? shadows.overlay : shadows.overlayDark;

  return {
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: '100%', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
        body: { height: '100%' },
        // A visible, consistent focus ring everywhere. Browsers' defaults vary
        // and MUI removes several of them; keyboard navigation through a
        // dashboard this large is unusable without one, and it is the single
        // most-cited finding in any accessibility review.
        ':focus-visible': {
          outline: `2px solid ${isLight ? brand[600] : brand[400]}`,
          outlineOffset: 2,
        },
        // Scrollbars in the long lists (conversations, contacts, logs) are
        // otherwise the loudest element on the screen.
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: isLight ? neutral[300] : neutral[700],
          borderRadius: radius.pill,
          border: `2px solid ${isLight ? neutral[100] : neutral[950]}`,
        },
        '*::-webkit-scrollbar-thumb:hover': { backgroundColor: isLight ? neutral[400] : neutral[600] },
        '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: isLight ? neutral[200] : alpha(neutral[300], 0.14) },
        elevation1: { boxShadow: resting },
        elevation2: { boxShadow: raised },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0, variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: radius.lg, overflow: 'hidden' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: radius.md, paddingInline: 16, minHeight: 38 },
        sizeSmall: { minHeight: 32, paddingInline: 12 },
        sizeLarge: { minHeight: 46, paddingInline: 24, fontSize: '0.9375rem' },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': { boxShadow: resting },
        },
        // A text button that only changes colour on hover gives no feedback on
        // a dense toolbar; a background does.
        text: { '&:hover': { backgroundColor: isLight ? alpha(neutral[900], 0.05) : alpha('#FFFFFF', 0.07) } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: radius.md } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.pill, fontWeight: 600, height: 26 },
        sizeSmall: { height: 22, fontSize: '0.75rem' },
        outlined: { borderColor: isLight ? neutral[300] : alpha(neutral[300], 0.2) },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          backgroundColor: isLight ? '#FFFFFF' : alpha('#FFFFFF', 0.03),
          '& .MuiOutlinedInput-notchedOutline': { borderColor: isLight ? neutral[300] : alpha(neutral[300], 0.18) },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: isLight ? neutral[400] : alpha(neutral[300], 0.3) },
        },
        input: { paddingBlock: 11 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          '&.Mui-selected': {
            backgroundColor: isLight ? alpha(brand[600], 0.1) : alpha(brand[400], 0.16),
            color: isLight ? brand[800] : brand[200],
            '&:hover': { backgroundColor: isLight ? alpha(brand[600], 0.14) : alpha(brand[400], 0.22) },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, minHeight: 44, fontSize: '0.875rem' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 2.5, borderRadius: radius.pill },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: radius.sm,
          backgroundColor: isLight ? neutral[800] : neutral[700],
          fontSize: '0.75rem',
          paddingBlock: 6,
          paddingInline: 10,
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: radius.xl, boxShadow: overlay } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: '1.0625rem', fontWeight: 700, paddingBottom: 8 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: isLight ? neutral[200] : alpha(neutral[300], 0.12) },
        head: {
          fontWeight: 650,
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: isLight ? neutral[500] : neutral[400],
          backgroundColor: isLight ? neutral[50] : alpha('#FFFFFF', 0.02),
        },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: radius.md, alignItems: 'flex-start' } },
    },
    MuiSkeleton: { defaultProps: { animation: 'wave' } },
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: { root: { fontWeight: 550 } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: isLight ? neutral[200] : alpha(neutral[300], 0.14) } },
    },
  };
}

function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: buildPalette(mode) as any,
    typography,
    shape: { borderRadius: radius.md },
    // MUI wants exactly 25 entries. Collapsing them onto the two-value system
    // from tokens.ts keeps elevation a deliberate choice instead of a number
    // someone picked because it looked about right.
    shadows: [
      'none',
      ...Array.from({ length: 8 }, () => (mode === 'light' ? shadows.resting : shadows.restingDark)),
      ...Array.from({ length: 8 }, () => (mode === 'light' ? shadows.raised : shadows.raisedDark)),
      ...Array.from({ length: 8 }, () => (mode === 'light' ? shadows.overlay : shadows.overlayDark)),
    ] as any,
    components: buildComponents(mode),
  });
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
export { layout };
export default lightTheme;
