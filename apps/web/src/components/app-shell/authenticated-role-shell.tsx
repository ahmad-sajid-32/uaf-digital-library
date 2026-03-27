// apps/web/src/components/app-shell/authenticated-role-shell.tsx
/**
 * Client bridge between server-protected role layouts and the authenticated
 * shell primitives.
 *
 * Purpose:
 * - Let server layouts keep SSR role guards while client hooks provide the
 *   current pathname and logout action.
 * - Prefer the normalized auth provider once hydrated without blocking initial
 *   render on a client-only session roundtrip.
 */

"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import type {
  AppShellProps,
  AppShellUserSummary,
  AuthenticatedShellLayoutConfig,
} from "@/components/app-shell/contracts";
import { toAppShellUserSummary } from "@/components/app-shell/contracts";
import { PageTransitionLoader } from "@/components/ui/page-transition-loader";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import { useAppAuth } from "@/hooks/useAppAuth";

interface AuthenticatedRoleShellProps {
  layout: AuthenticatedShellLayoutConfig;
  initialUser: AppShellUserSummary;
  children: React.ReactNode;
}

export function AuthenticatedRoleShell({
  layout,
  initialUser,
  children,
}: AuthenticatedRoleShellProps): React.JSX.Element {
  const pathname = usePathname();
  const { auth, hydrated } = useAppAuth();
  const { logout } = useAuthSessionActions();

  const liveUserSummary = React.useMemo(() => toAppShellUserSummary(auth), [auth]);
  const resolvedUser = liveUserSummary ?? initialUser;

  if (!resolvedUser) {
    return (
      <PageTransitionLoader
        title="Restoring Workspace"
        message="Rebuilding your authenticated session before rendering the shell."
      />
    );
  }

  const handleLogout: AppShellProps["onLogout"] = async () => {
    await logout({
      redirectTo: "/login",
      successMessage: "Signed out successfully.",
      successToastId: `shell-${layout.role}-signout`,
      errorToastId: `shell-${layout.role}-signout-error`,
    });
  };

  return (
    <AppShell
      layout={layout}
      currentPathname={pathname ?? layout.dashboardHref}
      user={resolvedUser}
      onLogout={handleLogout}
      defaultSidebarOpen={!hydrated || auth.rememberMe}
    >
      {children}
    </AppShell>
  );
}
