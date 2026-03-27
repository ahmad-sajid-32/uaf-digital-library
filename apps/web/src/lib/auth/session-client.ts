// apps/web/src/lib/auth/session-client.ts
/**
 * Client-side auth session teardown and revalidation helpers.
 *
 * These helpers do not own session authority. They only clear local transient
 * state and revalidate browser auth state when the app needs to recover from a
 * sign-out or an expired protected session.
 */

"use client";

import { clearLastRolePreference } from "@/lib/auth/preferences";
import { readSupabaseBrowserUser } from "@/lib/supabase/client";

const AUTH_TRANSIENT_STORAGE_KEYS = [
  "uaf-setup-password-recovery-access",
  "uaf-reset-password-recovery-access",
] as const;

export function clearClientAuthTransientState(): void {
  if (typeof window !== "undefined") {
    for (const key of AUTH_TRANSIENT_STORAGE_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  }

  clearLastRolePreference();
}

export async function hasValidatedBrowserSession(): Promise<boolean> {
  const { user, error } = await readSupabaseBrowserUser();

  if (error) {
    return false;
  }

  return Boolean(user);
}
