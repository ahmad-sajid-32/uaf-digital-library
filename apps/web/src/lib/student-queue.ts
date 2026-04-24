/**
 * Shared student queue contract for the frontend.
 *
 * Purpose:
 * - Keep student queue row shapes and presentation-only helpers separate from
 *   browser-only transport code.
 * - Preserve backend-owned queue state while giving the UI a small, honest
 *   formatting layer for queue status and timestamps.
 */

import { formatStudentBorrowDateTime } from "@/lib/student-borrows";

export interface StudentQueueItem {
  book_id: string;
  title: string;
  status: string;
  position: number;
  notified_at: string | null;
  hold_expires_at: string | null;
}

export interface StudentQueueData {
  items: StudentQueueItem[];
}

export function formatStudentQueueDateTime(value: string | null): string {
  if (!value) {
    return "Not active";
  }

  return formatStudentBorrowDateTime(value);
}

function normalizeQueueStatus(status: string): string {
  return String(status).trim().toLowerCase();
}

export function canCancelStudentQueueEntry(status: string): boolean {
  const normalizedStatus = normalizeQueueStatus(status);

  return normalizedStatus === "waiting" || normalizedStatus === "notified";
}

export function getStudentQueueStatusPresentation(status: string): {
  label: string;
  description: string;
  toneClassName: string;
} {
  const normalizedStatus = normalizeQueueStatus(status);

  switch (normalizedStatus) {
    case "waiting":
      return {
        label: "Waiting",
        description: "Your request is in the waiting list.",
        toneClassName: "border-primary/20 bg-primary/10 text-primary",
      };
    case "notified":
      return {
        label: "Hold Ready",
        description:
          "This book is ready for pickup.",
        toneClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
      };
    case "fulfilled":
      return {
        label: "Fulfilled",
        description:
          "This queue entry has already been fulfilled by a successful borrow.",
        toneClassName: "border-sky-500/20 bg-sky-500/10 text-sky-700",
      };
    case "expired":
      return {
        label: "Expired",
        description:
          "A notified hold expired before the borrow was completed.",
        toneClassName: "border-amber-500/20 bg-amber-500/10 text-amber-700",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        description: "This queue entry was cancelled and is no longer active.",
        toneClassName: "border-border bg-muted text-muted-foreground",
      };
    default:
      return {
        label: normalizedStatus ? normalizedStatus.replace(/_/g, " ") : "Unknown",
        description: "Current waiting-list status for this entry.",
        toneClassName: "border-border bg-muted text-muted-foreground",
      };
  }
}
