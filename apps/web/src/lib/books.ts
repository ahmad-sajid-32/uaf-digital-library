// apps/web/src/lib/books.ts
/**
 * Shared books contract for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Keep server-safe book enums, labels, and data shapes separate from the
 *   browser-only API transport layer.
 * - Allow both Server Components and Client Components to read the same book
 *   contract without pulling in browser session code.
 *
 * Important:
 * - This file contains no token reads, no fetch calls, and no browser-only
 *   Supabase helpers.
 * - Client-only request logic belongs in `@/lib/api/books`.
 */

export const BOOK_CATEGORY_VALUES = [
  "science",
  "engineering",
  "agriculture",
  "computer_science",
  "mathematics",
  "business",
  "arts",
  "social_science",
  "other",
] as const;

export const BOOK_STATUS_VALUES = [
  "available",
  "borrowed",
  "reserved",
  "maintenance",
] as const;

export const EDITABLE_BOOK_STATUS_VALUES = [
  "available",
  "maintenance",
] as const;

export type BookCategory = (typeof BOOK_CATEGORY_VALUES)[number];
export type BookStatus = (typeof BOOK_STATUS_VALUES)[number];
export type EditableBookStatus = (typeof EDITABLE_BOOK_STATUS_VALUES)[number];

const BOOK_CATEGORY_LABELS: Record<BookCategory, string> = {
  science: "Science",
  engineering: "Engineering",
  agriculture: "Agriculture",
  computer_science: "Computer Science",
  mathematics: "Mathematics",
  business: "Business",
  arts: "Arts",
  social_science: "Social Science",
  other: "Other",
};

const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  available: "Available",
  borrowed: "Borrowed",
  reserved: "Reserved",
  maintenance: "Maintenance",
};

export function getBookCategoryLabel(value: BookCategory): string {
  return BOOK_CATEGORY_LABELS[value];
}

export function getBookStatusLabel(value: BookStatus): string {
  return BOOK_STATUS_LABELS[value];
}

export interface StaffBookListItem {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  status: BookStatus;
  replacement_cost: number | string;
  fine_per_day_rate: number | string;
  override_borrow_duration_days: number | null;
  created_at: string;
}

export type StaffBookDetailItem = StaffBookListItem;

export interface BookQueueStatusItem {
  book_id: string;
  book_status: BookStatus;
  waiting_count: number;
  has_notified: boolean;
  notified_at: string | null;
  hold_expires_at: string | null;
}

export interface StaffBooksListData {
  items: StaffBookListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface StaffBookDetailData {
  book: StaffBookDetailItem;
}

export interface BookQueueStatusData {
  queue: BookQueueStatusItem;
}

export interface CreateBookPayload {
  title: string;
  author: string;
  category: BookCategory;
  replacement_cost: number;
  fine_per_day_rate: number;
  override_borrow_duration_days?: number | null;
}

export interface UpdateBookPayload {
  title?: string;
  author?: string;
  category?: BookCategory;
  status?: EditableBookStatus;
  replacement_cost?: number;
  fine_per_day_rate?: number;
  override_borrow_duration_days?: number;
}
