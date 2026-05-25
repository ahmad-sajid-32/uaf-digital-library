// apps/web/src/lib/books.ts
/**
 * Shared books contract for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Keep server-safe book enums, labels, constants, and data shapes separate
 *   from the browser-only API transport layer.
 * - Allow both Server Components and Client Components to read the same book
 *   contract without pulling in browser session code.
 * - Define public and staff-facing book-cover metadata shapes after the
 *   storage-backed cover-image feature.
 *
 * Book Cover Integration:
 * - Book-cover binaries live in the Supabase Storage `book-covers` bucket.
 * - PostgreSQL stores only object metadata/path.
 * - Backend responses enrich cover metadata with `cover_image_url`.
 * - Staff responses include MIME type and file size because staff users manage
 *   upload/replacement/removal workflows.
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

export const BOOK_COVER_BUCKET_NAME = "book-covers" as const;

export const BOOK_COVER_MIME_TYPE_VALUES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const BOOK_COVER_MAX_SIZE_BYTES = 2_097_152;

export type BookCategory = (typeof BOOK_CATEGORY_VALUES)[number];
export type BookStatus = (typeof BOOK_STATUS_VALUES)[number];
export type EditableBookStatus = (typeof EDITABLE_BOOK_STATUS_VALUES)[number];
export type BookCoverMimeType = (typeof BOOK_COVER_MIME_TYPE_VALUES)[number];

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

const BOOK_COVER_MIME_TYPE_LABELS: Record<BookCoverMimeType, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

export function getBookCategoryLabel(value: BookCategory): string {
  return BOOK_CATEGORY_LABELS[value];
}

export function getBookStatusLabel(value: BookStatus): string {
  return BOOK_STATUS_LABELS[value];
}

export function getBookCoverMimeTypeLabel(value: BookCoverMimeType): string {
  return BOOK_COVER_MIME_TYPE_LABELS[value];
}

export function isSupportedBookCoverMimeType(
  value: string | null | undefined,
): value is BookCoverMimeType {
  return BOOK_COVER_MIME_TYPE_VALUES.includes(value as BookCoverMimeType);
}

export function formatBookCoverSize(
  sizeBytes: number | null | undefined,
): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return "Not available";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface PublicBookCoverFields {
  cover_image_path: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  cover_image_updated_at: string | null;
}

export interface StaffBookCoverFields extends PublicBookCoverFields {
  cover_image_mime_type: BookCoverMimeType | null;
  cover_image_size_bytes: number | null;
}

export interface PublicCatalogBookListItem extends PublicBookCoverFields {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  status: BookStatus;
  created_at: string;
}

export interface PublicBookDetailItem extends PublicBookCoverFields {
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

export interface StaffBookListItem extends StaffBookCoverFields {
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

export interface PublicBooksListData {
  items: PublicCatalogBookListItem[];
  next_cursor_created_at: string | null;
  next_cursor_id: string | null;
}

export interface PublicBookDetailData {
  book: PublicBookDetailItem;
}

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
  override_borrow_duration_days?: number | null;
}
