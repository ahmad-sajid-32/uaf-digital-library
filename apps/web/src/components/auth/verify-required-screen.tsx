// apps/web/src/components/auth/verify-required-screen.tsx
/**
 * Verification-required state screen.
 *
 * This is a thin auth-state destination used by the rebuilt login flow. The
 * richer transition UX remains a later pass, but the route must exist now so
 * verified routing does not fall into a dead URL.
 */

"use client";

import * as React from "react";
import { MailWarning, LogOut } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import { useAppAuth } from "@/hooks/useAppAuth";

export function VerifyRequiredScreen(): React.JSX.Element {
  const { auth } = useAppAuth();
  const { logout, logoutPending } = useAuthSessionActions();

  const handleSignOut = async () => {
    await logout({
      redirectTo: "/login",
      successMessage: "Signed out successfully.",
      successToastId: "verify-required-signout",
      errorToastId: "verify-required-signout-error",
    });
  };

  return (
    <AuthStateScreen
      icon={MailWarning}
      iconTone="warning"
      title="Verification Still Required"
      description={
        auth.email
          ? `The account ${auth.email} is signed in, but email verification is still incomplete.`
          : "This account is signed in, but email verification is still incomplete."
      }
      message="Access to role-based dashboard routing is blocked until the account satisfies the verification requirement."
      actionLabel="Sign Out"
      actionLoadingLabel="Signing Out..."
      actionIcon={LogOut}
      actionLoading={logoutPending}
      onAction={handleSignOut}
    />
  );
}
