import "client-only";

/**
 * Student queue API client.
 *
 * Purpose:
 * - Centralize authenticated student queue reads and mutations under one
 *   module-scoped transport boundary.
 * - Preserve backend error messages from the normalized JSON envelope instead
 *   of inventing frontend-only queue rules.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import type { StudentQueueData, StudentQueueItem } from "@/lib/student-queue";
import { readSupabaseBrowserSession } from "@/lib/supabase/client";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export class StudentQueueApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StudentQueueApiError";
    this.status = status;
  }
}

export function isStudentQueueApiError(
  error: unknown,
): error is StudentQueueApiError {
  return error instanceof StudentQueueApiError;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  signal?: AbortSignal;
};

interface RawStudentQueueItem {
  book_id: string;
  title: string;
  status: string;
  position?: number;
  queue_position?: number;
  notified_at: string | null;
  hold_expires_at: string | null;
}

interface RawStudentQueueData {
  items: RawStudentQueueItem[];
}

export type StudentQueueResponse = BackendSuccessEnvelope<StudentQueueData>;
export type StudentQueueMutationResponse =
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

function normalizeQueueItem(item: RawStudentQueueItem): StudentQueueItem {
  const resolvedPosition =
    typeof item.position === "number"
      ? item.position
      : typeof item.queue_position === "number"
        ? item.queue_position
        : null;

  if (resolvedPosition === null) {
    throw new Error("Backend returned a queue row without a queue position.");
  }

  return {
    book_id: item.book_id,
    title: item.title,
    status: item.status,
    position: resolvedPosition,
    notified_at: item.notified_at,
    hold_expires_at: item.hold_expires_at,
  };
}

async function studentQueueApiRequest<TData>(
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

    throw new StudentQueueApiError(
      null,
      `Unable to reach the queue service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
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

    throw new StudentQueueApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getStudentQueue(
  options: { signal?: AbortSignal } = {},
): Promise<StudentQueueResponse> {
  const response = await studentQueueApiRequest<RawStudentQueueData>(
    "/api/me/queue",
    {
      method: "GET",
      signal: options.signal,
    },
  );

  return {
    ...response,
    data: {
      items: response.data.items.map(normalizeQueueItem),
    },
  };
}

export async function joinStudentQueue(
  bookId: string,
): Promise<StudentQueueMutationResponse> {
  return studentQueueApiRequest<Record<string, never>>(
    "/api/queue/join",
    {
      method: "POST",
      body: {
        book_id: bookId,
      },
    },
  );
}

export async function cancelStudentQueue(
  bookId: string,
): Promise<StudentQueueMutationResponse> {
  return studentQueueApiRequest<Record<string, never>>(
    "/api/queue/cancel",
    {
      method: "POST",
      body: {
        book_id: bookId,
      },
    },
  );
}
