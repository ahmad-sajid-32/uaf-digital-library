import "client-only";

// apps/web/src/lib/api/books.ts
/**
 * Book-inventory API client for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Centralize authenticated requests for the staff book-inventory module.
 * - Mirror the current backend contract for staff inventory list/detail reads,
 *   selected-book queue visibility, book create/update/delete flows, and
 *   book-cover upload/removal flows.
 * - Preserve backend error messages from the standardized JSON envelope so UI
 *   components can render truthful feedback.
 *
 * Book Cover Integration:
 * - Book-cover binaries are uploaded through FastAPI as multipart/form-data.
 * - The frontend does not upload directly to Supabase Storage.
 * - The backend validates the image, uploads it to the `book-covers` bucket,
 *   and persists cover metadata through PostgreSQL RPCs.
 *
 * Important:
 * - This module does not implement business logic.
 * - Authorization remains backend-owned through JWT verification and
 *   PostgreSQL-backed privilege checks.
 * - The frontend only attaches the current Supabase access token and reads the
 *   backend response contract.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import {
  SharedBookQueueApiError,
  type SharedBookQueueStatusResponse,
  getAuthenticatedBookQueueStatus,
} from "@/lib/api/book-queue";
import type {
  CreateBookPayload,
  StaffBookDetailData,
  StaffBookListItem,
  StaffBooksListData,
  UpdateBookPayload,
} from "@/lib/books";
import { readSupabaseBrowserSession } from "@/lib/supabase/client";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export interface BackendErrorEnvelope {
  status: number;
  message?: string;
  detail?: string | { message?: string };
  data?: Record<string, never>;
  timestamp_ms?: number;
}

export class BooksApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BooksApiError";
    this.status = status;
  }
}

export function isBooksApiError(error: unknown): error is BooksApiError {
  return error instanceof BooksApiError;
}

export type BookCoverMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface BookCoverMetadataItem {
  book_id: string;
  cover_image_path: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  cover_image_mime_type: BookCoverMimeType | null;
  cover_image_size_bytes: number | null;
  cover_image_updated_at: string | null;
}

export interface BookCoverDeleteMetadataItem extends BookCoverMetadataItem {
  previous_cover_image_path: string | null;
  previous_cover_image_url: string | null;
}

export interface BookCoverUploadData {
  cover: BookCoverMetadataItem;
}

export interface BookCoverDeleteData {
  cover: BookCoverDeleteMetadataItem;
}

export type StaffBooksListResponse = BackendSuccessEnvelope<StaffBooksListData>;
export type StaffBookDetailResponse =
  BackendSuccessEnvelope<StaffBookDetailData>;
export type BookQueueStatusResponse = SharedBookQueueStatusResponse;
export type EmptySuccessResponse = BackendSuccessEnvelope<
  Record<string, never>
>;
export type BookCoverUploadResponse =
  BackendSuccessEnvelope<BookCoverUploadData>;
export type BookCoverDeleteResponse =
  BackendSuccessEnvelope<BookCoverDeleteData>;

export interface GetStaffBooksOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface UploadBookCoverOptions {
  file: File;
  coverImageAlt?: string | null;
  signal?: AbortSignal;
}

export interface DeleteBookCoverOptions {
  signal?: AbortSignal;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  signal?: AbortSignal;
};

type MultipartApiRequestOptions = Omit<RequestInit, "body"> & {
  body: FormData;
  signal?: AbortSignal;
};

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Check apps/web/.env.local.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

async function getAccessToken(): Promise<string> {
  const { session, error } = await readSupabaseBrowserSession();

  if (error) {
    throw new Error("Unable to read the current session.");
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new SessionExpiredError();
  }

  return accessToken;
}

async function parseJsonResponse(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getEnvelopeMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const envelope = payload as BackendErrorEnvelope;
  const message = envelope.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const detail = envelope.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (
    detail &&
    typeof detail === "object" &&
    typeof detail.message === "string" &&
    detail.message.trim()
  ) {
    return detail.message;
  }

  return null;
}

function toBooksApiError(response: Response, payload: unknown): Error {
  const message =
    getEnvelopeMessage(payload) ||
    `Request failed with status ${response.status}. Please try again.`;

  if (response.status === 401) {
    return new SessionExpiredError(message);
  }

  return new BooksApiError(response.status, message);
}

async function booksApiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<BackendSuccessEnvelope<TData>> {
  const accessToken = await getAccessToken();
  const headers = new Headers(options.headers);
  const baseUrl = getApiBaseUrl();

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw toBooksApiError(response, payload);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

async function booksMultipartApiRequest<TData>(
  path: string,
  options: MultipartApiRequestOptions,
): Promise<BackendSuccessEnvelope<TData>> {
  const accessToken = await getAccessToken();
  const headers = new Headers(options.headers);
  const baseUrl = getApiBaseUrl();

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  /*
   * Do not set Content-Type here.
   * The browser must generate the multipart boundary for FormData.
   */
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw toBooksApiError(response, payload);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getStaffBooks(
  options: GetStaffBooksOptions = {},
): Promise<StaffBooksListResponse> {
  const searchParams = new URLSearchParams();

  if (options.limit !== undefined) {
    searchParams.set("limit", String(options.limit));
  }

  if (options.offset !== undefined) {
    searchParams.set("offset", String(options.offset));
  }

  const query = searchParams.toString();

  return booksApiRequest<StaffBooksListData>(
    `/api/admin/books${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function getAllStaffBooks(
  options: Pick<GetStaffBooksOptions, "signal"> = {},
): Promise<StaffBooksListResponse> {
  const aggregatedItems: StaffBookListItem[] = [];
  let total = 0;
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const response = await getStaffBooks({
      limit: pageSize,
      offset,
      signal: options.signal,
    });

    aggregatedItems.push(...response.data.items);
    total = response.data.total;
    offset += response.data.items.length;

    if (response.data.items.length === 0 || aggregatedItems.length >= total) {
      return {
        ...response,
        data: {
          items: aggregatedItems,
          total,
          limit: aggregatedItems.length || response.data.limit,
          offset: 0,
        },
      };
    }
  }
}

export async function getStaffBookById(
  bookId: string,
  options: { signal?: AbortSignal } = {},
): Promise<StaffBookDetailResponse> {
  return booksApiRequest<StaffBookDetailData>(`/api/admin/books/${bookId}`, {
    method: "GET",
    signal: options.signal,
  });
}

export async function getBookQueueStatus(
  bookId: string,
  options: { signal?: AbortSignal } = {},
): Promise<BookQueueStatusResponse> {
  try {
    return await getAuthenticatedBookQueueStatus(bookId, options);
  } catch (error: unknown) {
    if (error instanceof SharedBookQueueApiError) {
      throw new BooksApiError(error.status, error.message);
    }

    throw error;
  }
}

export async function createBook(
  payload: CreateBookPayload,
): Promise<BackendSuccessEnvelope<{ book_id: string }>> {
  return booksApiRequest<{ book_id: string }>("/api/books", {
    method: "POST",
    body: payload,
  });
}

export async function updateBook(
  bookId: string,
  payload: UpdateBookPayload,
): Promise<EmptySuccessResponse> {
  return booksApiRequest<Record<string, never>>(`/api/books/${bookId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function uploadBookCover(
  bookId: string,
  options: UploadBookCoverOptions,
): Promise<BookCoverUploadResponse> {
  const formData = new FormData();
  formData.set("file", options.file);

  const normalizedAlt = options.coverImageAlt?.trim();

  if (normalizedAlt) {
    formData.set("cover_image_alt", normalizedAlt);
  }

  return booksMultipartApiRequest<BookCoverUploadData>(
    `/api/books/${bookId}/cover`,
    {
      method: "POST",
      body: formData,
      signal: options.signal,
    },
  );
}

export async function deleteBookCover(
  bookId: string,
  options: DeleteBookCoverOptions = {},
): Promise<BookCoverDeleteResponse> {
  return booksApiRequest<BookCoverDeleteData>(`/api/books/${bookId}/cover`, {
    method: "DELETE",
    signal: options.signal,
  });
}

export async function deleteBook(
  bookId: string,
): Promise<EmptySuccessResponse> {
  return booksApiRequest<Record<string, never>>(`/api/books/${bookId}`, {
    method: "DELETE",
  });
}
