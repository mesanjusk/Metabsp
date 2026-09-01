'use client';

import * as React from 'react';

export type ColorSchemePreference = 'light' | 'dark' | 'system';

interface ColorSchemeValue {
  preference: ColorSchemePreference;
  resolved: 'light' | 'dark';
  setPreference: (next: ColorSchemePreference) => void;
}

const STORAGE_KEY = 'metabsp:color-scheme';

const ColorSchemeContext = React.createContext<ColorSchemeValue>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => {},
});

export const useColorScheme = () => React.useContext(ColorSchemeContext);

/**
 * Light/dark preference, with "follow the OS" as the default.
 *
 * Server-rendered markup cannot know the visitor's preference, so the first
 * paint is always light and the effect below corrects it — reading
 * localStorage during render would produce a hydration mismatch instead.
 * `mounted` keeps the two passes identical until the browser has had its say.
 */
export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ColorSchemePreference>('system');
  const [systemDark, setSystemDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
    } catch {
      /* storage blocked — the default preference simply does not persist */
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setPreference = React.useCallback((next: ColorSchemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* as above */
    }
  }, []);

  const resolved: 'light' | 'dark' = !mounted
    ? 'light'
    : preference === 'system'
    ? systemDark
      ? 'dark'
      : 'light'
    : preference;

  // The inline script in app/layout.tsx sets this before first paint; keeping
  // it in step here is what makes the toggle in the account menu repaint the
  // page background, not just the components. The CSS custom properties that
  // hang off this attribute are what the document background actually reads.
  React.useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (resolved === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }, [mounted, resolved]);

  const value = React.useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}
