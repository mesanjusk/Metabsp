"use client";

import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "@/lib/video/components/ui/tooltip";

/**
 * The studio's provider stack, as it exists inside Metabsp.
 *
 * NextAuth's `SessionProvider` used to wrap this. Metabsp holds its session in `lib/ui/AuthContext`
 * — already mounted above every dashboard route — so adding a second session context here would
 * mean two sources of truth for who is signed in, and the one this file could offer would be empty.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
