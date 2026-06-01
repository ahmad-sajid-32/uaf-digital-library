// apps/web/src/lib/auth/session-client.ts
/**
 * Client-side auth session teardown, password-link flow isolation, and
 * revalidation helpers.
 *
 * These helpers do not own session authority. Supabase remains the session
 * source of truth. This file only manages local transient markers that prevent
 * password recovery/setup sessions from being treated as normal app logins.
 */

"use client";

import { clearLastRolePreference } from "@/lib/auth/preferences";
import { readSupabaseBrowserUser } from "@/lib/supabase/client";

export type PasswordRouteSessionFlow = "reset" | "setup";

const RESET_PASSWORD_ACCESS_STORAGE_KEY = "uaf-reset-password-recovery-access";
const SETUP_PASSWORD_ACCESS_STORAGE_KEY = "uaf-setup-password-recovery-access";
const PASSWORD_ROUTE_SESSION_FLOW_STORAGE_KEY =
  "uaf-password-route-session-flow";
const PASSWORD_ROUTE_SESSION_MAX_AGE_MS = 10 * 60 * 1000;

const AUTH_TRANSIENT_STORAGE_KEYS = [
  SETUP_PASSWORD_ACCESS_STORAGE_KEY,
  RESET_PASSWORD_ACCESS_STORAGE_KEY,
  PASSWORD_ROUTE_SESSION_FLOW_STORAGE_KEY,
] as const;

function getPasswordRouteAccessParams(): URLSearchParams[] {
  if (typeof window === "undefined") {
    return [];
  }

  return [
    new URLSearchParams(window.location.search),
    new URLSearchParams(window.location.hash.slice(1)),
  ];
}

function isPasswordRoutePath(pathname: string): boolean {
  return pathname === "/reset-password" || pathname === "/setup-password";
}

function hasPasswordLinkParams(): boolean {
  const paramsList = getPasswordRouteAccessParams();

  return paramsList.some((params) => {
    const type = params.get("type");

    return Boolean(
      params.get("code") ||
      params.get("token_hash") ||
      (params.get("access_token") && params.get("refresh_token")) ||
      type === "recovery" ||
      type === "invite",
    );
  });
}

function readPasswordRouteSessionFlow(): PasswordRouteSessionFlow | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedFlow = window.sessionStorage.getItem(
    PASSWORD_ROUTE_SESSION_FLOW_STORAGE_KEY,
  );

  if (!storedFlow) {
    return null;
  }

  const [flow, timestampValue] = storedFlow.split(":");
  const timestamp = Number(timestampValue);
  const isKnownFlow = flow === "reset" || flow === "setup";
  const isFreshTimestamp =
    Number.isFinite(timestamp) &&
    Date.now() - timestamp <= PASSWORD_ROUTE_SESSION_MAX_AGE_MS;

  if (!isKnownFlow || !isFreshTimestamp) {
    window.sessionStorage.removeItem(PASSWORD_ROUTE_SESSION_FLOW_STORAGE_KEY);
    return null;
  }

  return flow;
}

export function getPasswordRouteAccessStorageKey(
  flow: PasswordRouteSessionFlow,
): string {
  return flow === "setup"
    ? SETUP_PASSWORD_ACCESS_STORAGE_KEY
    : RESET_PASSWORD_ACCESS_STORAGE_KEY;
}

export function markPasswordRouteSessionFlow(
  flow: PasswordRouteSessionFlow,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    PASSWORD_ROUTE_SESSION_FLOW_STORAGE_KEY,
    `${flow}:${Date.now()}`,
  );
}

export function clearPasswordRouteSessionFlow(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PASSWORD_ROUTE_SESSION_FLOW_STORAGE_KEY);
}

export function isPasswordRouteSessionFlowMarked(): boolean {
  return Boolean(readPasswordRouteSessionFlow());
}

export function isPasswordRouteSessionFlowActive(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!isPasswordRoutePath(window.location.pathname)) {
    return false;
  }

  return isPasswordRouteSessionFlowMarked() || hasPasswordLinkParams();
}

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
