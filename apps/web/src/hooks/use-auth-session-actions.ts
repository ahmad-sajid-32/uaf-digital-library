// apps/web/src/hooks/use-auth-session-actions.ts
/**
 * Centralized client auth session actions.
 *
 * This hook provides the single logout path for the current frontend and the
 * recovery path for protected API session failures. It keeps UI screens from
 * reimplementing sign-out logic and ensures expired sessions collapse into the
 * same recovery route.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";

import { signOut } from "@/lib/api/auth";
import {
  clearClientAuthTransientState,
  hasValidatedBrowserSession,
} from "@/lib/auth/session-client";
import {
  isSessionExpiredError,
} from "@/lib/auth/session-errors";
import { useAppAuth } from "@/hooks/use-app-auth";

interface LogoutOptions {
  redirectTo?: string;
  successMessage?: string | null;
  successToastId?: string;
  errorToastId?: string;
  errorFallback?: string;
}

interface RecoverFromSessionFailureOptions {
  redirectTo?: string;
  toastMessage?: string;
  toastId?: string;
}

export function useAuthSessionActions() {
  const { refreshAuthState } = useAppAuth();
  const [logoutPending, setLogoutPending] = React.useState(false);

  const logout = React.useCallback(
    async (options: LogoutOptions = {}): Promise<boolean> => {
      setLogoutPending(true);

      try {
        await signOut();
        clearClientAuthTransientState();
        await refreshAuthState();

        if (options.successMessage) {
          toast.success(options.successMessage, {
            id: options.successToastId,
          });
        }

        if (options.redirectTo) {
          window.location.replace(options.redirectTo);
        }

        return true;
      } catch (error: unknown) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : options.errorFallback ?? "Unable to sign out right now. Please try again.";

        toast.error(message, {
          id: options.errorToastId,
        });
        return false;
      } finally {
        setLogoutPending(false);
      }
    },
    [refreshAuthState],
  );

  const recoverFromSessionFailure = React.useCallback(
    async (
      error: unknown,
      options: RecoverFromSessionFailureOptions = {},
    ): Promise<boolean> => {
      if (!isSessionExpiredError(error)) {
        return false;
      }

      const sessionStillValid = await hasValidatedBrowserSession();

      if (sessionStillValid) {
        await refreshAuthState();
        return false;
      }

      try {
        await signOut();
      } catch {
        // The browser session may already be invalid. Local teardown is still
        // required, and the user still needs a recovery route.
      }

      clearClientAuthTransientState();
      await refreshAuthState();
      toast.error(
        options.toastMessage ?? "Your session expired. Please sign in again.",
        {
          id: options.toastId ?? "session-expired-recovery",
        },
      );
      window.location.replace(options.redirectTo ?? "/auth/session-expired");

      return true;
    },
    [refreshAuthState],
  );

  return {
    logoutPending,
    logout,
    recoverFromSessionFailure,
  };
}
