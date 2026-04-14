/**
 * Shared student dashboard contract for the frontend.
 *
 * Purpose:
 * - Keep the student dashboard response shape and presentation-only helpers
 *   separate from browser-only transport code.
 * - Preserve backend-owned overview truth while giving the UI one honest place
 *   to derive quiet-state and formatting decisions.
 */

export interface StudentDashboardSummary {
  active_borrow_count: number;
  overdue_borrow_count: number;
  pending_fine_count: number;
  pending_fine_amount: number | string;
  active_queue_count: number;
  hold_assigned_count: number;
}

export interface StudentDashboardNextDueBorrow {
  transaction_id: string;
  book_id: string;
  title: string;
  due_date: string;
}

export interface StudentDashboardCurrentHold {
  book_id: string;
  title: string;
  hold_expires_at: string | null;
  notified_at: string | null;
}

export interface StudentDashboardActiveBorrowPreviewItem {
  transaction_id: string;
  book_id: string;
  title: string;
  due_date: string;
  renewal_count: number;
  is_overdue: boolean;
}

export interface StudentDashboardQueuePreviewItem {
  book_id: string;
  title: string;
  status: string;
  position: number | null;
  hold_expires_at: string | null;
}

export interface StudentDashboardFinePreviewItem {
  fine_id: string;
  title: string;
  amount: number | string;
  status: string;
  fine_created_at: string;
}

export interface StudentDashboardResultSummary {
  cgpa: number | string | null;
  latest_semester_label: string | null;
  latest_semester_gpa: number | string | null;
}

export interface StudentDashboardData {
  summary: StudentDashboardSummary;
  next_due_borrow: StudentDashboardNextDueBorrow | null;
  current_hold: StudentDashboardCurrentHold | null;
  active_borrows_preview: StudentDashboardActiveBorrowPreviewItem[];
  queue_preview: StudentDashboardQueuePreviewItem[];
  fine_preview: StudentDashboardFinePreviewItem[];
  result_summary: StudentDashboardResultSummary | null;
}

export function hasStudentDashboardContent(
  dashboard: StudentDashboardData | null,
): boolean {
  return dashboard !== null;
}

export function isStudentDashboardQuiet(
  dashboard: StudentDashboardData | null,
): boolean {
  if (!dashboard) {
    return false;
  }

  return (
    dashboard.summary.active_borrow_count === 0
    && dashboard.summary.overdue_borrow_count === 0
    && dashboard.summary.pending_fine_count === 0
    && dashboard.summary.active_queue_count === 0
    && dashboard.summary.hold_assigned_count === 0
    && dashboard.next_due_borrow === null
    && dashboard.current_hold === null
    && dashboard.active_borrows_preview.length === 0
    && dashboard.queue_preview.length === 0
    && dashboard.fine_preview.length === 0
    && dashboard.result_summary === null
  );
}
