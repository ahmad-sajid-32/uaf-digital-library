// apps/web/src/components/admin-users/admin-user-role-badge.tsx
/**
 * Role badge for admin users module surfaces.
 *
 * Purpose:
 * - Keep role labeling visually consistent across the future admin users list
 *   and detail screens.
 */

"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { normalizeAdminManagedUserRole } from "@/hooks/useAdmin";

interface AdminUserRoleBadgeProps {
  role: string;
}

export function AdminUserRoleBadge({
  role,
}: AdminUserRoleBadgeProps): React.JSX.Element {
  const normalizedRole = normalizeAdminManagedUserRole(role);
  const label = normalizedRole
    ? `${normalizedRole.charAt(0).toUpperCase()}${normalizedRole.slice(1)}`
    : role;
  const toneClassName =
    normalizedRole === "admin"
      ? "border-primary/30 bg-primary/10 text-primary"
      : normalizedRole === "librarian"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <Badge
      variant="outline"
      className={`rounded-full font-semibold ${toneClassName}`}
    >
      {label}
    </Badge>
  );
}
