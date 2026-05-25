import "client-only";

/**
 * Shared self-profile API client.
 *
 * Purpose:
 * - Centralize authenticated self-service profile mutations under one shared
 *   transport boundary for all protected roles.
 * - Keep self-profile updates separate from admin user-management semantics.
 * - Align the client-visible shell name after a successful backend profile
 *   update because the repo still exposes no profile read route.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import type {
  SelfAvatarData,
  SelfAvatarDeleteResponse,
  SelfAvatarResponse,
  SelfAvatarUploadResponse,
  SelfProfileUpdatePayload,
} from "@/lib/self-profile";
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

export class SelfProfileApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "SelfProfileApiError";
    this.status = status;
  }
}

export function isSelfProfileApiError(
  error: unknown,
): error is SelfProfileApiError {
  return error instanceof SelfProfileApiError;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  signal?: AbortSignal;
};

export type SelfProfileMutationResponse =
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

async function selfProfileApiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<BackendSuccessEnvelope<TData>> {
  const accessToken = await getAccessToken();
  const headers = new Headers(options.headers);
  const requestUrl = `${getApiBaseUrl()}${path}`;

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
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

    throw new SelfProfileApiError(
      null,
      `Unable to reach the self-profile service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
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

    throw new SelfProfileApiError(response.status, message);
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

export async function updateSelfProfile(
  payload: SelfProfileUpdatePayload,
): Promise<SelfProfileMutationResponse> {
  return selfProfileApiRequest<Record<string, never>>("/api/me/profile", {
    method: "PATCH",
    body: payload,
  });
}

export async function getSelfAvatar(): Promise<SelfAvatarResponse> {
  return selfProfileApiRequest<SelfAvatarData>("/api/me/avatar", {
    method: "GET",
  });
}

export async function uploadSelfAvatar(
  file: File,
): Promise<SelfAvatarUploadResponse> {
  const body = new FormData();
  body.append("file", file);

  return selfProfileApiRequest<SelfAvatarData>("/api/me/avatar", {
    method: "POST",
    body,
  });
}

export async function deleteSelfAvatar(): Promise<SelfAvatarDeleteResponse> {
  return selfProfileApiRequest<SelfAvatarData>("/api/me/avatar", {
    method: "DELETE",
  });
}

export async function deleteMyAccount(): Promise<SelfProfileMutationResponse> {
  return selfProfileApiRequest<Record<string, never>>("/api/me", {
    method: "DELETE",
  });
}

export async function syncSelfProfileSession(fullName: string): Promise<void> {
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
