import "client-only";

// apps/web/src/lib/api/student-catalog.ts
/**
 * Student catalog API client for the protected student discovery flow.
 *
 * Purpose:
 * - Centralize the student-facing catalog reads without reusing the staff
 *   inventory transport layer.
 * - Keep public catalog list/detail requests token-free while still exposing the
 *   authenticated selected-book queue visibility contract through one module
 *   boundary.
 * - Preserve backend error messages so the catalog UI can render truthful
 *   loading, retry, and partial-failure states.
 */

import {
  SharedBookQueueApiError,
  type SharedBookQueueStatusResponse,
  getAuthenticatedBookQueueStatus,
} from "@/lib/api/book-queue";
import type {
  PublicBookDetailData,
  PublicBooksListData,
} from "@/lib/books";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export class StudentCatalogApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StudentCatalogApiError";
    this.status = status;
  }
}

export function isStudentCatalogApiError(
  error: unknown,
): error is StudentCatalogApiError {
  return error instanceof StudentCatalogApiError;
}

export interface GetStudentCatalogPageOptions {
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export type StudentCatalogPageResponse =
  BackendSuccessEnvelope<PublicBooksListData>;
export type StudentBookDetailResponse =
  BackendSuccessEnvelope<PublicBookDetailData>;
export type StudentBookQueueStatusResponse = SharedBookQueueStatusResponse;

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Check apps/web/.env.local.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

async function parseJsonResponse(
  response: Response,
): Promise<unknown | null> {
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

  const message = (payload as { message?: unknown }).message;

  return typeof message === "string" && message.trim() ? message : null;
}

function isAbortError(error: unknown): boolean {
  return Boolean(error instanceof Error && error.name === "AbortError");
}

async function studentCatalogPublicRequest<TData>(
  path: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<BackendSuccessEnvelope<TData>> {
  const requestUrl = `${getApiBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: options.signal,
    });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new StudentCatalogApiError(
      null,
      `Unable to reach the catalog service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
    );
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new StudentCatalogApiError(
      response.status,
      getEnvelopeMessage(payload) ||
        `Request failed with status ${response.status}. Please try again.`,
    );
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

function appendQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
): void {
  if (value === undefined || value === null) {
    return;
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return;
  }

  searchParams.set(key, normalized);
}

export async function getStudentCatalogPage(
  options: GetStudentCatalogPageOptions = {},
): Promise<StudentCatalogPageResponse> {
  const searchParams = new URLSearchParams();

  appendQueryParam(
    searchParams,
    "cursor_created_at",
    options.cursorCreatedAt ?? null,
  );
  appendQueryParam(searchParams, "cursor_id", options.cursorId ?? null);
  appendQueryParam(searchParams, "limit", options.limit ?? 20);

  const query = searchParams.toString();

  return studentCatalogPublicRequest<PublicBooksListData>(
    `/api/books${query ? `?${query}` : ""}`,
    {
      signal: options.signal,
    },
  );
}

export async function getStudentBookById(
  bookId: string,
  options: { signal?: AbortSignal } = {},
): Promise<StudentBookDetailResponse> {
  return studentCatalogPublicRequest<PublicBookDetailData>(`/api/books/${bookId}`, {
    signal: options.signal,
  });
}

export async function getStudentBookQueueStatus(
  bookId: string,
  options: { signal?: AbortSignal } = {},
): Promise<StudentBookQueueStatusResponse> {
  try {
    return await getAuthenticatedBookQueueStatus(bookId, options);
  } catch (error: unknown) {
    if (error instanceof SharedBookQueueApiError) {
      throw new StudentCatalogApiError(error.status, error.message);
    }

    throw error;
  }
}
