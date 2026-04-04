// apps/web/src/components/books/book-status-badge.tsx
/**
 * Reusable book-status badge for staff inventory surfaces.
 */

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  getBookStatusLabel,
  type BookStatus,
} from "@/lib/books";
import { cn } from "@/lib/utils";

type BookStatusCopy = {
  className: string;
};

const BOOK_STATUS_COPY: Record<BookStatus, BookStatusCopy> = {
  available: {
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  borrowed: {
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  reserved: {
    className:
      "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  maintenance: {
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
};

export function BookStatusBadge(props: {
  status: BookStatus;
}): React.JSX.Element {
  const copy = BOOK_STATUS_COPY[props.status];

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-1", copy.className)}
    >
      {getBookStatusLabel(props.status)}
    </Badge>
  );
}
