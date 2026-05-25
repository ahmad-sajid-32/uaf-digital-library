// apps/web/src/lib/auth/normalize-auth.ts
/**
 * Auth normalization helpers for converting Supabase session/user payloads into
 * stable application auth state.
 *
 * Security rules enforced here:
 * - Business role is derived from `app_metadata.role`, not `user.role`.
 * - Email verification is derived from `email_confirmed_at`.
 * - Unknown or missing business role becomes `access_denied`, not a guessed role.
 */

import type { Session, User } from "@supabase/supabase-js";

import type { AppAuthState, AppRole } from "@/lib/auth/types";
import { resolveDisplayTimezone } from "@/lib/auth/timezone";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);

  try {
    if (typeof window === "undefined") {
      return JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<
        string,
        unknown
      >;
    }

    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveSessionId(accessToken: string | null | undefined): string | null {
  if (!accessToken) {
    return null;
  }

  const payload = decodeJwtPayload(accessToken);
  const sessionId = payload?.session_id;

  return typeof sessionId === "string" && sessionId.trim()
    ? sessionId
    : null;
}

export function normalizeAppRole(roleValue: unknown): AppRole | null {
  if (typeof roleValue !== "string") {
    return null;
  }

  switch (roleValue.trim().toLowerCase()) {
    case "student":
      return "student";
    case "librarian":
      return "librarian";
    case "admin":
      return "admin";
    default:
      return null;
  }
}

export function isEmailConfirmed(user: User | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at);
}

export function mapSessionToAppAuthState(
  session: Session | null,
  options?: {
    rememberMe?: boolean;
    preferredTimezone?: string | null;
  },
): AppAuthState {
  const rememberMe = options?.rememberMe ?? false;
  const timezone = resolveDisplayTimezone({
    preferredTimezone: options?.preferredTimezone ?? null,
  });

  if (!session?.user) {
    return {
      status: "unauthenticated",
      userId: null,
      email: null,
      fullName: null,
      avatarImageUrl: null,
      role: null,
      emailConfirmed: false,
      expiresAtUtc: null,
      rememberMe,
      timezone,
      sessionId: null,
    };
  }

  const user = session.user;
  const role = normalizeAppRole(user.app_metadata?.role);
  const emailConfirmed = isEmailConfirmed(user);
  const expiresAtUtc = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;
  const fullName =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name
      : null;

  let status: AppAuthState["status"] = "authenticated";

  if (!emailConfirmed) {
    status = "verification_required";
  } else if (!role) {
    status = "access_denied";
  }

  return {
    status,
    userId: user.id,
    email: user.email ?? null,
    fullName,
    avatarImageUrl: null,
    role,
    emailConfirmed,
    expiresAtUtc,
    rememberMe,
    timezone,
    sessionId: resolveSessionId(session.access_token),
  };
}
