// apps/web/src/components/app-shell/contracts.ts
/**
 * Shared authenticated shell contracts for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Lock the authenticated shell component tree before visual implementation.
 * - Define one shared navigation, menu, and layout configuration contract for
 *   admin, librarian, and student shells.
 * - Force future shell components to consume the existing normalized auth
 *   boundary instead of inventing a parallel role or session model.
 *
 * Important:
 * - This file is a contract layer only. It does not render UI.
 * - Real shell visuals and interactions belong to later passes.
 * - Role access truth still comes from SSR guards, middleware, backend
 *   validation, and the normalized auth provider.
 */

import type { ReactNode } from "react";

import type { AppAuthState, AppRole } from "@/lib/auth/types";

export const AUTHENTICATED_SHELL_COMPONENTS = [
  "AppShell",
  "AppTopbar",
  "AppSidebar",
  "SidebarNav",
  "UserAvatarMenu",
  "PageContainer",
] as const;

export type AuthenticatedShellComponentId =
  (typeof AUTHENTICATED_SHELL_COMPONENTS)[number];

export type ShellNavItemMatchMode = "exact" | "startsWith";
export type ShellMenuItemTone = "default" | "destructive";
export type AppShellIconName =
  | "layout-dashboard"
  | "users"
  | "bar-chart-3"
  | "scroll-text"
  | "book-copy"
  | "library-big"
  | "credit-card"
  | "user-circle-2"
  | "settings";

export interface AppShellUserSummary {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  roleLabel: string;
}

export interface AppShellNavItem {
  id: string;
  label: string;
  href: string;
  icon: AppShellIconName;
  match?: ShellNavItemMatchMode;
  disabled?: boolean;
  badge?: string | number | null;
}

export interface UserAvatarMenuItem {
  id: string;
  label: string;
  href?: string;
  icon: AppShellIconName;
  tone?: ShellMenuItemTone;
  disabled?: boolean;
}

export interface AuthenticatedShellLayoutConfig {
  role: AppRole;
  roleLabel: string;
  dashboardHref: string;
  navItems: AppShellNavItem[];
  menuItems: UserAvatarMenuItem[];
}

export interface AppShellProps {
  layout: AuthenticatedShellLayoutConfig;
  currentPathname: string;
  user: AppShellUserSummary;
  onLogout: () => void | Promise<void>;
  defaultSidebarOpen?: boolean;
  children: ReactNode;
}

export interface AppTopbarProps {
  user: AppShellUserSummary;
  menuItems: UserAvatarMenuItem[];
  onSidebarToggle: () => void;
  onLogout: () => void | Promise<void>;
}

export interface AppSidebarProps {
  dashboardHref: string;
  navItems: AppShellNavItem[];
  currentPathname: string;
  onLogout: () => void | Promise<void>;
}

export interface SidebarNavProps {
  items: AppShellNavItem[];
  currentPathname: string;
}

export interface UserAvatarMenuProps {
  user: AppShellUserSummary;
  items: UserAvatarMenuItem[];
  onLogout: () => void | Promise<void>;
}

export interface PageContainerProps {
  title?: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function toAppShellUserSummary(
  auth: AppAuthState,
): AppShellUserSummary | null {
  if (
    auth.status !== "authenticated"
    || !auth.userId
    || !auth.email
    || !auth.role
  ) {
    return null;
  }

  return {
    userId: auth.userId,
    email: auth.email,
    fullName: auth.fullName?.trim() || auth.email,
    role: auth.role,
    roleLabel: auth.role.charAt(0).toUpperCase() + auth.role.slice(1),
  };
}
