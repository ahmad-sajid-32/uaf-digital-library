// apps/web/src/hooks/useMobile.ts
/**
 * Responsive hook for detecting mobile viewport width.
 *
 * This keeps the sidebar primitives compatible with the current UI package set
 * by exposing a small boolean hook that tracks whether the viewport is below
 * the desktop breakpoint.
 */

"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const updateIsMobile = (event?: MediaQueryListEvent): void => {
      setIsMobile(event ? event.matches : mediaQuery.matches);
    };

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", updateIsMobile);
    };
  }, []);

  return isMobile;
}
