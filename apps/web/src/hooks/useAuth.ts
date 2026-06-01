// apps/web/src/hooks/useAuth.ts
"use client";

import * as React from "react";
import type { EmailOtpType } from "@supabase/supabase-js";

import {
  exchangePasswordCodeForSession,
  getSession,
  requestPasswordReset,
  signInWithPassword,
  signOut,
  updatePassword,
  verifyPasswordOtp,
} from "@/lib/api/auth";
import { mapSessionToAppAuthState } from "@/lib/auth/normalize-auth";
import { getPostLoginRedirectPath } from "@/lib/auth/navigation";
import { persistAuthPreferences } from "@/lib/auth/preferences";
import {
  clearClientAuthTransientState,
  clearPasswordRouteSessionFlow,
  getPasswordRouteAccessStorageKey,
  markPasswordRouteSessionFlow,
  type PasswordRouteSessionFlow,
} from "@/lib/auth/session-client";
import { resolveDisplayTimezone } from "@/lib/auth/timezone";
import { useAppAuth } from "@/hooks/useAppAuth";

export interface PasswordChecks {
  minLength: boolean;
  uppercase: boolean;
  numberOrSpecial: boolean;
  matches: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function evaluatePasswordChecks(
  password: string,
  confirmPassword = "",
): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    numberOrSpecial: /[0-9]|[^A-Za-z0-9]/.test(password),
    matches: confirmPassword.length > 0 && password === confirmPassword,
  };
}

export function useLogin(): {
  submit: (
    email: string,
    password: string,
    options?: {
      rememberMe?: boolean;
    },
  ) => Promise<string | null>;
  handshakePending: boolean;
  loading: boolean;
  error: string | null;
} {
  const { refreshAuthState } = useAppAuth();
  const [handshakePending, setHandshakePending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = React.useCallback(
    async (
      email: string,
      password: string,
      options?: {
        rememberMe?: boolean;
      },
    ) => {
      const rememberMe = options?.rememberMe ?? false;
      const preferredTimezone = resolveDisplayTimezone();

      clearClientAuthTransientState();
      setHandshakePending(true);
      setError(null);

      try {
        const { session } = await signInWithPassword(email, password);
        const authState = mapSessionToAppAuthState(session, {
          rememberMe,
          preferredTimezone,
        });

        persistAuthPreferences({
          rememberMe,
          preferredTimezone: authState.timezone,
          lastRole: authState.role,
        });
        await refreshAuthState();

        return getPostLoginRedirectPath(authState);
      } catch (submitError: unknown) {
        await refreshAuthState();
        setError(
          getErrorMessage(
            submitError,
            "Unable to sign in. Please verify your credentials and try again.",
          ),
        );
        return null;
      } finally {
        setHandshakePending(false);
      }
    },
    [refreshAuthState],
  );

  return {
    submit,
    handshakePending,
    loading: handshakePending,
    error,
  };
}

export function useForgotPassword(): {
  submit: (email: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  success: boolean;
} {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const submit = React.useCallback(async (email: string) => {
    clearClientAuthTransientState();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
      return true;
    } catch (error: unknown) {
      setError(
        getErrorMessage(
          error,
          "Unable to send the reset link right now. Please try again.",
        ),
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error, success };
}

interface PasswordRouteOptions {
  successQueryKey?: "reset" | "setup";
}

type PasswordAccessType = "invite" | "recovery";
type PasswordInvalidReason =
  | "missing_or_unauthorized"
  | "expired_or_denied"
  | "verification_failed";

export function useResetPassword(options: PasswordRouteOptions = {}): {
  submit: (newPassword: string, confirmPassword: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  success: boolean;
  ready: boolean;
  invalidLink: boolean;
  accessType: PasswordAccessType;
  invalidReason: PasswordInvalidReason | null;
} {
  const { refreshAuthState } = useAppAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [invalidLink, setInvalidLink] = React.useState(false);
  const [accessType, setAccessType] = React.useState<PasswordAccessType>(
    options.successQueryKey === "setup" ? "invite" : "recovery",
  );
  const [invalidReason, setInvalidReason] =
    React.useState<PasswordInvalidReason | null>(null);
  const successQueryKey = options.successQueryKey ?? "reset";
  const passwordFlow: PasswordRouteSessionFlow =
    successQueryKey === "setup" ? "setup" : "reset";
  const accessStorageKey = getPasswordRouteAccessStorageKey(passwordFlow);

  React.useEffect(() => {
    let isMounted = true;
    const allowedAccessTypes: ReadonlySet<EmailOtpType> =
      successQueryKey === "setup"
        ? new Set<EmailOtpType>(["invite", "recovery"])
        : new Set<EmailOtpType>(["recovery"]);

    const getAllUrlParams = (): URLSearchParams[] => {
      if (typeof window === "undefined") {
        return [];
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));

      return [searchParams, hashParams];
    };

    const getUrlAccessType = (): PasswordAccessType | null => {
      const allParams = getAllUrlParams();

      for (const params of allParams) {
        const type = params.get("type");

        if (type === "invite") {
          return "invite";
        }

        if (type === "recovery") {
          return "recovery";
        }
      }

      return null;
    };

    const getRecoveryCode = (): string | null => {
      const allParams = getAllUrlParams();

      for (const params of allParams) {
        const code = params.get("code");

        if (code) {
          return code;
        }
      }

      return null;
    };

    const hasRecoveryErrorInUrl = (): boolean => {
      const allParams = getAllUrlParams();

      return allParams.some((params) => {
        const error = params.get("error");
        const errorCode = params.get("error_code");

        return (
          error === "access_denied" ||
          errorCode === "otp_expired" ||
          errorCode === "access_denied"
        );
      });
    };

    const getOtpTokenPayload = (): {
      tokenHash: string | null;
      type: EmailOtpType | null;
    } => {
      const allParams = getAllUrlParams();

      for (const params of allParams) {
        const tokenHash = params.get("token_hash");
        const type = params.get("type");

        if (tokenHash && type && allowedAccessTypes.has(type as EmailOtpType)) {
          return {
            tokenHash,
            type: type as EmailOtpType,
          };
        }
      }

      return {
        tokenHash: null,
        type: null,
      };
    };

    const hasSessionTokensInUrl = (): boolean => {
      const allParams = getAllUrlParams();

      return allParams.some((params) => {
        const type = params.get("type");
        const hasTokenPair =
          Boolean(params.get("access_token")) &&
          Boolean(params.get("refresh_token"));

        return Boolean(
          hasTokenPair && type && allowedAccessTypes.has(type as EmailOtpType),
        );
      });
    };

    const clearConsumedPasswordLinkParams = (): void => {
      if (typeof window === "undefined") {
        return;
      }

      window.history.replaceState(null, "", window.location.pathname);
    };

    const grantRouteAccess = (): void => {
      if (typeof window === "undefined") {
        return;
      }

      markPasswordRouteSessionFlow(passwordFlow);
      window.sessionStorage.setItem(accessStorageKey, "granted");
    };

    const revokeRouteAccess = (): void => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(accessStorageKey);
      }

      clearPasswordRouteSessionFlow();
    };

    const hasCurrentSession = async (): Promise<boolean> => {
      try {
        const { session } = await getSession();

        return Boolean(session?.user);
      } catch {
        return false;
      }
    };

    const exchangeRecoveryCodeOrUseExistingSession = async (
      recoveryCode: string,
    ): Promise<void> => {
      try {
        await exchangePasswordCodeForSession(recoveryCode);
        return;
      } catch (exchangeError: unknown) {
        const sessionAlreadyExists = await hasCurrentSession();

        if (sessionAlreadyExists) {
          return;
        }

        throw exchangeError;
      }
    };

    const verifyOtpOrUseExistingSession = async (
      tokenHash: string,
      type: EmailOtpType,
    ): Promise<void> => {
      try {
        await verifyPasswordOtp(tokenHash, type);
        return;
      } catch (verificationError: unknown) {
        const sessionAlreadyExists = await hasCurrentSession();

        if (sessionAlreadyExists) {
          return;
        }

        throw verificationError;
      }
    };

    const validateRecoverySession = async (): Promise<void> => {
      const otpPayload = getOtpTokenPayload();
      const recoveryCode = getRecoveryCode();
      const hasSessionTokens = hasSessionTokensInUrl();
      const urlAccessType = getUrlAccessType();
      const resolvedAccessType =
        otpPayload.type === "invite" || otpPayload.type === "recovery"
          ? otpPayload.type
          : (urlAccessType ??
            (successQueryKey === "setup" ? "invite" : "recovery"));

      if (hasRecoveryErrorInUrl()) {
        if (isMounted) {
          setAccessType(resolvedAccessType);
          setInvalidLink(true);
          setInvalidReason("expired_or_denied");
          setReady(true);
        }

        revokeRouteAccess();
        return;
      }

      try {
        if (otpPayload.tokenHash && otpPayload.type) {
          markPasswordRouteSessionFlow(passwordFlow);
          await verifyOtpOrUseExistingSession(
            otpPayload.tokenHash,
            otpPayload.type,
          );

          if (!isMounted) {
            return;
          }

          grantRouteAccess();
          clearConsumedPasswordLinkParams();
          setAccessType(otpPayload.type === "invite" ? "invite" : "recovery");
          setInvalidLink(false);
          setInvalidReason(null);
          return;
        }

        if (recoveryCode) {
          markPasswordRouteSessionFlow(passwordFlow);
          await exchangeRecoveryCodeOrUseExistingSession(recoveryCode);

          if (!isMounted) {
            return;
          }

          grantRouteAccess();
          clearConsumedPasswordLinkParams();
          setAccessType(resolvedAccessType);
          setInvalidLink(false);
          setInvalidReason(null);
          return;
        }

        const { session } = await getSession();

        if (!isMounted) {
          return;
        }

        const hasSession = Boolean(session);
        const hasStoredAccess =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(accessStorageKey) === "granted";
        const isAuthorizedRecoveryVisit =
          hasSession && (hasSessionTokens || hasStoredAccess);

        setAccessType(resolvedAccessType);
        setInvalidLink(!isAuthorizedRecoveryVisit);

        if (!isAuthorizedRecoveryVisit) {
          setInvalidReason("missing_or_unauthorized");
          revokeRouteAccess();
          return;
        }

        markPasswordRouteSessionFlow(passwordFlow);
        setInvalidReason(null);
      } catch {
        if (!isMounted) {
          return;
        }

        setAccessType(resolvedAccessType);
        setInvalidLink(true);
        setInvalidReason("verification_failed");
        revokeRouteAccess();

        try {
          await signOut();
          await refreshAuthState();
        } catch {
          // The invalid-link UI is already the user-facing recovery path.
        }
      } finally {
        if (isMounted) {
          setReady(true);
        }
      }
    };

    void validateRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [accessStorageKey, passwordFlow, refreshAuthState, successQueryKey]);

  const submit = React.useCallback(
    async (newPassword: string, confirmPassword: string) => {
      const checks = evaluatePasswordChecks(newPassword, confirmPassword);

      if (!checks.minLength) {
        setError("Password must be at least 8 characters long.");
        return false;
      }

      if (!checks.uppercase) {
        setError("Password must include at least one uppercase letter.");
        return false;
      }

      if (!checks.numberOrSpecial) {
        setError(
          "Password must include at least one number or special character.",
        );
        return false;
      }

      if (!checks.matches) {
        setError("Passwords do not match.");
        return false;
      }

      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        await updatePassword(newPassword);
        await signOut();
        clearClientAuthTransientState();
        await refreshAuthState();
        setSuccess(true);
        window.location.replace(`/login?${successQueryKey}=success`);
        return true;
      } catch (error: unknown) {
        setError(
          getErrorMessage(
            error,
            "Unable to reset your password right now. Please request a new recovery link.",
          ),
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [refreshAuthState, successQueryKey],
  );

  return {
    submit,
    loading,
    error,
    success,
    ready,
    invalidLink,
    accessType,
    invalidReason,
  };
}
