// apps/web/src/lib/api/fines.ts
import "client-only";

/**
 * Fine-management API client for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Centralize authenticated requests for the staff fine-management module.
 * - Mirror the current backend contract for staff fine list/detail reads and
 *   fine settlement actions.
 * - Preserve backend error messages from the standardized JSON envelope so
 *   UI components can render truthful feedback.
 *
 * Important:
 * - This module does not implement business logic.
 * - Authorization remains backend-owned through JWT verification + RLS-backed
 *   PostgreSQL RPC guards.
 * - The frontend only attaches the current Supabase access token and reads the
 *   backend response contract.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
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

export class FinesApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FinesApiError";
    this.status = status;
  }
}

export function isFinesApiError(error: unknown): error is FinesApiError {
  return error instanceof FinesApiError;
}

export type FineStatus = "pending" | "paid" | "waived" | "cancelled";

export interface StaffFineListItem {
  fine_id: string;
  transaction_id: string;
  user_id: string;
  user_full_name: string;
  book_id: string;
  title: string;
  amount: number | string;
  status: FineStatus;
  fine_created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  waive_reason: string | null;
}

export interface StaffFineDetailItem extends StaffFineListItem {
  issue_date: string;
  due_date: string;
  return_date: string | null;
}

export interface StaffFinesListData {
  items: StaffFineListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface StaffFineDetailData {
  item: StaffFineDetailItem;
}

export type StaffFinesListResponse = BackendSuccessEnvelope<StaffFinesListData>;
export type StaffFineDetailResponse =
  BackendSuccessEnvelope<StaffFineDetailData>;
export type EmptySuccessResponse = BackendSuccessEnvelope<Record<string, never>>;

export interface GetStaffFinesOptions {
  status?: FineStatus;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  resolvedFrom?: string;
  resolvedTo?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface WaiveFinePayload {
  reason?: string | null;
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

async function finesApiRequest<TData>(
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

    throw new FinesApiError(response.status, message);
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

export async function getStaffFines(
  options: GetStaffFinesOptions = {},
): Promise<StaffFinesListResponse> {
  const searchParams = new URLSearchParams();

  appendQueryParam(searchParams, "status", options.status);
  appendQueryParam(searchParams, "search", options.search);
  appendQueryParam(searchParams, "created_from", options.createdFrom);
  appendQueryParam(searchParams, "created_to", options.createdTo);
  appendQueryParam(searchParams, "resolved_from", options.resolvedFrom);
  appendQueryParam(searchParams, "resolved_to", options.resolvedTo);

  if (options.limit !== undefined) {
    searchParams.set("limit", String(options.limit));
  }

  if (options.offset !== undefined) {
    searchParams.set("offset", String(options.offset));
  }

  const query = searchParams.toString();

  return finesApiRequest<StaffFinesListData>(
    `/api/admin/fines${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function getAllStaffFines(
  options: Pick<GetStaffFinesOptions, "signal"> = {},
): Promise<StaffFinesListResponse> {
  const aggregatedItems: StaffFineListItem[] = [];
  let total = 0;
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const response = await getStaffFines({
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

export async function getStaffFineById(
  fineId: string,
  options: { signal?: AbortSignal } = {},
): Promise<StaffFineDetailResponse> {
  return finesApiRequest<StaffFineDetailData>(`/api/admin/fines/${fineId}`, {
    method: "GET",
    signal: options.signal,
  });
}

export async function payFine(
  fineId: string,
): Promise<EmptySuccessResponse> {
  return finesApiRequest<Record<string, never>>(`/api/fines/${fineId}/pay`, {
    method: "POST",
  });
}

export async function waiveFine(
  fineId: string,
  payload: WaiveFinePayload,
): Promise<EmptySuccessResponse> {
  return finesApiRequest<Record<string, never>>(`/api/fines/${fineId}/waive`, {
    method: "POST",
    body: payload,
  });
}
