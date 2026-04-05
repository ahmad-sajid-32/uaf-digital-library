// apps/web/src/components/circulation/circulation-badges.tsx
/**
 * Reusable badge treatments for the circulation module.
 *
 * Purpose:
 * - Keep role, fine-state, queue-state, and loan-state color semantics
 *   consistent across the circulation list screen and dialogs.
 * - Avoid reintroducing generic gray badges where the module already has
 *   stronger state truth available.
 */

import * as React from "react";

import { BookStatusBadge } from "@/components/books/book-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  getCirculationFineStatusLabel,
  getCirculationRoleLabel,
  type CirculationFineStatus,
  type CirculationQueueStatus,
  type CirculationRole,
} from "@/lib/circulation";
import type { BookStatus } from "@/lib/books";
import { cn } from "@/lib/utils";

function formatMoney(value: number | string): string {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

const ROLE_BADGE_CLASSNAMES: Record<CirculationRole, string> = {
  admin:
    "border-primary/20 bg-primary/10 text-primary dark:border-primary/35 dark:bg-primary/15 dark:text-primary-foreground",
  librarian:
    "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300",
  student:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const FINE_BADGE_CLASSNAMES: Record<NonNullable<CirculationFineStatus>, string> =
  {
    pending:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15",
    paid:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    waived:
      "border-border/60 bg-muted/55 text-muted-foreground dark:bg-muted/35",
    cancelled:
      "border-border/60 bg-muted/55 text-muted-foreground dark:bg-muted/35",
  };

export function CirculationRoleBadge(props: {
  role: CirculationRole;
}): React.JSX.Element {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-1",
        ROLE_BADGE_CLASSNAMES[props.role],
      )}
    >
      {getCirculationRoleLabel(props.role)}
    </Badge>
  );
}

export function CirculationFineStatusBadge(props: {
  fineStatus: CirculationFineStatus | null;
  fineAmount: number | string;
  showAmountWhenPending?: boolean;
}): React.JSX.Element {
  if (!props.fineStatus) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-border/60 bg-muted/55 px-2.5 py-1 text-muted-foreground dark:bg-muted/35"
      >
        No fine
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-1",
        FINE_BADGE_CLASSNAMES[props.fineStatus],
      )}
    >
      {getCirculationFineStatusLabel(props.fineStatus)}
      {props.fineStatus === "pending" && props.showAmountWhenPending !== false
        ? ` - ${formatMoney(props.fineAmount)}`
        : ""}
    </Badge>
  );
}

export function CirculationQueueBadge(props: {
  waitingCount: number;
  queueStatus: CirculationQueueStatus | null;
}): React.JSX.Element | null {
  if (props.waitingCount <= 0 && !props.queueStatus) {
    return null;
  }

  if (props.queueStatus === "notified") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300"
      >
        Hold ready
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="rounded-full border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
    >
      {props.waitingCount} waiting
    </Badge>
  );
}

export function CirculationLoanStateBadge(props: {
  returned: boolean;
  overdue: boolean;
  bookStatus: BookStatus;
}): React.JSX.Element {
  if (props.returned) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
      >
        Returned
      </Badge>
    );
  }

  if (props.overdue) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-destructive/20 bg-destructive/10 px-2.5 py-1 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
      >
        Overdue
      </Badge>
    );
  }

  return <BookStatusBadge status={props.bookStatus} />;
}
