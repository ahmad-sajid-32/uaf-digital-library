import "client-only";

/**
 * Admin metrics API client for the admin dashboard module.
 *
 * Purpose:
 * - Centralize authenticated dashboard reads for the admin overview screen.
 * - Normalize the backend metrics contract into one frontend-safe shape.
 * - Preserve backend error messages so the dashboard can show truthful
 *   loading, error, and retry states.
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

export class MetricsApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "MetricsApiError";
    this.status = status;
  }
}

export function isMetricsApiError(error: unknown): error is MetricsApiError {
  return error instanceof MetricsApiError;
}

export interface PopularBookMetricItem {
  bookId: string;
  title: string;
  borrowCount: number;
}

export interface QueuePressureMetricItem {
  bookId: string;
  title: string;
  waitingCount: number;
}

export interface AdminDashboardMetrics {
  activeBorrowCount: number;
  overdueCount: number;
  totalPendingFines: number;
  popularBooks: PopularBookMetricItem[];
  queuePressure: QueuePressureMetricItem[];
}

export type AdminDashboardMetricsResponse =
  BackendSuccessEnvelope<AdminDashboardMetrics>;

export interface GetAdminDashboardMetricsOptions {
  popularLimit?: number;
  queueLimit?: number;
  signal?: AbortSignal;
}

interface BackendPopularBookMetricItem {
  book_id: string;
  title: string;
  borrow_count: number;
}

interface BackendQueuePressureMetricItem {
  book_id: string;
  title: string;
  waiting_count: number;
}

interface BackendAdminDashboardMetrics {
  active_borrow_count: number;
  overdue_count: number;
  total_pending_fines: number | string;
  popular_books: BackendPopularBookMetricItem[];
  queue_pressure: BackendQueuePressureMetricItem[];
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  signal?: AbortSignal;
};

function throwIfRequestAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  const error = new Error("The request was aborted.");
  error.name = "AbortError";
  throw error;
}

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

async function metricsApiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<BackendSuccessEnvelope<TData>> {
  throwIfRequestAborted(options.signal);
  const accessToken = await getAccessToken();
  throwIfRequestAborted(options.signal);
  const headers = new Headers(options.headers);
  const baseUrl = getApiBaseUrl();

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  throwIfRequestAborted(options.signal);
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

    throw new MetricsApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

function normalizeCurrencyLikeValue(value: number | string): number {
  const normalizedValue =
    typeof value === "number" ? value : Number.parseFloat(value);

  return Number.isFinite(normalizedValue) ? normalizedValue : 0;
}

function normalizeMetricsData(
  data: BackendAdminDashboardMetrics,
): AdminDashboardMetrics {
  return {
    activeBorrowCount: data.active_borrow_count,
    overdueCount: data.overdue_count,
    totalPendingFines: normalizeCurrencyLikeValue(data.total_pending_fines),
    popularBooks: data.popular_books.map((item) => ({
      bookId: item.book_id,
      title: item.title,
      borrowCount: item.borrow_count,
    })),
    queuePressure: data.queue_pressure.map((item) => ({
      bookId: item.book_id,
      title: item.title,
      waitingCount: item.waiting_count,
    })),
  };
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
  const response = await metricsApiRequest<BackendAdminDashboardMetrics>(
    `/api/admin/metrics/dashboard${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );

  return {
    ...response,
    data: normalizeMetricsData(response.data),
  };
}
