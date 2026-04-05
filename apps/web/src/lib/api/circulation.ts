import "client-only";

// apps/web/src/lib/api/circulation.ts
/**
 * Staff circulation API client for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Centralize authenticated requests for the staff circulation module.
 * - Mirror the current backend contract for circulation list/detail reads and
 *   transaction-scoped actions.
 * - Preserve backend error messages from the standardized JSON envelope so UI
 *   surfaces can render truthful feedback.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
import {
  type AdjustLoanDueDatePayload,
  type CirculationBookQueueStatusItem,
  type CirculationBookStatus,
  type CirculationRole,
  type CirculationScope,
  type StaffCirculationLoanDetailData,
  type StaffCirculationLoansData,
} from "@/lib/circulation";
import { readSupabaseBrowserSession } from "@/lib/supabase/client";

export interface BackendSuccessEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
}

export interface BackendErrorEnvelope {
  status: number;
  message: string;
  data: Record<string, never>;
  timestamp_ms: number;
}

export class CirculationApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CirculationApiError";
    this.status = status;
  }
}

export function isCirculationApiError(
  error: unknown,
): error is CirculationApiError {
  return error instanceof CirculationApiError;
}

export interface GetStaffCirculationLoansOptions {
  scope: CirculationScope;
  search?: string;
  role?: CirculationRole;
  bookStatus?: CirculationBookStatus;
  dueFrom?: string;
  dueTo?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
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

async function parseJsonResponse(
  response: Response,
): Promise<BackendErrorEnvelope | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as BackendErrorEnvelope;
  } catch {
    return null;
  }
}

async function circulationApiRequest<TData>(
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
    const message =
      payload?.message ||
      `Request failed with status ${response.status}. Please try again.`;

    if (response.status === 401) {
      throw new SessionExpiredError(message);
    }

    throw new CirculationApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

function appendQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | number | undefined,
): void {
  if (value === undefined) {
    return;
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return;
  }

  searchParams.set(key, normalized);
}

export async function getStaffCirculationLoans(
  options: GetStaffCirculationLoansOptions,
): Promise<BackendSuccessEnvelope<StaffCirculationLoansData>> {
  const searchParams = new URLSearchParams();

  searchParams.set("scope", options.scope);
  appendQueryParam(searchParams, "search", options.search);
  appendQueryParam(searchParams, "role", options.role);
  appendQueryParam(searchParams, "book_status", options.bookStatus);
  appendQueryParam(searchParams, "due_from", options.dueFrom);
  appendQueryParam(searchParams, "due_to", options.dueTo);

  if (options.limit !== undefined) {
    searchParams.set("limit", String(options.limit));
  }

  if (options.offset !== undefined) {
    searchParams.set("offset", String(options.offset));
  }

  const query = searchParams.toString();

  return circulationApiRequest<StaffCirculationLoansData>(
    `/api/admin/circulation/loans?${query}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function getAllStaffCirculationLoans(
  scope: CirculationScope,
  options: { signal?: AbortSignal } = {},
): Promise<BackendSuccessEnvelope<StaffCirculationLoansData>> {
  const aggregatedItems: StaffCirculationLoansData["items"] = [];
  let total = 0;
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const response = await getStaffCirculationLoans({
      scope,
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

export async function getStaffCirculationLoanById(
  transactionId: string,
  options: { signal?: AbortSignal } = {},
): Promise<BackendSuccessEnvelope<StaffCirculationLoanDetailData>> {
  return circulationApiRequest<StaffCirculationLoanDetailData>(
    `/api/admin/circulation/loans/${transactionId}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function adjustStaffCirculationLoanDueDate(
  transactionId: string,
  payload: AdjustLoanDueDatePayload,
): Promise<BackendSuccessEnvelope<Record<string, never>>> {
  return circulationApiRequest<Record<string, never>>(
    `/api/admin/circulation/loans/${transactionId}/due-date`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function returnStaffCirculationLoan(
  transactionId: string,
): Promise<BackendSuccessEnvelope<Record<string, never>>> {
  return circulationApiRequest<Record<string, never>>(
    `/api/admin/circulation/loans/${transactionId}/return`,
    {
      method: "POST",
    },
  );
}

export async function renewStaffCirculationLoan(
  transactionId: string,
): Promise<BackendSuccessEnvelope<Record<string, never>>> {
  return circulationApiRequest<Record<string, never>>(
    `/api/admin/circulation/loans/${transactionId}/renew`,
    {
      method: "POST",
    },
  );
}

export async function getCirculationBookQueueStatus(
  bookId: string,
  options: { signal?: AbortSignal } = {},
): Promise<BackendSuccessEnvelope<{ queue: CirculationBookQueueStatusItem }>> {
  return circulationApiRequest<{ queue: CirculationBookQueueStatusItem }>(
    `/api/books/${bookId}/queue`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}
