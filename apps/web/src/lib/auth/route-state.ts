// apps/web/src/lib/auth/route-state.ts
/**
 * Auth route-state helpers for public guest-facing auth screens.
 *
 * These helpers define which auth states may render guest auth screens and
 * which states should be blocked from screens such as login and forgot
 * password. Password setup and password reset flows remain token-driven and are
 * explicitly exempt from ordinary authenticated guest-route blocking.
 */

import { getPostLoginRedirectPath } from "@/lib/auth/navigation";
import type { AppAuthState } from "@/lib/auth/types";

export type GuestAuthRoute =
  | "login"
  | "forgot-password"
  | "reset-password"
  | "setup-password";

export interface GuestRouteResolution {
  loading: boolean;
  redirectPath: string | null;
  redirectMessage: string | null;
}

export interface GuestRouteOptions {
  suppressRedirect?: boolean;
  respectServerGuestRender?: boolean;
}

export function resolveGuestRouteState(
  route: GuestAuthRoute,
  auth: AppAuthState,
  options: GuestRouteOptions = {},
): GuestRouteResolution {
  const { status } = auth;
  const suppressRedirect = options.suppressRedirect ?? false;
  const respectServerGuestRender = options.respectServerGuestRender ?? false;

  if (status === "unknown") {
    return {
      loading: true,
      redirectPath: null,
      redirectMessage: null,
    };
  }

  if (route === "reset-password" || route === "setup-password") {
    return {
      loading: false,
      redirectPath: null,
      redirectMessage: null,
    };
  }

  if (suppressRedirect || respectServerGuestRender) {
    return {
      loading: false,
      redirectPath: null,
      redirectMessage: null,
    };
  }

  switch (status) {
    case "authenticated":
    case "verification_required":
    case "access_denied":
      return {
        loading: false,
        redirectPath: getPostLoginRedirectPath(auth),
        redirectMessage:
          status === "verification_required"
            ? "Restoring your account status..."
            : status === "access_denied"
              ? "Checking your account access..."
              : "Redirecting to your dashboard...",
      };
    case "password_setup_required":
      return {
        loading: false,
        redirectPath: "/setup-password",
        redirectMessage: "Restoring your password setup session...",
      };
    default:
      return {
        loading: false,
        redirectPath: null,
        redirectMessage: null,
      };
  }
}
