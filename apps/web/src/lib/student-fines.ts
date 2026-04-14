/**
 * Shared student fines contract for the frontend.
 *
 * Purpose:
 * - Keep student fine row shapes and read-only presentation helpers separate
 *   from browser-only transport code.
 * - Preserve backend-owned fine truth while giving the student UI one honest
 *   place to format amounts, dates, statuses, and current-versus-history
 *   partitioning.
 */

export type StudentFineSection = "current" | "history";

export interface StudentFineItem {
  fine_id: string;
  transaction_id: string;
  book_id: string;
  title: string;
  amount: number | string;
  status: string;
  fine_created_at: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  waive_reason: string | null;
}

export interface StudentFineHistoryItem extends StudentFineItem {
  resolved_by_name: string | null;
}

export interface StudentFinesData {
  items: StudentFineItem[];
}

export interface StudentFineHistoryData {
  items: StudentFineHistoryItem[];
}

export function formatStudentFineAmount(value: number | string): string {
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

export function formatStudentFineDateTime(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function isStudentCurrentFine(item: StudentFineItem): boolean {
  return item.status === "pending" && item.resolved_at === null;
}

export function isStudentHistoricalFine(
  item: StudentFineItem | StudentFineHistoryItem,
): boolean {
  return (
    item.status !== "pending"
    || item.resolved_at !== null
    || item.resolved_by !== null
    || item.waive_reason !== null
  );
}

export function getStudentFineStatusPresentation(status: string): {
  label: string;
  helper: string;
  toneClassName: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        helper: "This fine is still unresolved in backend truth.",
        toneClassName: "border-amber-500/20 bg-amber-500/10 text-amber-700",
      };
    case "paid":
      return {
        label: "Paid",
        helper: "This fine was resolved as paid in backend settlement history.",
        toneClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
      };
    case "waived":
      return {
        label: "Waived",
        helper: "This fine was resolved as waived in backend settlement history.",
        toneClassName: "border-sky-500/20 bg-sky-500/10 text-sky-700",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        helper: "This fine was cancelled and is no longer an active obligation.",
        toneClassName: "border-border bg-muted text-muted-foreground",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        helper:
          "This fine status came from the backend and is shown without invented frontend meaning.",
        toneClassName: "border-border bg-muted text-muted-foreground",
      };
  }
}
