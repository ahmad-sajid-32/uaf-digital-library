// apps/web/src/lib/auth/preferences.ts
/**
 * Non-secret auth preference cookie helpers.
 *
 * These helpers manage small UX preference cookies such as remember-me,
 * preferred timezone, and last known business role. They are not used as
 * authorization truth and never store access tokens or refresh tokens.
 */

"use client";

import type { AppRole } from "@/lib/auth/types";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function shouldUseSecureCookies(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.protocol === "https:";
}

export interface AuthPreferenceSnapshot {
  rememberMe: boolean;
  preferredTimezone: string | null;
  lastRole: AppRole | null;
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookiePrefix = `${name}=`;
  const rawCookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookiePrefix));

  if (!rawCookie) {
    return null;
  }

  return decodeURIComponent(rawCookie.slice(cookiePrefix.length));
}

function writeCookie(name: string, value: string, maxAgeSeconds = ONE_YEAR_SECONDS) {
  if (typeof document === "undefined") {
    return;
  }

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (shouldUseSecureCookies()) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const parts = [
    `${name}=`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (shouldUseSecureCookies()) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

export function readAuthPreferenceSnapshot(): AuthPreferenceSnapshot {
  const rememberMe = readCookieValue("remember_me") === "true";
  const preferredTimezone = readCookieValue("preferred_timezone");
  const lastRoleValue = readCookieValue("last_role");
  const lastRole =
    lastRoleValue === "student" ||
    lastRoleValue === "librarian" ||
    lastRoleValue === "admin"
      ? lastRoleValue
      : null;

  return {
    rememberMe,
    preferredTimezone,
    lastRole,
  };
}

export function persistAuthPreferences(options: {
  rememberMe: boolean;
  preferredTimezone: string;
  lastRole?: AppRole | null;
}): void {
  writeCookie("remember_me", options.rememberMe ? "true" : "false");
  writeCookie("preferred_timezone", options.preferredTimezone);

  if (options.lastRole) {
    writeCookie("last_role", options.lastRole);
  }
}

export function clearLastRolePreference(): void {
  clearCookie("last_role");
}
