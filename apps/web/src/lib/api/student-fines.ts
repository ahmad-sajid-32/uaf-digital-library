import "client-only";

/**
 * Student fines API client.
 *
 * Purpose:
 * - Centralize authenticated student fine reads under one module-scoped
 *   transport boundary.
 * - Preserve backend error messages from the normalized JSON envelope instead
 *   of inventing settlement behavior in the student module.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import type {
  StudentFineHistoryData,
  StudentFinesData,
} from "@/lib/student-fines";
import { readSupabaseBrowserSession } from "@/lib/supabase/client";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export class StudentFinesApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StudentFinesApiError";
    this.status = status;
  }
}

export function isStudentFinesApiError(
  error: unknown,
): error is StudentFinesApiError {
  return error instanceof StudentFinesApiError;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  signal?: AbortSignal;
};

export type StudentFinesResponse = BackendSuccessEnvelope<StudentFinesData>;
export type StudentFineHistoryResponse =
  BackendSuccessEnvelope<StudentFineHistoryData>;

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

async function studentFinesApiRequest<TData>(
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

    throw new StudentFinesApiError(
      null,
      `Unable to reach the student fines service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
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

    throw new StudentFinesApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getStudentCurrentFines(
  options: { signal?: AbortSignal } = {},
): Promise<StudentFinesResponse> {
  return studentFinesApiRequest<StudentFinesData>("/api/me/fines", {
    method: "GET",
    signal: options.signal,
  });
}

export async function getStudentFineHistory(
  options: { signal?: AbortSignal } = {},
): Promise<StudentFineHistoryResponse> {
  return studentFinesApiRequest<StudentFineHistoryData>(
    "/api/me/fines/history",
    {
      method: "GET",
      signal: options.signal,
    },
  );
}
