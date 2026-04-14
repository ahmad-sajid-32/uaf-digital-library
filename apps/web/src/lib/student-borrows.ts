/**
 * Shared student borrow lifecycle contract for the frontend.
 *
 * Purpose:
 * - Keep student borrow data shapes and presentation-only helpers separate
 *   from browser-only transport code.
 * - Let the catalog integration, active-borrows screen, and future student
 *   modules read the same contract without pulling in session logic.
 */

import type { BookCategory, BookStatus } from "@/lib/books";

const DAY_MS = 86_400_000;

export interface StudentActiveBorrowItem {
  transaction_id: string;
  book_id: string;
  title: string;
  author: string;
  category: BookCategory;
  book_status: BookStatus;
  issue_date: string;
  due_date: string;
  renewal_count: number;
}

export interface StudentActiveBorrowsData {
  items: StudentActiveBorrowItem[];
}

export type StudentBorrowActionType = "borrow" | "renew" | "return";
export type StudentBorrowDueState = "upcoming" | "due_today" | "overdue";

export interface StudentBorrowDuePresentation {
  state: StudentBorrowDueState;
  label: string;
  helper: string;
}

function startOfLocalDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

export function formatStudentBorrowDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function getStudentBorrowDuePresentation(
  dueDate: string,
  now: Date = new Date(),
): StudentBorrowDuePresentation {
  const parsedDueDate = new Date(dueDate);

  if (Number.isNaN(parsedDueDate.getTime())) {
    return {
      state: "upcoming",
      label: "Due date unavailable",
      helper: dueDate,
    };
  }

  const dayDifference = Math.round(
    (startOfLocalDay(parsedDueDate) - startOfLocalDay(now)) / DAY_MS,
  );
  const formattedDueDate = formatStudentBorrowDateTime(dueDate);

  if (dayDifference < 0) {
    const overdueDays = Math.abs(dayDifference);

    return {
      state: "overdue",
      label:
        overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`,
      helper: `Due ${formattedDueDate}`,
    };
  }

  if (dayDifference === 0) {
    return {
      state: "due_today",
      label: "Due today",
      helper: `Due ${formattedDueDate}`,
    };
  }

  if (dayDifference === 1) {
    return {
      state: "upcoming",
      label: "Due tomorrow",
      helper: `Due ${formattedDueDate}`,
    };
  }

  return {
    state: "upcoming",
    label: `Due in ${dayDifference} days`,
    helper: `Due ${formattedDueDate}`,
  };
}
