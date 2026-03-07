"use client";

// apps/web/src/components/theme-provider.tsx
/**
 * App-level theme provider for class-based dark mode.
 *
 * This wraps next-themes so the root layout can control the `dark` class
 * on the html element without leaking theme logic into page components.
 */

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps): React.JSX.Element {
  return (
    <NextThemesProvider storageKey="uaf-theme" {...props}>
      {children}
    </NextThemesProvider>
  );
}
