// apps/web/src/hooks/useGuestRouteState.ts
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

import type {
  GuestAuthRoute,
  GuestRouteOptions,
} from "@/lib/auth/route-state";
import { resolveGuestRouteState } from "@/lib/auth/route-state";
import { useAppAuth } from "@/hooks/useAppAuth";

export function useGuestRouteState(
  route: GuestAuthRoute,
  options: GuestRouteOptions = {},
) {
  const { auth, hydrated } = useAppAuth();
  const suppressRedirect = options.suppressRedirect ?? false;

  return React.useMemo(() => {
    const resolution = resolveGuestRouteState(
      route,
      hydrated
        ? auth
        : {
            ...auth,
            status: "unknown",
          },
      {
        suppressRedirect,
      },
    );

    return {
      ...resolution,
      auth,
      hydrated,
    };
  }, [auth, hydrated, route, suppressRedirect]);
}
