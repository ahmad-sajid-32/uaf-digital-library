"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  getSession,
  requestPasswordReset,
  signInWithPassword,
  signOut,
  updatePassword,
} from "@/lib/api/auth";

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
  submit: (email: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  success: boolean;
} {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const submit = React.useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await signInWithPassword(email, password);
      setSuccess(true);
      return true;
    } catch (error: unknown) {
      setError(
        getErrorMessage(
          error,
          "Unable to sign in. Please verify your credentials and try again.",
        ),
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error, success };
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

export function useResetPassword(): {
  submit: (newPassword: string, confirmPassword: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  success: boolean;
  ready: boolean;
  invalidLink: boolean;
} {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [invalidLink, setInvalidLink] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const hasRecoveryErrorInUrl = (): boolean => {
      if (typeof window === "undefined") {
        return false;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const allParams = [searchParams, hashParams];

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

    const validateRecoverySession = async (): Promise<void> => {
      if (hasRecoveryErrorInUrl()) {
        if (isMounted) {
          setInvalidLink(true);
          setReady(true);
        }

        return;
      }

      try {
        const { session } = await getSession();

        if (!isMounted) {
          return;
        }

        setInvalidLink(!session);
      } catch {
        if (!isMounted) {
          return;
        }

        setInvalidLink(true);
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
  }, []);

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
        setSuccess(true);
        router.replace("/login?reset=success");
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
    [router],
  );

  return {
    submit,
    loading,
    error,
    success,
    ready,
    invalidLink,
  };
}
