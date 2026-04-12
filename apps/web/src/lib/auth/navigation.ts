// apps/web/src/lib/auth/navigation.ts
/**
 * Auth navigation helpers for post-login routing.
 *
 * These helpers convert normalized auth state into stable route destinations.
 * They are used as routing hints only. Real authorization remains the
 * responsibility of backend validation, RLS, and later middleware/layout
 * guards.
 */

import type { AppAuthState } from "@/lib/auth/types";

export function getPostLoginRedirectPath(auth: AppAuthState): string {
  if (auth.status === "verification_required") {
    return "/auth/verify-required";
  }

  if (auth.status === "access_denied") {
    return "/auth/access-denied";
  }

  if (auth.status === "authenticated") {
    switch (auth.role) {
      case "student":
        return "/student/catalog";
      case "librarian":
        return "/librarian/dashboard";
      case "admin":
        return "/admin/dashboard";
      default:
        return "/auth/access-denied";
    }
  }

  return "/login";
}
