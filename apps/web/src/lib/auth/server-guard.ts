// apps/web/src/lib/auth/server-guard.ts
/**
 * Server-side auth guard helpers for middleware and protected layouts.
 *
 * These helpers turn a validated Supabase user into a coarse auth routing
 * decision. They are used for route protection only; backend authorization and
 * RLS remain the real access control boundary for data.
 */

import type { User } from "@supabase/supabase-js";

import { isEmailConfirmed, normalizeAppRole } from "@/lib/auth/normalize-auth";
import type { AppRole } from "@/lib/auth/types";

export type ServerAuthStatus =
  | "unauthenticated"
  | "verification_required"
  | "access_denied"
  | "authenticated";

export type AuthStateRoute =
  | "/auth/verify-required"
  | "/auth/access-denied"
  | "/auth/session-expired";

export interface ServerAuthResolution {
  status: ServerAuthStatus;
  role: AppRole | null;
}

export function getRoleDashboardPath(role: AppRole): string {
  switch (role) {
    case "student":
      return "/student/catalog";
    case "librarian":
      return "/librarian/dashboard";
    case "admin":
      return "/admin/dashboard";
  }
}

export function resolveServerAuthResolution(
  user: User | null,
): ServerAuthResolution {
  if (!user) {
    return {
      status: "unauthenticated",
      role: null,
    };
  }

  const role = normalizeAppRole(user.app_metadata?.role);

  if (!isEmailConfirmed(user)) {
    return {
      status: "verification_required",
      role,
    };
  }

  if (!role) {
    return {
      status: "access_denied",
      role: null,
    };
  }

  return {
    status: "authenticated",
    role,
  };
}

export function getServerLoginRedirectPath(user: User | null): string | null {
  const auth = resolveServerAuthResolution(user);

  switch (auth.status) {
    case "authenticated":
      return auth.role ? getRoleDashboardPath(auth.role) : "/auth/access-denied";
    case "verification_required":
      return "/auth/verify-required";
    case "access_denied":
      return "/auth/access-denied";
    default:
      return null;
  }
}

export function getProtectedRoleRedirectPath(
  user: User | null,
  requiredRole: AppRole,
): string | null {
  const auth = resolveServerAuthResolution(user);

  switch (auth.status) {
    case "unauthenticated":
      return "/login";
    case "verification_required":
      return "/auth/verify-required";
    case "access_denied":
      return "/auth/access-denied";
    case "authenticated":
      return auth.role === requiredRole
        ? null
        : "/auth/access-denied?reason=forbidden";
  }
}

export function getAuthStateRouteRedirectPath(
  route: AuthStateRoute,
  user: User | null,
  reason?: string | null,
): string | null {
  const auth = resolveServerAuthResolution(user);

  if (route === "/auth/session-expired") {
    return auth.status === "authenticated" && auth.role
      ? getRoleDashboardPath(auth.role)
      : auth.status === "verification_required"
        ? "/auth/verify-required"
        : auth.status === "access_denied"
          ? "/auth/access-denied"
          : null;
  }

  if (route === "/auth/access-denied" && reason === "forbidden") {
    switch (auth.status) {
      case "authenticated":
        return auth.role ? null : "/auth/access-denied";
      case "access_denied":
        return null;
      case "verification_required":
        return "/auth/verify-required";
      default:
        return "/login";
    }
  }

  if (route === "/auth/verify-required") {
    switch (auth.status) {
      case "verification_required":
        return null;
      case "authenticated":
        return auth.role ? getRoleDashboardPath(auth.role) : "/auth/access-denied";
      case "access_denied":
        return "/auth/access-denied";
      default:
        return "/login";
    }
  }

  switch (auth.status) {
    case "access_denied":
      return null;
    case "authenticated":
      return auth.role ? getRoleDashboardPath(auth.role) : "/auth/access-denied";
    case "verification_required":
      return "/auth/verify-required";
    default:
      return "/login";
  }
}
