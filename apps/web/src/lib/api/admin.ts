import "client-only";

// apps/web/src/lib/api/admin.ts
/**
 * Admin API client for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Centralize authenticated requests from the admin UI to the FastAPI backend.
 * - Mirror the current backend contract for admin-managed user
 *   list/detail/create/update/status/delete flows.
 * - Preserve backend error messages from the standardized JSON envelope so
 *   UI components can show truthful feedback instead of invented messages.
 *
 * Important:
 * - This module does not implement business logic.
 * - Authorization remains backend-owned through JWT verification + RLS.
 * - The frontend only attaches the current Supabase access token and reads
 *   the backend response contract.
 */

import { readSupabaseBrowserSession } from "@/lib/supabase/client";
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

export class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError;
}

export interface AdminCreatedUser {
  user_id: string;
  email: string;
  role: string;
  password_setup_required: boolean;
}

export type AdminCreatedUserResponse = BackendSuccessEnvelope<AdminCreatedUser>;

export interface AdminManagedUser {
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  full_name: string;
  roll_number: string | null;
  department: string | null;
  semester: number | null;
  employee_code: string | null;
  designation: string | null;
  created_at: string;
}

export interface GetAdminManagedUsersOptions {
  role?: "student" | "librarian" | "admin";
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface AdminManagedUsersListData {
  items: AdminManagedUser[];
  total: number;
  limit: number;
  offset: number;
}

export type AdminManagedUsersListResponse =
  BackendSuccessEnvelope<AdminManagedUsersListData>;

export interface AdminManagedUserDetailBase {
  user_id: string;
  email: string;
  role: "STUDENT" | "LIBRARIAN" | "ADMIN";
  is_active: boolean;
  full_name: string;
  created_at: string;
}

export interface AdminManagedStudentProfile {
  roll_number: string;
  department: string;
  semester: number;
}

export interface AdminManagedLibrarianProfile {
  employee_code: string;
  department: string;
}

export interface AdminManagedAdminProfile {
  designation: string;
}

export interface AdminManagedStudentDetailUser
  extends AdminManagedUserDetailBase {
  role: "STUDENT";
  student_profile: AdminManagedStudentProfile;
}

export interface AdminManagedLibrarianDetailUser
  extends AdminManagedUserDetailBase {
  role: "LIBRARIAN";
  librarian_profile: AdminManagedLibrarianProfile;
}

export interface AdminManagedAdminDetailUser
  extends AdminManagedUserDetailBase {
  role: "ADMIN";
  admin_profile: AdminManagedAdminProfile;
}

export type AdminManagedUserDetail =
  | AdminManagedStudentDetailUser
  | AdminManagedLibrarianDetailUser
  | AdminManagedAdminDetailUser;

export interface AdminManagedUserDetailData {
  user: AdminManagedUserDetail;
}

export type AdminManagedUserDetailResponse =
  BackendSuccessEnvelope<AdminManagedUserDetailData>;

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
  full_name?: string;
  roll_number?: string;
  department?: string;
  semester?: number;
  employee_code?: string;
  designation?: string;
}

export interface UpdateAdminManagedUserStatusPayload {
  is_active: boolean;
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

    throw new AdminApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
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

export async function getAdminManagedUsers(
  options: GetAdminManagedUsersOptions = {},
): Promise<AdminManagedUsersListResponse> {
  const searchParams = new URLSearchParams();

  if (options.role) {
    searchParams.set("role", options.role);
  }

  if (options.isActive !== undefined) {
    searchParams.set("is_active", String(options.isActive));
  }

  if (options.search) {
    searchParams.set("search", options.search);
  }

  if (options.limit !== undefined) {
    searchParams.set("limit", String(options.limit));
  }

  if (options.offset !== undefined) {
    searchParams.set("offset", String(options.offset));
  }

  const query = searchParams.toString();

  return adminApiRequest<AdminManagedUsersListData>(
    `/api/admin/users${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function getAllAdminManagedUsers(
  options: Omit<GetAdminManagedUsersOptions, "limit" | "offset"> = {},
): Promise<AdminManagedUsersListResponse> {
  const aggregatedItems: AdminManagedUser[] = [];
  let total = 0;
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const response = await getAdminManagedUsers({
      ...options,
      limit: pageSize,
      offset,
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

export async function getAdminManagedUserById(
  userId: string,
  options: { signal?: AbortSignal } = {},
): Promise<AdminManagedUserDetailResponse> {
  return adminApiRequest<AdminManagedUserDetailData>(
    `/api/admin/users/${userId}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
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

export async function updateAdminManagedUserStatus(
  userId: string,
  payload: UpdateAdminManagedUserStatusPayload,
): Promise<EmptySuccessResponse> {
  return adminApiRequest<Record<string, never>>(
    `/api/admin/users/${userId}/status`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}
