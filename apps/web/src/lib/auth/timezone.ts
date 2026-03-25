// apps/web/src/lib/auth/timezone.ts
/**
 * Timezone resolution helpers for auth and app-shell initialization.
 *
 * Canonical timestamps remain in UTC. These helpers only resolve the user's
 * preferred display timezone using the approved precedence order:
 * explicit preference, browser timezone, Asia/Karachi, then UTC.
 */

const TIMEZONE_FALLBACK = "Asia/Karachi";
const UTC_TIMEZONE = "UTC";

function isValidTimezone(value: string | null | undefined): value is string {
  if (!value || !value.trim()) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveBrowserTimezone(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimezone(browserTimezone) ? browserTimezone : null;
}

export function resolveDisplayTimezone(options?: {
  preferredTimezone?: string | null;
  browserTimezone?: string | null;
}): string {
  const preferredTimezone = options?.preferredTimezone ?? null;
  const browserTimezone =
    options?.browserTimezone ?? resolveBrowserTimezone();

  if (isValidTimezone(preferredTimezone)) {
    return preferredTimezone;
  }

  if (isValidTimezone(browserTimezone)) {
    return browserTimezone;
  }

  if (isValidTimezone(TIMEZONE_FALLBACK)) {
    return TIMEZONE_FALLBACK;
  }

  return UTC_TIMEZONE;
}
