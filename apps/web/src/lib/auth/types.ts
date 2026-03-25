// apps/web/src/lib/auth/types.ts
/**
 * Normalized auth types for the UAF Smart E-Library frontend.
 *
 * These types define the application's auth boundary so raw Supabase payloads
 * do not leak across the UI. Business role is normalized from
 * `app_metadata.role`, while session state is reduced to only the fields the
 * frontend actually needs for routing, access hints, and rendering decisions.
 */

export type AppAuthStatus =
  | "unknown"
  | "unauthenticated"
  | "verification_required"
  | "password_setup_required"
  | "authenticated"
  | "access_denied"
  | "expired";

export type AppRole = "student" | "librarian" | "admin";

export interface AppAuthState {
  status: AppAuthStatus;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: AppRole | null;
  emailConfirmed: boolean;
  expiresAtUtc: string | null;
  rememberMe: boolean;
  timezone: string;
  sessionId: string | null;
}
