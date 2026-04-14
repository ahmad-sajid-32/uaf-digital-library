import "client-only";

/**
 * Staff public-result lookup API client.
 *
 * Purpose:
 * - Centralize registration-number lookup transport under one shared boundary
 *   for admin and librarian protected-shell pages.
 * - Keep public lookup separate from the protected student result contract.
 */

import type { StaffResultData } from "@/lib/staff-result";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export class StaffResultApiError extends Error {
  status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StaffResultApiError";
    this.status = status;
  }
}

export function isStaffResultApiError(
  error: unknown,
): error is StaffResultApiError {
  return error instanceof StaffResultApiError;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  signal?: AbortSignal;
};

export type StaffResultResponse = BackendSuccessEnvelope<StaffResultData>;

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Check apps/web/.env.local.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
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

async function staffResultApiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<BackendSuccessEnvelope<TData>> {
  const requestUrl = `${getApiBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new StaffResultApiError(
      null,
      `Unable to reach the public result lookup service at ${requestUrl}. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
    );
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      getEnvelopeMessage(payload)
      || `Request failed with status ${response.status}. Please try again.`;

    throw new StaffResultApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getStaffResultByRegistration(
  regNumber: string,
  options: { signal?: AbortSignal } = {},
): Promise<StaffResultResponse> {
  const query = new URLSearchParams({
    reg_number: regNumber,
  });

  return staffResultApiRequest<StaffResultData>(
    `/api/public/result?${query.toString()}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}
