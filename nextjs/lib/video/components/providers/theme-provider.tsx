"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Dark mode for the studio's own screens.
 *
 * The props are spelled out here rather than taken from `ComponentProps<typeof NextThemesProvider>`.
 * In this repository's install layout that type resolves without its `children` member, so handing
 * the provider its children fails to compile even though the component renders them — and chasing a
 * package's type resolution across an npm workspace is a worse dependency than four prop names that
 * have not changed in years.
 */
type ThemeProviderProps = {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

const Provider = NextThemesProvider as unknown as (props: ThemeProviderProps) => JSX.Element;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <Provider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </Provider>
  );
}
