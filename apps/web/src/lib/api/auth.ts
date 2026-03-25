import type { EmailOtpType, Session, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface SignInResult {
  session: Session | null;
  user: User | null;
}

export interface SessionResult {
  session: Session | null;
}

interface DeletedAccountStatusResponse {
  status: number;
  message: string;
  data: {
    has_account: boolean;
    is_deleted: boolean;
  };
  timestamp_ms: number;
}

interface AccountStatusResult {
  resolved: boolean;
  hasAccount: boolean;
  isDeleted: boolean;
}

function toSafeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Check apps/web/.env.local.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

async function getAccountStatus(email: string): Promise<AccountStatusResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/account-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      return {
        resolved: false,
        hasAccount: false,
        isDeleted: false,
      };
    }

    const payload = (await response.json()) as DeletedAccountStatusResponse;
    return {
      resolved: true,
      hasAccount: Boolean(payload.data?.has_account),
      isDeleted: Boolean(payload.data?.is_deleted),
    };
  } catch {
    return {
      resolved: false,
      hasAccount: false,
      isDeleted: false,
    };
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInResult> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const accountStatus = await getAccountStatus(email);

    if (accountStatus.isDeleted) {
      throw new Error(
        "Your account has been deleted. Contact an administrator to recreate your account.",
      );
    }

    if (accountStatus.resolved && !accountStatus.hasAccount) {
      throw new Error("No account is associated with this email address.");
    }

    if (accountStatus.resolved && accountStatus.hasAccount) {
      throw new Error("Incorrect password.");
    }

    throw new Error(
      toSafeErrorMessage(error, "Unable to sign in. Please verify your credentials."),
    );
  }

  return {
    session: data.session,
    user: data.user,
  };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, "Unable to sign out at the moment."),
    );
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const accountStatus = await getAccountStatus(email);

  if (accountStatus.isDeleted) {
    throw new Error(
      "Your account has been deleted. Contact an administrator to recreate your account.",
    );
  }

  if (!accountStatus.hasAccount) {
    throw new Error("No account is associated with this email address.");
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(
      toSafeErrorMessage(
        error,
        "Unable to send the password reset link right now.",
      ),
    );
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, "Unable to update your password right now."),
    );
  }
}

export async function verifyPasswordOtp(
  tokenHash: string,
  type: EmailOtpType,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    throw new Error(
      toSafeErrorMessage(
        error,
        "Unable to verify this password link. Please request a new one.",
      ),
    );
  }
}

export async function getSession(): Promise<SessionResult> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, "Unable to validate your recovery session."),
    );
  }

  return { session: data.session };
}
