import "client-only";

// apps/web/src/lib/api/assistant.ts
/**
 * Assistant API client for the UAF Smart E-Library frontend.
 *
 * Purpose:
 * - Centralize authenticated requests for the shared assistant module.
 * - Mirror the persisted conversation/message backend contract without
 *   exposing retrieval controls in the frontend request surface.
 * - Preserve backend error messages from the normalized JSON envelope.
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

export class AssistantApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AssistantApiError";
    this.status = status;
  }
}

export function isAssistantApiError(error: unknown): error is AssistantApiError {
  return error instanceof AssistantApiError;
}

export type AssistantMessageRole = "user" | "assistant";

export interface AssistantCitationItem {
  document_id: string | null;
  document_title: string;
  original_filename: string;
  chunk_id: string | null;
  chunk_index: number;
  section_label: string | null;
  page_number: number | null;
  similarity_score: number;
  rank: number;
}

export interface AssistantMessageItem {
  id: string;
  role: AssistantMessageRole;
  content: string;
  intent_profile: string | null;
  fallback_used: boolean | null;
  retrieved_chunks_count: number | null;
  created_at: string;
  citations: AssistantCitationItem[];
}

export interface AssistantConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message_preview: string | null;
}

export interface AssistantConversationListData {
  items: AssistantConversationItem[];
}

export interface AssistantConversationData {
  conversation: AssistantConversationItem;
}

export interface AssistantConversationMessagesData {
  conversation_id: string;
  items: AssistantMessageItem[];
}

export interface AssistantTurnData {
  conversation: AssistantConversationItem;
  user_message: AssistantMessageItem;
  assistant_message: AssistantMessageItem;
}

export interface AssistantAskPayload {
  query: string;
}

export interface AssistantRenameConversationPayload {
  title: string;
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

async function assistantApiRequest<TData>(
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
      payload?.message
      || `Request failed with status ${response.status}. Please try again.`;

    if (response.status === 401) {
      throw new SessionExpiredError(message);
    }

    throw new AssistantApiError(response.status, message);
  }

  if (!payload) {
    throw new Error("Backend returned an invalid JSON response.");
  }

  return payload as BackendSuccessEnvelope<TData>;
}

export async function getAssistantConversations(
  options: { signal?: AbortSignal } = {},
): Promise<BackendSuccessEnvelope<AssistantConversationListData>> {
  return assistantApiRequest<AssistantConversationListData>(
    "/api/ai/conversations",
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function createAssistantConversation(
  payload: AssistantAskPayload,
): Promise<BackendSuccessEnvelope<AssistantTurnData>> {
  return assistantApiRequest<AssistantTurnData>("/api/ai/conversations", {
    method: "POST",
    body: payload,
  });
}

export async function getAssistantConversation(
  conversationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<BackendSuccessEnvelope<AssistantConversationData>> {
  return assistantApiRequest<AssistantConversationData>(
    `/api/ai/conversations/${conversationId}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function getAssistantMessages(
  conversationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<BackendSuccessEnvelope<AssistantConversationMessagesData>> {
  return assistantApiRequest<AssistantConversationMessagesData>(
    `/api/ai/conversations/${conversationId}/messages`,
    {
      method: "GET",
      signal: options.signal,
    },
  );
}

export async function appendAssistantMessage(
  conversationId: string,
  payload: AssistantAskPayload,
): Promise<BackendSuccessEnvelope<AssistantTurnData>> {
  return assistantApiRequest<AssistantTurnData>(
    `/api/ai/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function renameAssistantConversation(
  conversationId: string,
  payload: AssistantRenameConversationPayload,
): Promise<BackendSuccessEnvelope<AssistantConversationData>> {
  return assistantApiRequest<AssistantConversationData>(
    `/api/ai/conversations/${conversationId}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function deleteAssistantConversation(
  conversationId: string,
): Promise<BackendSuccessEnvelope<Record<string, never>>> {
  return assistantApiRequest<Record<string, never>>(
    `/api/ai/conversations/${conversationId}`,
    {
      method: "DELETE",
    },
  );
}
