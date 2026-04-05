// apps/web/src/lib/circulation.ts
/**
 * Shared circulation contract for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Keep server-safe circulation enums, labels, and data shapes separate from
 *   the browser-only API transport layer.
 * - Allow circulation screens, dialogs, and server-safe modules to read the
 *   same contract without pulling in browser session code.
 */

import type { BookQueueStatusItem, BookStatus } from "@/lib/books";

export const CIRCULATION_SCOPE_VALUES = [
  "active",
  "overdue",
  "history",
] as const;

export const CIRCULATION_ROLE_VALUES = [
  "student",
  "librarian",
  "admin",
] as const;

export const CIRCULATION_BOOK_STATUS_VALUES = [
  "available",
  "borrowed",
  "reserved",
  "maintenance",
] as const;

export const CIRCULATION_FINE_STATUS_VALUES = [
  "pending",
  "paid",
  "waived",
  "cancelled",
] as const;

export type CirculationScope = (typeof CIRCULATION_SCOPE_VALUES)[number];
export type CirculationRole = (typeof CIRCULATION_ROLE_VALUES)[number];
export type CirculationBookStatus =
  (typeof CIRCULATION_BOOK_STATUS_VALUES)[number];
export type CirculationFineStatus =
  (typeof CIRCULATION_FINE_STATUS_VALUES)[number];
export type CirculationQueueStatus = "waiting" | "notified";

const CIRCULATION_SCOPE_LABELS: Record<CirculationScope, string> = {
  active: "Active Loans",
  overdue: "Overdue",
  history: "History",
};

const CIRCULATION_ROLE_LABELS: Record<CirculationRole, string> = {
  student: "Student",
  librarian: "Librarian",
  admin: "Admin",
};

const CIRCULATION_FINE_STATUS_LABELS: Record<CirculationFineStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  waived: "Waived",
  cancelled: "Cancelled",
};

export function getCirculationScopeLabel(value: CirculationScope): string {
  return CIRCULATION_SCOPE_LABELS[value];
}

export function getCirculationRoleLabel(value: CirculationRole): string {
  return CIRCULATION_ROLE_LABELS[value];
}

export function getCirculationFineStatusLabel(
  value: CirculationFineStatus,
): string {
  return CIRCULATION_FINE_STATUS_LABELS[value];
}

export interface StaffCirculationLoanListItem {
  transaction_id: string;
  user_id: string;
  user_full_name: string;
  user_email: string | null;
  user_role: CirculationRole;
  roll_number: string | null;
  employee_code: string | null;
  book_id: string;
  book_title: string;
  book_author: string;
  book_category: string;
  book_status: BookStatus;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  renewal_count: number;
  is_overdue: boolean;
  fine_amount: number | string;
  fine_status: CirculationFineStatus | null;
  waiting_count: number;
  queue_status: CirculationQueueStatus | null;
  hold_expires_at: string | null;
  can_return: boolean;
  can_adjust_due_date: boolean;
  can_renew: boolean;
}

export type StaffCirculationLoanDetailItem = StaffCirculationLoanListItem;

export interface StaffCirculationLoansData {
  items: StaffCirculationLoanListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface StaffCirculationLoanDetailData {
  item: StaffCirculationLoanDetailItem;
}

export interface AdjustLoanDueDatePayload {
  due_date: string;
}

export type CirculationBookQueueStatusItem = BookQueueStatusItem;
