/**
 * Shared student borrow-history contract for the frontend.
 *
 * Purpose:
 * - Keep historical student borrow row shapes and presentation-only helpers
 *   separate from browser-only transport code.
 * - Preserve the backend truth that history is a read-only record set ordered
 *   by return completion time, not an active circulation workspace.
 */

import type { BookCategory, BookStatus } from "@/lib/books";
import { formatStudentBorrowDateTime } from "@/lib/student-borrows";

export const DEFAULT_STUDENT_BORROW_HISTORY_LIMIT = 50;
export const MAX_STUDENT_BORROW_HISTORY_LIMIT = 200;

export interface StudentBorrowHistoryItem {
  transaction_id: string;
  book_id: string;
  title: string;
  author: string;
  category: BookCategory;
  book_status: BookStatus;
  issue_date: string;
  due_date: string;
  return_date: string;
  renewal_count: number;
}

export interface StudentBorrowHistoryData {
  items: StudentBorrowHistoryItem[];
}

export function formatStudentBorrowHistoryDateTime(value: string): string {
  return formatStudentBorrowDateTime(value);
}

export function clampStudentBorrowHistoryLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_STUDENT_BORROW_HISTORY_LIMIT;
  }

  return Math.min(
    Math.max(Math.trunc(limit), 1),
    MAX_STUDENT_BORROW_HISTORY_LIMIT,
  );
}
