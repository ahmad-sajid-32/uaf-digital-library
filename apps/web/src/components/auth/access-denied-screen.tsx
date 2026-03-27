// apps/web/src/components/auth/access-denied-screen.tsx
/**
 * Access-denied state screen for normalized auth routing.
 *
 * This screen is intentionally narrow in scope. It exists so the rebuilt login
 * flow can route unknown or missing business roles to a truthful destination
 * instead of a broken redirect.
 */

"use client";

import * as React from "react";
import { ShieldAlert, LogOut } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import { useAppAuth } from "@/hooks/useAppAuth";

export function AccessDeniedScreen(): React.JSX.Element {
  const { auth } = useAppAuth();
  const { logout, logoutPending } = useAuthSessionActions();

  const handleSignOut = async () => {
    await logout({
      redirectTo: "/login",
      successMessage: "Signed out successfully.",
      successToastId: "access-denied-signout",
      errorToastId: "access-denied-signout-error",
    });
  };

  return (
    <AuthStateScreen
      icon={ShieldAlert}
      iconTone="danger"
      title="Access Denied"
      description={
        auth.email
          ? `The account ${auth.email} is signed in, but its business role could not be routed safely.`
          : "This account is signed in, but its business role could not be routed safely."
      }
      message="Contact an administrator if this account should have student, librarian, or admin access inside the application."
      actionLabel="Sign Out"
      actionLoadingLabel="Signing Out..."
      actionIcon={LogOut}
      actionLoading={logoutPending}
      onAction={handleSignOut}
    />
  );
}
