"use client";

// apps/web/src/hooks/useDocuments.ts
/**
 * Unified document-management module hook/state boundary.
 *
 * Purpose:
 * - Keep the staff document-management module hook logic in one file, matching
 *   the locked frontend convention for module-scoped hook ownership.
 * - Centralize one cached document directory, local refinement, document-detail
 *   cache state, upload-intent creation, signed read URL resolution, finalize
 *   mutation, and delete mutation without pushing orchestration into screens.
 *
 * Important:
 * - This module does not invent backend behavior.
 * - The document directory follows the locked cached-directory flow for this
 *   phase: load the full directory once, cache it, and derive search, status,
 *   metadata filters, and pagination locally.
 * - Mutation success refreshes the shared directory and any loaded detail for
 *   the affected document so UI state cannot drift from backend truth.
 */

import * as React from "react";
import { toast } from "sonner";

import {
  createDocumentUploadUrl,
  deleteDocument as deleteDocumentRequest,
  finalizeDocument as finalizeDocumentRequest,
  getAllDocuments,
  getDocumentById,
  getDocumentReadUrl,
  isDocumentsApiError,
  type CreateDocumentUploadUrlPayload,
  type DocumentDetailItem,
  type DocumentListItem,
  type DocumentProcessingStatus,
  type DocumentReadDisposition,
  type DocumentSignedReadUrlData,
  type DocumentUploadUrlData,
  uploadDocumentToSignedUrl,
} from "@/lib/api/documents";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";

export type DocumentsListStatus = "idle" | "loading" | "success" | "error";
export type DocumentStatusFilter = DocumentProcessingStatus | "all";
export const DOCUMENTS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type DocumentsPageSize = (typeof DOCUMENTS_PAGE_SIZE_OPTIONS)[number];

export interface DocumentsListFilters {
  searchTerm: string;
  status: DocumentStatusFilter;
  documentType: string;
  audienceScope: string;
  department: string;
  page: number;
  pageSize: number;
}

export interface UploadDocumentWorkflowInput {
  file: File;
  title?: string | null;
  documentType?: string | null;
  audienceScope?: string | null;
  department?: string | null;
}

interface DocumentsListCacheSnapshot {
  queryKey: string;
  status: DocumentsListStatus;
  refreshing: boolean;
  invalidated: boolean;
  items: DocumentListItem[];
  total: number;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface DocumentDetailCacheSnapshot {
  queryKey: string;
  documentId: string;
  status: DocumentsListStatus;
  refreshing: boolean;
  invalidated: boolean;
  item: DocumentDetailItem | null;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface MutationErrorOptions {
  fallbackMessage: string;
  toastId: string;
}

const DOCUMENTS_QUERY_KEYS = {
  list: "documents:list",
  detail: (documentId: string) => `documents:detail:${documentId}`,
} as const;

const DEFAULT_DOCUMENTS_FILTERS: DocumentsListFilters = {
  searchTerm: "",
  status: "all",
  documentType: "all",
  audienceScope: "all",
  department: "all",
  page: 1,
  pageSize: 10,
};

const listListeners = new Set<() => void>();
const detailListeners = new Map<string, Set<() => void>>();
const detailSnapshots = new Map<string, DocumentDetailCacheSnapshot>();
const detailRequestVersions = new Map<string, number>();

let listRequestVersion = 0;
let listSnapshot: DocumentsListCacheSnapshot = {
  queryKey: DOCUMENTS_QUERY_KEYS.list,
  status: "idle",
  refreshing: false,
  invalidated: false,
  items: [],
  total: 0,
  fetchedAt: null,
  error: null,
  errorStatus: null,
};

function emitListSnapshot(): void {
  listListeners.forEach((listener) => {
    listener();
  });
}

function emitDetailSnapshot(documentId: string): void {
  detailListeners.get(documentId)?.forEach((listener) => {
    listener();
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function isAbortError(error: unknown): boolean {
  return Boolean(error instanceof Error && error.name === "AbortError");
}

function normalizeDocumentsPageSize(value: number): DocumentsPageSize {
  if (
    DOCUMENTS_PAGE_SIZE_OPTIONS.includes(value as DocumentsPageSize)
  ) {
    return value as DocumentsPageSize;
  }

  return 10;
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeFacetValue(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "all";
}

function ensureDetailSnapshot(documentId: string): DocumentDetailCacheSnapshot {
  const existing = detailSnapshots.get(documentId);

  if (existing) {
    return existing;
  }

  const created: DocumentDetailCacheSnapshot = {
    queryKey: DOCUMENTS_QUERY_KEYS.detail(documentId),
    documentId,
    status: "idle",
    refreshing: false,
    invalidated: false,
    item: null,
    fetchedAt: null,
    error: null,
    errorStatus: null,
  };
  detailSnapshots.set(documentId, created);
  return created;
}

function setDetailSnapshot(snapshot: DocumentDetailCacheSnapshot): void {
  detailSnapshots.set(snapshot.documentId, snapshot);
  emitDetailSnapshot(snapshot.documentId);
}

function subscribeDocumentsListStore(listener: () => void): () => void {
  listListeners.add(listener);

  return () => {
    listListeners.delete(listener);
  };
}

function getDocumentsListSnapshot(): DocumentsListCacheSnapshot {
  return listSnapshot;
}

function subscribeDocumentDetailStore(
  documentId: string,
  listener: () => void,
): () => void {
  const listeners = detailListeners.get(documentId) ?? new Set<() => void>();
  listeners.add(listener);
  detailListeners.set(documentId, listeners);

  return () => {
    const currentListeners = detailListeners.get(documentId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      detailListeners.delete(documentId);
    }
  };
}

function getDocumentDetailSnapshot(documentId: string): DocumentDetailCacheSnapshot {
  return ensureDetailSnapshot(documentId);
}

function invalidateDocumentsListCache(): void {
  listSnapshot = {
    ...listSnapshot,
    invalidated: true,
  };
  emitListSnapshot();
}

function invalidateDocumentDetailCache(documentId: string): void {
  const snapshot = ensureDetailSnapshot(documentId);
  setDetailSnapshot({
    ...snapshot,
    invalidated: true,
  });
}

function clearDocumentDetailCache(documentId: string): void {
  detailSnapshots.delete(documentId);
  detailRequestVersions.delete(documentId);
  emitDetailSnapshot(documentId);
}

function removeDocumentFromListCache(documentId: string): void {
  const nextItems = listSnapshot.items.filter((item) => item.id !== documentId);

  listSnapshot = {
    ...listSnapshot,
    items: nextItems,
    total: nextItems.length,
  };
  emitListSnapshot();
}

function toDocumentListShape(item: DocumentDetailItem): DocumentListItem {
  return {
    id: item.id,
    title: item.title,
    original_filename: item.original_filename,
    bucket_name: item.bucket_name,
    storage_object_path: item.storage_object_path,
    mime_type: item.mime_type,
    file_size_bytes: item.file_size_bytes,
    processing_status: item.processing_status,
    indexing_error: item.indexing_error,
    is_active: item.is_active,
    uploaded_by: item.uploaded_by,
    uploaded_by_name: item.uploaded_by_name,
    created_at: item.created_at,
    updated_at: item.updated_at,
    is_upload_stale: item.is_upload_stale,
    can_finalize: item.can_finalize,
    can_retry_finalize: item.can_retry_finalize,
    requires_reupload: item.requires_reupload,
    lifecycle_note: item.lifecycle_note,
  };
}

function upsertDocumentListItem(item: DocumentListItem): void {
  if (listSnapshot.status === "idle") {
    return;
  }

  const existingIndex = listSnapshot.items.findIndex(
    (currentItem) => currentItem.id === item.id,
  );
  const nextItems = [...listSnapshot.items];

  if (existingIndex >= 0) {
    nextItems[existingIndex] = item;
  } else {
    nextItems.unshift(item);
  }

  listSnapshot = {
    ...listSnapshot,
    items: nextItems,
    total: nextItems.length,
  };
  emitListSnapshot();
}

async function refreshDocumentsListStore(
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<DocumentsListCacheSnapshot> {
  const hasLoadedData = listSnapshot.items.length > 0;

  if (listSnapshot.status === "loading" && !options.force) {
    return listSnapshot;
  }

  if (
    hasLoadedData
    && !listSnapshot.invalidated
    && !listSnapshot.error
    && !options.force
  ) {
    return listSnapshot;
  }

  const requestVersion = ++listRequestVersion;
  listSnapshot = {
    ...listSnapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  };
  emitListSnapshot();

  try {
    const response = await getAllDocuments({
      signal: options.signal,
    });

    if (requestVersion !== listRequestVersion) {
      return listSnapshot;
    }

    listSnapshot = {
      queryKey: DOCUMENTS_QUERY_KEYS.list,
      status: "success",
      refreshing: false,
      invalidated: false,
      items: response.data.items,
      total: response.data.items.length,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };
    emitListSnapshot();
    return listSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return listSnapshot;
    }

    if (requestVersion !== listRequestVersion) {
      return listSnapshot;
    }

    listSnapshot = {
      ...listSnapshot,
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(error, "Unable to load documents right now."),
      errorStatus: isDocumentsApiError(error) ? error.status : null,
    };
    emitListSnapshot();
    throw error;
  }
}

async function refreshDocumentDetailStore(
  documentId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<DocumentDetailCacheSnapshot> {
  const currentSnapshot = ensureDetailSnapshot(documentId);
  const hasLoadedData = Boolean(currentSnapshot.item);

  if (currentSnapshot.status === "loading" && !options.force) {
    return currentSnapshot;
  }

  if (
    hasLoadedData
    && !currentSnapshot.invalidated
    && !currentSnapshot.error
    && !options.force
  ) {
    return currentSnapshot;
  }

  const requestVersion = (detailRequestVersions.get(documentId) ?? 0) + 1;
  detailRequestVersions.set(documentId, requestVersion);
  setDetailSnapshot({
    ...currentSnapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getDocumentById(documentId, {
      signal: options.signal,
    });

    if (detailRequestVersions.get(documentId) !== requestVersion) {
      return detailSnapshots.get(documentId) ?? currentSnapshot;
    }

    const nextSnapshot: DocumentDetailCacheSnapshot = {
      queryKey: DOCUMENTS_QUERY_KEYS.detail(documentId),
      documentId,
      status: "success",
      refreshing: false,
      invalidated: false,
      item: response.data.item,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };
    setDetailSnapshot(nextSnapshot);
    upsertDocumentListItem(toDocumentListShape(response.data.item));
    return nextSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return detailSnapshots.get(documentId) ?? currentSnapshot;
    }

    if (detailRequestVersions.get(documentId) !== requestVersion) {
      return detailSnapshots.get(documentId) ?? currentSnapshot;
    }

    const failedSnapshot: DocumentDetailCacheSnapshot = {
      ...currentSnapshot,
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(error, "Unable to load that document right now."),
      errorStatus: isDocumentsApiError(error) ? error.status : null,
    };
    setDetailSnapshot(failedSnapshot);
    throw error;
  }
}

async function refreshDocumentModuleStoresAfterMutation(
  documentId: string,
): Promise<void> {
  invalidateDocumentsListCache();
  const hasLoadedDetailSnapshot = detailSnapshots.has(documentId);

  if (hasLoadedDetailSnapshot) {
    invalidateDocumentDetailCache(documentId);
  }

  await Promise.allSettled([
    ...(listSnapshot.fetchedAt !== null
      ? [
          refreshDocumentsListStore({
            force: true,
          }),
        ]
      : []),
    ...(hasLoadedDetailSnapshot
      ? [
          refreshDocumentDetailStore(documentId, {
            force: true,
          }),
        ]
      : []),
  ]);
}

function useDocumentsMutationFeedback() {
  const { recoverFromSessionFailure } = useAuthSessionActions();

  const reportMutationError = React.useCallback(
    async (
      error: unknown,
      options: MutationErrorOptions,
    ): Promise<string> => {
      const recovered = await recoverFromSessionFailure(error, {
        toastId: `${options.toastId}-session`,
      });

      const message = getErrorMessage(error, options.fallbackMessage);

      if (!recovered) {
        toast.error(message, {
          id: options.toastId,
        });
      }

      return message;
    },
    [recoverFromSessionFailure],
  );

  return {
    reportMutationError,
  };
}

export function useDocumentsList(options: {
  autoLoad?: boolean;
  initialFilters?: Partial<DocumentsListFilters>;
} = {}) {
  const snapshot = React.useSyncExternalStore(
    subscribeDocumentsListStore,
    getDocumentsListSnapshot,
    getDocumentsListSnapshot,
  );
  const [filters, setFilters] = React.useState<DocumentsListFilters>({
    ...DEFAULT_DOCUMENTS_FILTERS,
    ...options.initialFilters,
    page: Math.max(1, options.initialFilters?.page ?? DEFAULT_DOCUMENTS_FILTERS.page),
    pageSize: normalizeDocumentsPageSize(
      options.initialFilters?.pageSize ?? DEFAULT_DOCUMENTS_FILTERS.pageSize,
    ),
    documentType: normalizeFacetValue(
      options.initialFilters?.documentType ?? DEFAULT_DOCUMENTS_FILTERS.documentType,
    ),
    audienceScope: normalizeFacetValue(
      options.initialFilters?.audienceScope
        ?? DEFAULT_DOCUMENTS_FILTERS.audienceScope,
    ),
    department: normalizeFacetValue(
      options.initialFilters?.department ?? DEFAULT_DOCUMENTS_FILTERS.department,
    ),
  });
  const isInitialAutoLoad =
    Boolean(options.autoLoad)
    && snapshot.status === "idle"
    && snapshot.items.length === 0
    && snapshot.error === null;

  React.useEffect(() => {
    if (!options.autoLoad) {
      return;
    }

    void refreshDocumentsListStore().catch(() => {
      // Errors are exposed through the shared snapshot for page-level handling.
    });
  }, [options.autoLoad]);

  const normalizedSearchTerm = normalizeSearchTerm(filters.searchTerm);
  const filteredItems = snapshot.items.filter((item) => {
    const matchesStatus =
      filters.status === "all" || item.processing_status === filters.status;
    const matchesDocumentType =
      filters.documentType === "all"
      || (item as Partial<DocumentDetailItem>).document_type === filters.documentType;
    const matchesAudienceScope =
      filters.audienceScope === "all"
      || (item as Partial<DocumentDetailItem>).audience_scope === filters.audienceScope;
    const matchesDepartment =
      filters.department === "all"
      || (item as Partial<DocumentDetailItem>).department === filters.department;
    const searchHaystack = [
      item.title,
      item.original_filename,
      item.mime_type ?? "",
      item.processing_status,
      item.indexing_error ?? "",
      item.lifecycle_note,
      (item as Partial<DocumentDetailItem>).document_type ?? "",
      (item as Partial<DocumentDetailItem>).audience_scope ?? "",
      (item as Partial<DocumentDetailItem>).department ?? "",
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      normalizedSearchTerm.length === 0
        ? true
        : searchHaystack.includes(normalizedSearchTerm);

    return (
      matchesStatus
      && matchesDocumentType
      && matchesAudienceScope
      && matchesDepartment
      && matchesSearch
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pageStart = (currentPage - 1) * filters.pageSize;
  const pageItems = filteredItems.slice(pageStart, pageStart + filters.pageSize);
  const hasAppliedFilters =
    normalizedSearchTerm.length > 0
    || filters.status !== "all"
    || filters.documentType !== "all"
    || filters.audienceScope !== "all"
    || filters.department !== "all";
  const documentTypeOptions = Array.from(
    new Set(
      snapshot.items
        .map((item) => (item as Partial<DocumentDetailItem>).document_type ?? "")
        .filter((value) => value.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const audienceScopeOptions = Array.from(
    new Set(
      snapshot.items
        .map((item) => (item as Partial<DocumentDetailItem>).audience_scope ?? "")
        .filter((value) => value.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const departmentOptions = Array.from(
    new Set(
      snapshot.items
        .map((item) => (item as Partial<DocumentDetailItem>).department ?? "")
        .filter((value) => value.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const updateFilters = React.useCallback(
    (next: Partial<DocumentsListFilters>) => {
      setFilters((current) => ({
        ...current,
        ...next,
        page:
          next.page !== undefined
            ? Math.max(1, next.page)
            : next.pageSize !== undefined
              || next.searchTerm !== undefined
              || next.status !== undefined
              || next.documentType !== undefined
              || next.audienceScope !== undefined
              || next.department !== undefined
              ? 1
              : current.page,
        pageSize:
          next.pageSize !== undefined
            ? normalizeDocumentsPageSize(next.pageSize)
            : current.pageSize,
        documentType:
          next.documentType !== undefined
            ? normalizeFacetValue(next.documentType)
            : current.documentType,
        audienceScope:
          next.audienceScope !== undefined
            ? normalizeFacetValue(next.audienceScope)
            : current.audienceScope,
        department:
          next.department !== undefined
            ? normalizeFacetValue(next.department)
            : current.department,
      }));
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    try {
      await refreshDocumentsListStore({
        force: true,
      });
    } catch {
      // Shared snapshot state already stores the latest fetch error.
    }
  }, []);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  const invalidate = React.useCallback(() => {
    invalidateDocumentsListCache();
  }, []);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: snapshot.status === "loading" || isInitialAutoLoad,
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    items: pageItems,
    allItems: snapshot.items,
    filteredItems,
    totalLoadedItems: snapshot.items.length,
    filteredCount: filteredItems.length,
    totalCount: snapshot.total,
    totalPages,
    hasData: snapshot.items.length > 0,
    hasStaleData: snapshot.items.length > 0 && Boolean(snapshot.error),
    isEmpty: snapshot.status === "success" && filteredItems.length === 0,
    hasAppliedFilters,
    filters: {
      ...filters,
      page: currentPage,
    },
    setSearchTerm: (searchTerm: string) => {
      updateFilters({
        searchTerm,
      });
    },
    setStatusFilter: (status: DocumentStatusFilter) => {
      updateFilters({
        status,
      });
    },
    setDocumentTypeFilter: (documentType: string) => {
      updateFilters({
        documentType,
      });
    },
    setAudienceScopeFilter: (audienceScope: string) => {
      updateFilters({
        audienceScope,
      });
    },
    setDepartmentFilter: (department: string) => {
      updateFilters({
        department,
      });
    },
    setPage: (page: number) => {
      updateFilters({
        page,
      });
    },
    setPageSize: (pageSize: number) => {
      updateFilters({
        pageSize,
      });
    },
    resetFilters: () => {
      setFilters(DEFAULT_DOCUMENTS_FILTERS);
    },
    refresh,
    retry,
    invalidate,
    pageSizeOptions: DOCUMENTS_PAGE_SIZE_OPTIONS,
    documentTypeOptions,
    audienceScopeOptions,
    departmentOptions,
  };
}

export function useDocumentDetail(
  documentId: string | null,
  options: {
    autoLoad?: boolean;
  } = {},
) {
  const resolvedDocumentId = documentId ?? "__missing__";
  const subscribe = React.useCallback(
    (listener: () => void) =>
      subscribeDocumentDetailStore(resolvedDocumentId, listener),
    [resolvedDocumentId],
  );
  const getSnapshot = React.useCallback(
    () => getDocumentDetailSnapshot(resolvedDocumentId),
    [resolvedDocumentId],
  );
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  React.useEffect(() => {
    if (!options.autoLoad || !documentId) {
      return;
    }

    void refreshDocumentDetailStore(documentId).catch(() => {
      // The consuming screen reads the shared snapshot error state.
    });
  }, [documentId, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    if (!documentId) {
      return;
    }

    try {
      await refreshDocumentDetailStore(documentId, {
        force: true,
      });
    } catch {
      // Shared snapshot state already stores the latest fetch error.
    }
  }, [documentId]);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: Boolean(documentId) && snapshot.status === "loading",
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    item: documentId ? snapshot.item : null,
    hasData: Boolean(snapshot.item),
    hasStaleData: Boolean(snapshot.item && snapshot.error),
    refresh,
    retry,
  };
}

export function useCreateDocumentUploadIntent() {
  const { reportMutationError } = useDocumentsMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUploadIntent, setLastUploadIntent] =
    React.useState<DocumentUploadUrlData | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const createUploadIntent = React.useCallback(
    async (
      payload: CreateDocumentUploadUrlPayload,
    ): Promise<DocumentUploadUrlData | null> => {
      setPending(true);
      setError(null);

      try {
        const response = await createDocumentUploadUrl(payload);
        setLastUploadIntent(response.data);
        invalidateDocumentsListCache();

        if (listSnapshot.fetchedAt !== null) {
          await refreshDocumentsListStore({
            force: true,
          });
        }

        toast.success("Document upload URL generated successfully.", {
          id: `documents-upload-intent-${response.data.document_id}`,
        });
        return response.data;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to start that document upload right now.",
          toastId: "documents-upload-intent-error",
        });
        setError(message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [reportMutationError],
  );

  return {
    pending,
    error,
    lastUploadIntent,
    clearError,
    createUploadIntent,
  };
}

export function useDocumentUploadWorkflow() {
  const { reportMutationError } = useDocumentsMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [phase, setPhase] = React.useState<
    "idle" | "requesting_upload_url" | "uploading_file" | "finalizing"
  >("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [lastUploadedDocumentId, setLastUploadedDocumentId] = React.useState<
    string | null
  >(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const reset = React.useCallback(() => {
    setPending(false);
    setPhase("idle");
    setError(null);
  }, []);

  const uploadDocument = React.useCallback(
    async (input: UploadDocumentWorkflowInput): Promise<boolean> => {
      setPending(true);
      setPhase("requesting_upload_url");
      setError(null);

      const payload: CreateDocumentUploadUrlPayload = {
        filename: input.file.name,
        mime_type: input.file.type || "application/octet-stream",
        file_size_bytes: input.file.size,
        title: input.title?.trim() || null,
        document_type: input.documentType?.trim() || null,
        audience_scope: input.audienceScope?.trim() || null,
        department: input.department?.trim() || null,
      };

      let uploadIntent: DocumentUploadUrlData | null = null;

      try {
        const intentResponse = await createDocumentUploadUrl(payload);
        uploadIntent = intentResponse.data;
        setLastUploadedDocumentId(uploadIntent.document_id);
        invalidateDocumentsListCache();

        if (listSnapshot.fetchedAt !== null) {
          await refreshDocumentsListStore({
            force: true,
          });
        }
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to start that document upload right now.",
          toastId: "documents-upload-intent-error",
        });
        setError(message);
        setPending(false);
        setPhase("idle");
        return false;
      }

      try {
        setPhase("uploading_file");

        await uploadDocumentToSignedUrl({
          bucketName: uploadIntent.bucket_name,
          storageObjectPath: uploadIntent.storage_object_path,
          uploadToken: uploadIntent.upload_token,
          file: input.file,
        });
      } catch (uploadError: unknown) {
        const message = getErrorMessage(
          uploadError,
          "Unable to upload the selected file right now.",
        );

        setError(message);
        toast.error(message, {
          id: `documents-upload-file-${uploadIntent.document_id}-error`,
        });
        invalidateDocumentsListCache();

        if (listSnapshot.fetchedAt !== null) {
          await refreshDocumentsListStore({
            force: true,
          }).catch(() => {
            // Shared snapshot state stores any refresh failure.
          });
        }

        setPending(false);
        setPhase("idle");
        return false;
      }

      try {
        setPhase("finalizing");
        await finalizeDocumentRequest(uploadIntent.document_id);
        await refreshDocumentModuleStoresAfterMutation(uploadIntent.document_id);

        toast.success("Document uploaded and queued for indexing.", {
          id: `documents-upload-complete-${uploadIntent.document_id}`,
        });
        setPending(false);
        setPhase("idle");
        return true;
      } catch (finalizeError: unknown) {
        const message = await reportMutationError(finalizeError, {
          fallbackMessage:
            "The file was uploaded, but finalize or indexing did not complete.",
          toastId: `documents-finalize-${uploadIntent.document_id}-error`,
        });

        setError(message);
        invalidateDocumentsListCache();
        await refreshDocumentModuleStoresAfterMutation(
          uploadIntent.document_id,
        ).catch(() => {
          // Shared snapshot state stores any refresh failure.
        });
        setPending(false);
        setPhase("idle");
        return false;
      }
    },
    [reportMutationError],
  );

  return {
    pending,
    phase,
    error,
    lastUploadedDocumentId,
    clearError,
    reset,
    uploadDocument,
  };
}

export function useFinalizeDocument() {
  const { reportMutationError } = useDocumentsMutationFeedback();
  const [pendingDocumentId, setPendingDocumentId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const finalize = React.useCallback(
    async (documentId: string): Promise<boolean> => {
      setPendingDocumentId(documentId);
      setError(null);

      try {
        await finalizeDocumentRequest(documentId);
        await refreshDocumentModuleStoresAfterMutation(documentId);

        toast.success("Document finalize request completed.", {
          id: `documents-finalize-${documentId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to finalize that document right now.",
          toastId: `documents-finalize-${documentId}-error`,
        });
        setError(message);
        return false;
      } finally {
        setPendingDocumentId((current) =>
          current === documentId ? null : current,
        );
      }
    },
    [reportMutationError],
  );

  return {
    pending: pendingDocumentId !== null,
    pendingDocumentId,
    destructivePending: pendingDocumentId !== null,
    error,
    clearError,
    finalize,
  };
}

export function useDeleteDocument() {
  const { reportMutationError } = useDocumentsMutationFeedback();
  const [pendingDocumentId, setPendingDocumentId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const deleteDocument = React.useCallback(
    async (documentId: string): Promise<boolean> => {
      setPendingDocumentId(documentId);
      setError(null);

      try {
        await deleteDocumentRequest(documentId);
        clearDocumentDetailCache(documentId);
        removeDocumentFromListCache(documentId);
        invalidateDocumentsListCache();

        if (listSnapshot.fetchedAt !== null) {
          await refreshDocumentsListStore({
            force: true,
          });
        }

        toast.success("Document deleted successfully.", {
          id: `documents-delete-${documentId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to delete that document right now.",
          toastId: `documents-delete-${documentId}-error`,
        });
        setError(message);
        return false;
      } finally {
        setPendingDocumentId((current) =>
          current === documentId ? null : current,
        );
      }
    },
    [reportMutationError],
  );

  return {
    pending: pendingDocumentId !== null,
    pendingDocumentId,
    destructivePending: pendingDocumentId !== null,
    error,
    clearError,
    deleteDocument,
  };
}

export function useDocumentReadUrl() {
  const { reportMutationError } = useDocumentsMutationFeedback();
  const [pendingDocumentId, setPendingDocumentId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const fetchReadUrl = React.useCallback(
    async (
      documentId: string,
      disposition: DocumentReadDisposition = "inline",
    ): Promise<DocumentSignedReadUrlData | null> => {
      setPendingDocumentId(documentId);
      setError(null);

      try {
        const response = await getDocumentReadUrl(documentId, disposition);
        return response.data;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to open that document right now.",
          toastId: `documents-read-url-${documentId}-error`,
        });
        setError(message);
        return null;
      } finally {
        setPendingDocumentId((current) =>
          current === documentId ? null : current,
        );
      }
    },
    [reportMutationError],
  );

  return {
    pending: pendingDocumentId !== null,
    pendingDocumentId,
    error,
    clearError,
    fetchReadUrl,
  };
}
