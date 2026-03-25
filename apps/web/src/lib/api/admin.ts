import "client-only";

// apps/web/src/lib/api/admin.ts
/**
 * Admin API client for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Centralize authenticated requests from the admin UI to the FastAPI backend.
 * - Mirror the current backend contract for admin dashboard metrics and
 *   admin-managed user creation/update/delete flows.
 * - Preserve backend error messages from the standardized JSON envelope so
 *   UI components can show truthful feedback instead of invented messages.
 *
 * Important:
 * - This module does not implement business logic.
 * - Authorization remains backend-owned through JWT verification + RLS.
 * - The frontend only attaches the current Supabase access token and reads
 *   the backend response contract.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SessionExpiredError } from "@/lib/auth/session-errors";

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

export interface PopularBookMetric {
  book_id: string;
  title: string;
  borrow_count: number;
}

export interface QueuePressureMetric {
  book_id: string;
  title: string;
  waiting_count: number;
}

export interface AdminDashboardMetrics {
  active_borrow_count: number;
  overdue_count: number;
  total_pending_fines: number | string;
  popular_books: PopularBookMetric[];
  queue_pressure: QueuePressureMetric[];
}

export type AdminDashboardMetricsResponse =
  BackendSuccessEnvelope<AdminDashboardMetrics>;

export interface GetAdminDashboardMetricsOptions {
  popularLimit?: number;
  queueLimit?: number;
  signal?: AbortSignal;
}

export interface AdminCreatedUser {
  user_id: string;
  email: string;
  role: string;
  password_setup_required: boolean;
}

export type AdminCreatedUserResponse = BackendSuccessEnvelope<AdminCreatedUser>;

export interface CreateStudentPayload {
  email: string;
  full_name: string;
  roll_number: string;
  department: string;
  semester: number;
}

export interface CreateLibrarianPayload {
  email: string;
  full_name: string;
  employee_code: string;
  department: string;
}

export interface CreateAdminPayload {
  email: string;
  full_name: string;
  designation: string;
}

export interface UpdateAdminManagedUserProfilePayload {
  full_name: string;
}

export type EmptySuccessResponse = BackendSuccessEnvelope<Record<string, never>>;

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
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error("Unable to read the current session.");
  }

  const accessToken = data.session?.access_token;

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

async function adminApiRequest<TData>(
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

    throw new Error(message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getAdminDashboardMetrics(
  options: GetAdminDashboardMetricsOptions = {},
): Promise<AdminDashboardMetricsResponse> {
  const searchParams = new URLSearchParams();

  if (options.popularLimit !== undefined) {
    searchParams.set("popular_limit", String(options.popularLimit));
  }

  if (options.queueLimit !== undefined) {
    searchParams.set("queue_limit", String(options.queueLimit));
  }

  const query = searchParams.toString();

  return adminApiRequest<AdminDashboardMetrics>(
    `/api/admin/metrics/dashboard${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function createStudentAccount(
  payload: CreateStudentPayload,
): Promise<AdminCreatedUserResponse> {
  return adminApiRequest<AdminCreatedUser>("/api/admin/users/students", {
    method: "POST",
    body: payload,
  });
}

export async function createLibrarianAccount(
  payload: CreateLibrarianPayload,
): Promise<AdminCreatedUserResponse> {
  return adminApiRequest<AdminCreatedUser>("/api/admin/users/librarians", {
    method: "POST",
    body: payload,
  });
}

export async function createAdminAccount(
  payload: CreateAdminPayload,
): Promise<AdminCreatedUserResponse> {
  return adminApiRequest<AdminCreatedUser>("/api/admin/users/admins", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminManagedUserProfile(
  userId: string,
  payload: UpdateAdminManagedUserProfilePayload,
): Promise<EmptySuccessResponse> {
  return adminApiRequest<Record<string, never>>(
    `/api/admin/users/${userId}/profile`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function deleteAdminManagedUser(
  userId: string,
): Promise<EmptySuccessResponse> {
  return adminApiRequest<Record<string, never>>(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
}
