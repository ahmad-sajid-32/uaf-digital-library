// apps/web/src/hooks/use-guest-route-state.ts
/**
 * Client hook for guest-route auth state checks.
 *
 * This hook does not implement protected-route authorization. It only models
 * whether guest auth screens should render normally or block an already-active
 * authenticated session from using guest-only screens such as login and forgot
 * password.
 */

"use client";

import * as React from "react";

import type { GuestAuthRoute } from "@/lib/auth/route-state";
import { resolveGuestRouteState } from "@/lib/auth/route-state";
import { useAppAuth } from "@/hooks/use-app-auth";

export function useGuestRouteState(route: GuestAuthRoute) {
  const { auth, hydrated } = useAppAuth();

  return React.useMemo(() => {
    const resolution = resolveGuestRouteState(
      route,
      hydrated
        ? auth
        : {
            ...auth,
            status: "unknown",
          },
    );

    return {
      ...resolution,
      auth,
      hydrated,
    };
  }, [auth, hydrated, route]);
}
