import "client-only";

/**
 * Student borrow lifecycle API client.
 *
 * Purpose:
 * - Centralize authenticated student borrow reads and mutations under one
 *   module-scoped transport boundary.
 * - Preserve backend error messages from the normalized JSON envelope instead
 *   of inventing frontend-only circulation rules.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import type { StudentActiveBorrowsData } from "@/lib/student-borrows";
import { readSupabaseBrowserSession } from "@/lib/supabase/client";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export class StudentBorrowsApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StudentBorrowsApiError";
    this.status = status;
  }
}

export function isStudentBorrowsApiError(
  error: unknown,
): error is StudentBorrowsApiError {
  return error instanceof StudentBorrowsApiError;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  signal?: AbortSignal;
};

export type StudentActiveBorrowsResponse =
  BackendSuccessEnvelope<StudentActiveBorrowsData>;
export type StudentBorrowMutationResponse =
  BackendSuccessEnvelope<Record<string, never>>;

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

  const detail = (payload as { detail?: unknown }).detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  const message = (payload as { message?: unknown }).message;

  return typeof message === "string" && message.trim() ? message : null;
}

function isAbortError(error: unknown): boolean {
  return Boolean(error instanceof Error && error.name === "AbortError");
}

async function studentBorrowsApiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<BackendSuccessEnvelope<TData>> {
  const accessToken = await getAccessToken();
  const headers = new Headers(options.headers);
  const requestUrl = `${getApiBaseUrl()}${path}`;

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
      body,
    });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new StudentBorrowsApiError(
      null,
      `Unable to reach the borrow service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
    );
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      getEnvelopeMessage(payload) ||
      `Request failed with status ${response.status}. Please try again.`;

    if (response.status === 401) {
      throw new SessionExpiredError(message);
    }

    throw new StudentBorrowsApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getStudentActiveBorrows(
  options: { signal?: AbortSignal } = {},
): Promise<StudentActiveBorrowsResponse> {
  return studentBorrowsApiRequest<StudentActiveBorrowsData>(
    "/api/me/borrows/active",
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function borrowStudentBook(
  bookId: string,
): Promise<StudentBorrowMutationResponse> {
  return studentBorrowsApiRequest<Record<string, never>>(
    "/api/borrow/borrow",
    {
      method: "POST",
      body: {
        book_id: bookId,
      },
    },
  );
}

export async function renewStudentBook(
  bookId: string,
): Promise<StudentBorrowMutationResponse> {
  return studentBorrowsApiRequest<Record<string, never>>(
    "/api/borrow/renew",
    {
      method: "POST",
      body: {
        book_id: bookId,
      },
    },
  );
}

export async function returnStudentBook(
  bookId: string,
): Promise<StudentBorrowMutationResponse> {
  return studentBorrowsApiRequest<Record<string, never>>(
    "/api/borrow/return",
    {
      method: "POST",
      body: {
        book_id: bookId,
      },
    },
  );
}
