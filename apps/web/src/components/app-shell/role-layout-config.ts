// apps/web/src/components/app-shell/role-layout-config.ts
/**
 * Role-scoped authenticated shell configuration.
 *
 * Purpose:
 * - Centralize role navigation and avatar-menu configuration so server layouts
 *   do not hardcode shell data inline.
 * - Keep the shell role-agnostic while still giving each authenticated role a
 *   distinct navigation identity.
 *
 * Important:
 * - Links that do not exist yet are marked disabled instead of pretending the
 *   route is ready.
 * - Real authorization still remains server- and backend-owned.
 */

import type {
  AppShellUserSummary,
  AppShellNavItem,
  AuthenticatedShellLayoutConfig,
  UserAvatarMenuItem,
} from "@/components/app-shell/contracts";
import type { AppRole } from "@/lib/auth/types";
import { getRoleDashboardPath } from "@/lib/auth/server-guard";

const COMMON_MENU_ITEMS: UserAvatarMenuItem[] = [
  {
    id: "profile",
    label: "Profile",
    icon: "user-circle-2",
    disabled: true,
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    disabled: true,
  },
];

const ROLE_NAV_ITEMS: Record<AppRole, AppShellNavItem[]> = {
  admin: [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: "layout-dashboard",
      match: "exact",
    },
    {
      id: "catalog",
      label: "Catalog",
      href: "/admin/catalog",
      icon: "book-copy",
      match: "startsWith",
    },
    {
      id: "users",
      label: "Users",
      href: "/admin/users",
      icon: "users",
      match: "startsWith",
    },
    {
      id: "fines",
      label: "Fines",
      href: "/admin/fines",
      icon: "credit-card",
      match: "startsWith",
    },
    {
      id: "analytics",
      label: "Analytics",
      href: "/admin/analytics",
      icon: "bar-chart-3",
      match: "startsWith",
      disabled: true,
    },
    {
      id: "documents",
      label: "Documents",
      href: "/admin/documents",
      icon: "scroll-text",
      match: "startsWith",
    },
  ],
  librarian: [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/librarian/dashboard",
      icon: "layout-dashboard",
      match: "exact",
    },
    {
      id: "catalog",
      label: "Catalog",
      href: "/librarian/catalog",
      icon: "book-copy",
      match: "startsWith",
    },
    {
      id: "circulation",
      label: "Circulation",
      href: "/librarian/circulation",
      icon: "library-big",
      match: "startsWith",
      disabled: true,
    },
    {
      id: "fines",
      label: "Fines",
      href: "/librarian/fines",
      icon: "credit-card",
      match: "startsWith",
    },
    {
      id: "documents",
      label: "Documents",
      href: "/librarian/documents",
      icon: "scroll-text",
      match: "startsWith",
    },
  ],
  student: [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/student/dashboard",
      icon: "layout-dashboard",
      match: "exact",
    },
    {
      id: "borrows",
      label: "My Borrows",
      href: "/student/borrows",
      icon: "book-copy",
      match: "startsWith",
      disabled: true,
    },
    {
      id: "fines",
      label: "Fines",
      href: "/student/fines",
      icon: "credit-card",
      match: "startsWith",
      disabled: true,
    },
  ],
};

function getRoleMenuItems(): UserAvatarMenuItem[] {
  return [...COMMON_MENU_ITEMS];
}

export function getRoleShellLayoutConfig(
  role: AppRole,
): AuthenticatedShellLayoutConfig {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  return {
    role,
    roleLabel,
    dashboardHref: getRoleDashboardPath(role),
    navItems: ROLE_NAV_ITEMS[role],
    menuItems: getRoleMenuItems(),
  };
}

export function buildInitialRoleShellUserSummary(params: {
  userId: string;
  email: string;
  role: AppRole;
  fullName?: string | null;
}): AppShellUserSummary {
  const roleLabel = params.role.charAt(0).toUpperCase() + params.role.slice(1);

  return {
    userId: params.userId,
    email: params.email,
    fullName: params.fullName?.trim() || params.email,
    role: params.role,
    roleLabel,
  };
}
