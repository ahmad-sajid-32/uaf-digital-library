import "client-only";

/**
 * Student profile/account API client.
 *
 * Purpose:
 * - Centralize authenticated student self-service profile mutations under one
 *   module-scoped transport boundary.
 * - Keep profile update and account deletion separate from admin user
 *   management semantics.
 * - Explicitly align the client-visible auth display name after a successful
 *   backend profile update because the current repo does not expose a profile
 *   read route.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import type { StudentProfileUpdatePayload } from "@/lib/student-profile";
import {
  getSupabaseBrowserClient,
  readSupabaseBrowserSession,
} from "@/lib/supabase/client";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export class StudentProfileApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StudentProfileApiError";
    this.status = status;
  }
}

export function isStudentProfileApiError(
  error: unknown,
): error is StudentProfileApiError {
  return error instanceof StudentProfileApiError;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  signal?: AbortSignal;
};

export type StudentProfileMutationResponse =
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

async function studentProfileApiRequest<TData>(
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

    throw new StudentProfileApiError(
      null,
      `Unable to reach the student profile service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
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

    throw new StudentProfileApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

function toSafeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function updateStudentProfile(
  payload: StudentProfileUpdatePayload,
): Promise<StudentProfileMutationResponse> {
  return studentProfileApiRequest<Record<string, never>>("/api/me/profile", {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteStudentAccount(): Promise<StudentProfileMutationResponse> {
  return studentProfileApiRequest<Record<string, never>>("/api/me", {
    method: "DELETE",
  });
}

export async function syncStudentProfileSession(
  fullName: string,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
    },
  });

  if (error) {
    throw new Error(
      toSafeErrorMessage(
        error,
        "Profile updated, but the local session display name could not be refreshed yet.",
      ),
    );
  }
}

