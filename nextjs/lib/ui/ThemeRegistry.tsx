'use client';

import * as React from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { useServerInsertedHTML } from 'next/navigation';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { lightTheme, darkTheme } from './theme';
import { ColorSchemeProvider, useColorScheme } from './ColorSchemeContext';

/**
 * Emotion + MUI for the App Router.
 *
 * The Vite entry could just wrap <App/> in ThemeProvider, because everything
 * rendered in the browser. Here the first paint happens on the server, and
 * Emotion generates its class names during that render — so the <style> tags
 * it produces have to be handed to Next explicitly via useServerInsertedHTML.
 * Without this the server HTML arrives unstyled and restyles on hydration,
 * which is the flash of unstyled content.
 *
 * `prepend: true` keeps Emotion's styles ahead of any other stylesheet in the
 * cascade, so MUI's defaults stay overridable.
 */
export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache = createCache({ key: 'mui', prepend: true });
    cache.compat = true;

    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) inserted.push(serialized.name);
      return prevInsert(...args);
    };

    const flush = () => {
      const prev = inserted;
      inserted = [];
      return prev;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;

    let styles = '';
    for (const name of names) styles += cache.inserted[name];

    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ColorSchemeProvider>
        <ThemedChildren>{children}</ThemedChildren>
      </ColorSchemeProvider>
    </CacheProvider>
  );
}

/**
 * Split out so it can call useColorScheme — a component cannot consume a
 * context its own render provides. CssBaseline lives here rather than in the
 * registry above so that switching scheme repaints the document background
 * too, not just the components.
 */
function ThemedChildren({ children }: { children: React.ReactNode }) {
  const { resolved } = useColorScheme();
  const theme = resolved === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      {/* Component-level resets only. The page background and foreground come
          from the CSS custom properties in app/layout.tsx — see the note there
          for why they cannot come from the theme. */}
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
