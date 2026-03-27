// apps/web/src/components/admin-users/admin-user-status-badge.tsx
/**
 * Activation-state badge for admin users module surfaces.
 *
 * Purpose:
 * - Keep active/inactive labeling truthful and consistent across future admin
 *   user list and detail screens.
 */

"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";

interface AdminUserStatusBadgeProps {
  isActive: boolean;
}

export function AdminUserStatusBadge({
  isActive,
}: AdminUserStatusBadgeProps): React.JSX.Element {
  return (
    <Badge
      variant="outline"
      className={
        isActive
          ? "rounded-full border-emerald-500/25 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300"
          : "rounded-full border-amber-500/25 bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-300"
      }
    >
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
