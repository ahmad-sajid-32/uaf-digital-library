import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface SignInResult {
  session: Session | null;
  user: User | null;
}

export interface SessionResult {
  session: Session | null;
}

function toSafeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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
