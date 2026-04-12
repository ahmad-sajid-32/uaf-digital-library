import "client-only";

// apps/web/src/lib/api/book-queue.ts
/**
 * Shared authenticated selected-book queue transport.
 *
 * Purpose:
 * - Keep the single authenticated `/api/books/{book_id}/queue` read in one
 *   place because that endpoint is reused by more than one frontend module.
 * - Preserve backend error messages and 401 session-expiry behavior without
 *   merging unrelated module-level API clients together.
 *
 * Important:
 * - This helper is transport-only.
 * - Module-level API files still own when and why this queue read is used.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import type { BookQueueStatusData } from "@/lib/books";
import { readSupabaseBrowserSession } from "@/lib/supabase/client";

export interface SharedBackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export interface GetBookQueueStatusOptions {
  signal?: AbortSignal;
}

export class SharedBookQueueApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SharedBookQueueApiError";
    this.status = status;
  }
}

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

  const message = (payload as { message?: unknown }).message;

  return typeof message === "string" && message.trim() ? message : null;
}

export type SharedBookQueueStatusResponse =
  SharedBackendSuccessEnvelope<BookQueueStatusData>;

export async function getAuthenticatedBookQueueStatus(
  bookId: string,
  options: GetBookQueueStatusOptions = {},
): Promise<SharedBookQueueStatusResponse> {
  const accessToken = await getAccessToken();
  const headers = new Headers();
  const baseUrl = getApiBaseUrl();

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  const response = await fetch(`${baseUrl}/api/books/${bookId}/queue`, {
    method: "GET",
    headers,
    signal: options.signal,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      getEnvelopeMessage(payload) ||
      `Request failed with status ${response.status}. Please try again.`;

    if (response.status === 401) {
      throw new SessionExpiredError(message);
    }

    throw new SharedBookQueueApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as SharedBookQueueStatusResponse;
}
