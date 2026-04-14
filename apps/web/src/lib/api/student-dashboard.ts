import "client-only";

/**
 * Student dashboard API client.
 *
 * Purpose:
 * - Centralize authenticated student dashboard reads under one module-scoped
 *   transport boundary.
 * - Keep the dashboard contract separate from admin and librarian metrics APIs.
 * - Preserve backend error messages so the student dashboard can render
 *   truthful loading, retry, and stale-data states.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import type { StudentDashboardData } from "@/lib/student-dashboard";
import { readSupabaseBrowserSession } from "@/lib/supabase/client";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export class StudentDashboardApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StudentDashboardApiError";
    this.status = status;
  }
}

export function isStudentDashboardApiError(
  error: unknown,
): error is StudentDashboardApiError {
  return error instanceof StudentDashboardApiError;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  signal?: AbortSignal;
};

export type StudentDashboardResponse =
  BackendSuccessEnvelope<StudentDashboardData>;

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

async function studentDashboardApiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<BackendSuccessEnvelope<TData>> {
  const accessToken = await getAccessToken();
  const headers = new Headers(options.headers);
  const requestUrl = `${getApiBaseUrl()}${path}`;

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new StudentDashboardApiError(
      null,
      `Unable to reach the student dashboard service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
    );
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      getEnvelopeMessage(payload)
      || `Request failed with status ${response.status}. Please try again.`;

    if (response.status === 401) {
      throw new SessionExpiredError(message);
    }

    throw new StudentDashboardApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getStudentDashboard(
  options: { signal?: AbortSignal } = {},
): Promise<StudentDashboardResponse> {
  return studentDashboardApiRequest<StudentDashboardData>("/api/me/dashboard", {
    method: "GET",
    signal: options.signal,
  });
}
