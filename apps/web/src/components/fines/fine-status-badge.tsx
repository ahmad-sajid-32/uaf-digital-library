// apps/web/src/components/fines/fine-status-badge.tsx
/**
 * Reusable fine-status badge for staff fine-management surfaces.
 */

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { FineStatus } from "@/lib/api/fines";
import { cn } from "@/lib/utils";

type FineStatusCopy = {
  label: string;
  className: string;
};

const FINE_STATUS_COPY: Record<FineStatus, FineStatusCopy> = {
  pending: {
    label: "Pending",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  paid: {
    label: "Paid",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  waived: {
    label: "Waived",
    className:
      "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
};

export function FineStatusBadge(props: {
  status: FineStatus;
}): React.JSX.Element {
  const copy = FINE_STATUS_COPY[props.status];

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-1", copy.className)}
    >
      {copy.label}
    </Badge>
  );
}
