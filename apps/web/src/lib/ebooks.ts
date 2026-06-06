export const EBOOK_CATEGORIES = [
  "science", "engineering", "agriculture", "computer_science", "mathematics",
  "business", "arts", "social_science", "other",
] as const;

export type EBookCategory = (typeof EBOOK_CATEGORIES)[number];
export type EBookStatus = "draft" | "published" | "archived";
export type EBookFileStatus = "uploaded" | "ready" | "failed";
export type EBookFormat = "pdf" | "epub";
export type EBookAccessScope = "all_authenticated" | "students_only" | "staff_only";
export type EBookAccessEventType = "preview" | "download";

export interface EBookFile {
  id: string;
  original_filename: string;
  file_format: EBookFormat;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  file_status: EBookFileStatus;
  validation_error?: string | null;
}

export interface EBook {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string;
  description?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  publication_year?: number | null;
  edition?: string | null;
  language: string;
  category: EBookCategory;
  keywords: string[];
  linked_book_id?: string | null;
  status: EBookStatus;
  access_scope: EBookAccessScope;
  allow_preview: boolean;
  allow_download: boolean;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  file?: EBookFile | null;
}

export const labelToken = (value: string): string =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
