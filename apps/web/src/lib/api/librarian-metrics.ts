import "client-only";

// apps/web/src/lib/api/librarian-metrics.ts
/**
 * Librarian metrics API client for the operational dashboard module.
 *
 * Purpose:
 * - Centralize authenticated dashboard reads for the librarian operational
 *   overview.
 * - Keep the librarian metrics contract separate from the admin metrics API
 *   boundary.
 * - Preserve backend error messages so the dashboard can render truthful
 *   loading, retry, and stale-data states.
 */

import type { DocumentProcessingStatus } from "@/lib/api/documents";
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

export class LibrarianMetricsApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LibrarianMetricsApiError";
    this.status = status;
  }
}

export function isLibrarianMetricsApiError(
  error: unknown,
): error is LibrarianMetricsApiError {
  return error instanceof LibrarianMetricsApiError;
}

export interface QueueHotspotMetricItem {
  bookId: string;
  title: string;
  waitingCount: number;
}

export interface PopularBookMetricItem {
  bookId: string;
  title: string;
  borrowCount: number;
}

export interface DocumentAttentionMetricItem {
  documentId: string;
  title: string;
  processingStatus: DocumentProcessingStatus;
  canFinalize: boolean;
  canRetryFinalize: boolean;
  requiresReupload: boolean;
  lifecycleNote: string;
}

export interface LibrarianDashboardMetrics {
  activeLoanCount: number;
  overdueLoanCount: number;
  pendingFineCount: number;
  documentsRequiringActionCount: number;
  queueHotspots: QueueHotspotMetricItem[];
  documentAttention: DocumentAttentionMetricItem[];
  popularBooks: PopularBookMetricItem[];
}

export type LibrarianDashboardMetricsResponse =
  BackendSuccessEnvelope<LibrarianDashboardMetrics>;

interface BackendQueueHotspotMetricItem {
  book_id: string;
  title: string;
  waiting_count: number;
}

interface BackendPopularBookMetricItem {
  book_id: string;
  title: string;
  borrow_count: number;
}

interface BackendDocumentAttentionMetricItem {
  document_id: string;
  title: string;
  processing_status: DocumentProcessingStatus;
  can_finalize: boolean;
  can_retry_finalize: boolean;
  requires_reupload: boolean;
  lifecycle_note: string;
}

interface BackendLibrarianDashboardMetrics {
  active_loan_count: number;
  overdue_loan_count: number;
  pending_fine_count: number;
  documents_requiring_action_count: number;
  queue_hotspots: BackendQueueHotspotMetricItem[];
  document_attention: BackendDocumentAttentionMetricItem[];
  popular_books: BackendPopularBookMetricItem[];
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

async function librarianMetricsApiRequest<TData>(
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

    throw new LibrarianMetricsApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

function normalizeMetricsData(
  data: BackendLibrarianDashboardMetrics,
): LibrarianDashboardMetrics {
  return {
    activeLoanCount: data.active_loan_count,
    overdueLoanCount: data.overdue_loan_count,
    pendingFineCount: data.pending_fine_count,
    documentsRequiringActionCount: data.documents_requiring_action_count,
    queueHotspots: data.queue_hotspots.map((item) => ({
      bookId: item.book_id,
      title: item.title,
      waitingCount: item.waiting_count,
    })),
    documentAttention: data.document_attention.map((item) => ({
      documentId: item.document_id,
      title: item.title,
      processingStatus: item.processing_status,
      canFinalize: item.can_finalize,
      canRetryFinalize: item.can_retry_finalize,
      requiresReupload: item.requires_reupload,
      lifecycleNote: item.lifecycle_note,
    })),
    popularBooks: data.popular_books.map((item) => ({
      bookId: item.book_id,
      title: item.title,
      borrowCount: item.borrow_count,
    })),
  };
}

export async function getLibrarianDashboardMetrics(
  options: { signal?: AbortSignal } = {},
): Promise<LibrarianDashboardMetricsResponse> {
  const response = await librarianMetricsApiRequest<BackendLibrarianDashboardMetrics>(
    "/api/librarian/metrics/dashboard",
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
