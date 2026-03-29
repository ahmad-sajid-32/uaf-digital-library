import "client-only";

// apps/web/src/lib/api/documents.ts
/**
 * Document-management API client for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Centralize authenticated requests for the staff document-management module.
 * - Mirror the current backend contract for upload-intent creation, finalize,
 *   list/detail reads, signed read URL issuance, and document deletion.
 * - Preserve backend error messages from the standardized JSON envelope so UI
 *   components can render truthful feedback.
 *
 * Important:
 * - This module does not implement business logic.
 * - Authorization remains backend-owned through JWT verification and backend
 *   document-manager checks.
 * - The frontend only attaches the current Supabase access token and reads the
 *   backend response contract.
 */

import { SessionExpiredError } from "@/lib/auth/session-errors";
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

export interface BackendErrorEnvelope {
  status: number;
  message: string;
  data: Record<string, never>;
  timestamp_ms: number;
}

export class DocumentsApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DocumentsApiError";
    this.status = status;
  }
}

export function isDocumentsApiError(error: unknown): error is DocumentsApiError {
  return error instanceof DocumentsApiError;
}

export type DocumentProcessingStatus =
  | "uploaded"
  | "processing"
  | "indexed"
  | "failed";

export type DocumentReadDisposition = "inline" | "attachment";

export interface CreateDocumentUploadUrlPayload {
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  title?: string | null;
  document_type?: string | null;
  audience_scope?: string | null;
  department?: string | null;
}

export interface DocumentUploadUrlData {
  document_id: string;
  bucket_name: string;
  storage_object_path: string;
  signed_upload_url: string;
  upload_token: string | null;
  processing_status: DocumentProcessingStatus;
}

export interface FinalizeDocumentData {
  document_id: string;
  processing_status: DocumentProcessingStatus;
  is_upload_stale: boolean;
  can_finalize: boolean;
  can_retry_finalize: boolean;
  requires_reupload: boolean;
}

export interface DocumentListItem {
  id: string;
  title: string;
  original_filename: string;
  bucket_name: string;
  storage_object_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  processing_status: DocumentProcessingStatus;
  indexing_error: string | null;
  is_active: boolean;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
  is_upload_stale: boolean;
  can_finalize: boolean;
  can_retry_finalize: boolean;
  requires_reupload: boolean;
  lifecycle_note: string;
}

export interface DocumentDetailItem extends DocumentListItem {
  checksum_sha256: string | null;
  document_type: string | null;
  audience_scope: string | null;
  department: string | null;
  file_path: string;
}

export interface DocumentsListData {
  items: DocumentListItem[];
}

export interface DocumentDetailData {
  item: DocumentDetailItem;
}

export interface DocumentSignedReadUrlData {
  document_id: string;
  signed_read_url: string;
  expires_in_seconds: number;
  disposition: DocumentReadDisposition;
}

export interface UploadDocumentToSignedUrlInput {
  bucketName: string;
  storageObjectPath: string;
  uploadToken: string | null;
  file: File;
}

export type CreateDocumentUploadUrlResponse =
  BackendSuccessEnvelope<DocumentUploadUrlData>;
export type FinalizeDocumentResponse =
  BackendSuccessEnvelope<FinalizeDocumentData>;
export type DocumentsListResponse = BackendSuccessEnvelope<DocumentsListData>;
export type DocumentDetailResponse = BackendSuccessEnvelope<DocumentDetailData>;
export type DocumentSignedReadUrlResponse =
  BackendSuccessEnvelope<DocumentSignedReadUrlData>;
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

async function documentsApiRequest<TData>(
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

    throw new DocumentsApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function createDocumentUploadUrl(
  payload: CreateDocumentUploadUrlPayload,
): Promise<CreateDocumentUploadUrlResponse> {
  return documentsApiRequest<DocumentUploadUrlData>(
    "/api/admin/documents/upload-url",
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function finalizeDocument(
  documentId: string,
): Promise<FinalizeDocumentResponse> {
  return documentsApiRequest<FinalizeDocumentData>(
    `/api/admin/documents/${documentId}/finalize`,
    {
      method: "POST",
    },
  );
}

export async function getDocuments(
  options: { signal?: AbortSignal } = {},
): Promise<DocumentsListResponse> {
  return documentsApiRequest<DocumentsListData>("/api/admin/documents", {
    method: "GET",
    signal: options.signal,
  });
}

export async function getAllDocuments(
  options: { signal?: AbortSignal } = {},
): Promise<DocumentsListResponse> {
  return getDocuments(options);
}

export async function getDocumentById(
  documentId: string,
  options: { signal?: AbortSignal } = {},
): Promise<DocumentDetailResponse> {
  return documentsApiRequest<DocumentDetailData>(
    `/api/admin/documents/${documentId}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function getDocumentReadUrl(
  documentId: string,
  disposition: DocumentReadDisposition = "inline",
  options: { signal?: AbortSignal } = {},
): Promise<DocumentSignedReadUrlResponse> {
  const searchParams = new URLSearchParams({ disposition });

  return documentsApiRequest<DocumentSignedReadUrlData>(
    `/api/admin/documents/${documentId}/read-url?${searchParams.toString()}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function deleteDocument(
  documentId: string,
): Promise<EmptySuccessResponse> {
  return documentsApiRequest<Record<string, never>>(
    `/api/admin/documents/${documentId}`,
    {
      method: "DELETE",
    },
  );
}

export async function uploadDocumentToSignedUrl(
  input: UploadDocumentToSignedUrlInput,
): Promise<void> {
  if (!input.uploadToken) {
    throw new Error("Upload token is missing for this document upload.");
  }

  const supabase = getSupabaseBrowserClient();
  const fileBytes = await input.file.arrayBuffer();
  const { error } = await supabase.storage
    .from(input.bucketName)
    .uploadToSignedUrl(
      input.storageObjectPath,
      input.uploadToken,
      fileBytes,
      {
        cacheControl: "3600",
        contentType: input.file.type || undefined,
      },
    );

  if (error) {
    throw new Error(error.message || "Unable to upload the selected file.");
  }
}
