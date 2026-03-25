// apps/web/src/lib/auth/session-errors.ts
/**
 * Typed client-side session failure errors.
 *
 * These errors let protected API clients signal that the frontend should
 * revalidate auth state and recover through the session-expired path instead of
 * leaving the UI in a half-authenticated state.
 */

export class SessionExpiredError extends Error {
  readonly statusCode: number;

  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "SessionExpiredError";
    this.statusCode = 401;
  }
}

export function isSessionExpiredError(
  error: unknown,
): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}
