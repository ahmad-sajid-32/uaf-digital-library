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
      id: "circulation",
      label: "Circulation",
      href: "/admin/circulation",
      icon: "library-big",
      match: "startsWith",
    },
    {
      id: "documents",
      label: "Documents",
      href: "/admin/documents",
      icon: "scroll-text",
      match: "startsWith",
    },
    {
      id: "result",
      label: "Result",
      href: "/admin/result",
      icon: "graduation-cap",
      match: "startsWith",
    },
    {
      id: "assistant",
      label: "Assistant",
      href: "/admin/assistant",
      icon: "bot-message-square",
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
    {
      id: "result",
      label: "Result",
      href: "/librarian/result",
      icon: "graduation-cap",
      match: "startsWith",
    },
    {
      id: "assistant",
      label: "Assistant",
      href: "/librarian/assistant",
      icon: "bot-message-square",
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
      id: "catalog",
      label: "Catalog",
      href: "/student/catalog",
      icon: "library-big",
      match: "startsWith",
    },
    {
      id: "borrows",
      label: "My Borrows",
      href: "/student/borrows",
      icon: "book-copy",
      match: "startsWith",
    },
    {
      id: "queue",
      label: "My Queue",
      href: "/student/queue",
      icon: "scroll-text",
      match: "startsWith",
    },
    {
      id: "fines",
      label: "Fines",
      href: "/student/fines",
      icon: "credit-card",
      match: "startsWith",
    },
    {
      id: "result",
      label: "Result",
      href: "/student/result",
      icon: "graduation-cap",
      match: "startsWith",
    },
    {
      id: "assistant",
      label: "Assistant",
      href: "/student/assistant",
      icon: "bot-message-square",
      match: "startsWith",
    },
  ],
};

function getRoleMenuItems(role: AppRole): UserAvatarMenuItem[] {
  return COMMON_MENU_ITEMS.map((item) => {
    if (item.id === "profile") {
      if (role === "student") {
        return {
          ...item,
          href: "/student/profile",
          disabled: false,
        };
      }

      if (role === "admin") {
        return {
          ...item,
          href: "/admin/profile",
          disabled: false,
        };
      }

      if (role === "librarian") {
        return {
          ...item,
          href: "/librarian/profile",
          disabled: false,
        };
      }

      return {
        ...item,
        disabled: true,
      };
    }

    return { ...item };
  });
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
    menuItems: getRoleMenuItems(role),
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
