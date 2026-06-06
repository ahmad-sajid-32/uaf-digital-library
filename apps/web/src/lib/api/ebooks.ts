import "client-only";

import { SessionExpiredError } from "@/lib/auth/session-errors";
import { getSupabaseBrowserClient, readSupabaseBrowserSession } from "@/lib/supabase/client";
import type { EBook, EBookAccessEventType, EBookAccessScope, EBookCategory, EBookFormat } from "@/lib/ebooks";

export interface PageData<T> { items: T[]; total: number; limit: number; offset: number }
export interface Envelope<T> { status: number; message: string; data: T; timestamp_ms: number }
export interface UploadInput {
  title: string; authors: string; category: EBookCategory; file: File; fileFormat: EBookFormat;
}
export interface UpdateInput {
  title: string; subtitle?: string | null; authors: string; description?: string | null;
  isbn?: string | null; publisher?: string | null; publication_year?: number | null;
  edition?: string | null; language: string; category: EBookCategory; keywords: string[];
  linked_book_id?: string | null; access_scope: EBookAccessScope; allow_preview: boolean; allow_download: boolean;
}
export interface AccessEvent { id: string; ebook_id: string; user_id?: string | null; user_name?: string | null; event_type: EBookAccessEventType; created_at: string }

async function token(): Promise<string> {
  const { session } = await readSupabaseBrowserSession();
  if (!session?.access_token) throw new SessionExpiredError();
  return session.access_token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await token()}`);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE_URL.");
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok) {
    if (response.status === 401) throw new SessionExpiredError(payload?.message);
    throw new Error(payload?.message || "E-Book request failed.");
  }
  if (!payload) throw new Error("Backend returned an invalid response.");
  return payload.data;
}

async function allPages(path: string): Promise<EBook[]> {
  const items: EBook[] = [];
  let offset = 0;
  while (true) {
    const page = await api<PageData<EBook>>(`${path}?limit=100&offset=${offset}`);
    items.push(...page.items);
    offset += page.items.length;
    if (offset >= page.total || page.items.length === 0) return items;
  }
}

export const getStaffEBooks = () => allPages("/api/admin/ebooks");
export const getStudentEBooks = () => allPages("/api/ebooks");
export const getEBookEvents = (id: string) => api<PageData<AccessEvent>>(`/api/admin/ebooks/${id}/access-events?limit=100&offset=0`);
export const updateEBook = (id: string, value: UpdateInput) => api<EBook>(`/api/admin/ebooks/${id}`, { method: "PATCH", body: JSON.stringify(value) });
export const finalizeEBook = (id: string) => api<EBook>(`/api/admin/ebooks/${id}/finalize`, { method: "POST" });
export const publishEBook = (id: string) => api<EBook>(`/api/admin/ebooks/${id}/publish`, { method: "POST" });
export const archiveEBook = (id: string) => api<EBook>(`/api/admin/ebooks/${id}/archive`, { method: "POST" });
export const deleteEBook = (id: string) => api<Record<string, never>>(`/api/admin/ebooks/${id}`, { method: "DELETE" });
export const accessEBook = (id: string, type: EBookAccessEventType, staff = false) =>
  api<{ url: string; event_type: EBookAccessEventType; expires_in_seconds: number }>(
    `${staff ? "/api/admin" : "/api"}/ebooks/${id}/access-url`,
    { method: "POST", body: JSON.stringify({ event_type: type }) },
  );

export async function uploadEBook(input: UploadInput): Promise<EBook> {
  const intent = await api<{
    ebook_id: string; bucket_name: string; storage_object_path: string; upload_token: string | null;
  }>("/api/admin/ebooks/upload-url", {
    method: "POST",
    body: JSON.stringify({
      title: input.title, authors: input.authors, category: input.category,
      filename: input.file.name, file_format: input.fileFormat,
      mime_type: input.file.type, file_size_bytes: input.file.size,
    }),
  });
  if (!intent.upload_token) throw new Error("Upload token is missing.");
  const { error } = await getSupabaseBrowserClient().storage
    .from(intent.bucket_name)
    .uploadToSignedUrl(intent.storage_object_path, intent.upload_token, await input.file.arrayBuffer(), {
      contentType: input.file.type,
    });
  if (error) throw new Error(error.message);
  return finalizeEBook(intent.ebook_id);
}

export async function setEBookCover(id: string, file: File, altText?: string): Promise<EBook> {
  const body = new FormData();
  body.set("file", file);
  if (altText) body.set("alt_text", altText);
  return api<EBook>(`/api/admin/ebooks/${id}/cover`, { method: "POST", body });
}

export const clearEBookCover = (id: string) =>
  api<Record<string, never>>(`/api/admin/ebooks/${id}/cover`, { method: "DELETE" });
