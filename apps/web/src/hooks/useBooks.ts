"use client";

// apps/web/src/hooks/useBooks.ts
/**
 * Unified book-inventory module hook/state boundary.
 *
 * Purpose:
 * - Keep the staff book-inventory module hook logic in one file, matching the
 *   locked frontend convention for module-scoped hook ownership.
 * - Centralize one cached staff inventory directory, local refinement,
 *   selected-book detail, selected-book queue visibility, and book
 *   create/update/delete mutations without pushing orchestration into screens.
 *
 * Important:
 * - This module does not invent backend behavior.
 * - The staff inventory directory follows the locked cached-directory flow:
 *   load the full directory once, cache it, and derive search, status, category,
 *   and pagination locally.
 * - Mutation success refreshes the shared directory and any loaded detail or
 *   queue state for the affected book so UI state cannot drift from backend truth.
 */

import * as React from "react";
import { toast } from "sonner";

import {
  createBook as createBookRequest,
  deleteBook as deleteBookRequest,
  getAllStaffBooks,
  getBookQueueStatus,
  getStaffBookById,
  isBooksApiError,
  updateBook as updateBookRequest,
} from "@/lib/api/books";
import type {
  BookCategory,
  BookQueueStatusItem,
  BookStatus,
  CreateBookPayload,
  StaffBookDetailItem,
  StaffBookListItem,
  UpdateBookPayload,
} from "@/lib/books";
import { BOOK_CATEGORY_VALUES, BOOK_STATUS_VALUES } from "@/lib/books";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";

export type BooksListStatus = "idle" | "loading" | "success" | "error";
export type BookStatusFilter = BookStatus | "all";
export type BookCategoryFilter = BookCategory | "all";
export const BOOKS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type BooksPageSize = (typeof BOOKS_PAGE_SIZE_OPTIONS)[number];

export interface BooksListFilters {
  searchTerm: string;
  status: BookStatusFilter;
  category: BookCategoryFilter;
  page: number;
  pageSize: number;
}

interface BooksListCacheSnapshot {
  queryKey: string;
  status: BooksListStatus;
  refreshing: boolean;
  invalidated: boolean;
  items: StaffBookListItem[];
  total: number;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface BookDetailCacheSnapshot {
  queryKey: string;
  bookId: string;
  status: BooksListStatus;
  refreshing: boolean;
  invalidated: boolean;
  item: StaffBookDetailItem | null;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface BookQueueCacheSnapshot {
  queryKey: string;
  bookId: string;
  status: BooksListStatus;
  refreshing: boolean;
  invalidated: boolean;
  item: BookQueueStatusItem | null;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface MutationErrorOptions {
  fallbackMessage: string;
  toastId: string;
}

const BOOKS_QUERY_KEYS = {
  list: "books:list",
  detail: (bookId: string) => `books:detail:${bookId}`,
  queue: (bookId: string) => `books:queue:${bookId}`,
} as const;

const DEFAULT_BOOKS_FILTERS: BooksListFilters = {
  searchTerm: "",
  status: "all",
  category: "all",
  page: 1,
  pageSize: 10,
};

const listListeners = new Set<() => void>();
const detailListeners = new Map<string, Set<() => void>>();
const queueListeners = new Map<string, Set<() => void>>();
const detailSnapshots = new Map<string, BookDetailCacheSnapshot>();
const queueSnapshots = new Map<string, BookQueueCacheSnapshot>();
const detailRequestVersions = new Map<string, number>();
const queueRequestVersions = new Map<string, number>();

let listRequestVersion = 0;
let listSnapshot: BooksListCacheSnapshot = {
  queryKey: BOOKS_QUERY_KEYS.list,
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

function emitDetailSnapshot(bookId: string): void {
  detailListeners.get(bookId)?.forEach((listener) => {
    listener();
  });
}

function emitQueueSnapshot(bookId: string): void {
  queueListeners.get(bookId)?.forEach((listener) => {
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

function normalizeBooksPageSize(value: number): BooksPageSize {
  if (BOOKS_PAGE_SIZE_OPTIONS.includes(value as BooksPageSize)) {
    return value as BooksPageSize;
  }

  return 10;
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

function ensureDetailSnapshot(bookId: string): BookDetailCacheSnapshot {
  const existing = detailSnapshots.get(bookId);

  if (existing) {
    return existing;
  }

  const created: BookDetailCacheSnapshot = {
    queryKey: BOOKS_QUERY_KEYS.detail(bookId),
    bookId,
    status: "idle",
    refreshing: false,
    invalidated: false,
    item: null,
    fetchedAt: null,
    error: null,
    errorStatus: null,
  };
  detailSnapshots.set(bookId, created);
  return created;
}

function ensureQueueSnapshot(bookId: string): BookQueueCacheSnapshot {
  const existing = queueSnapshots.get(bookId);

  if (existing) {
    return existing;
  }

  const created: BookQueueCacheSnapshot = {
    queryKey: BOOKS_QUERY_KEYS.queue(bookId),
    bookId,
    status: "idle",
    refreshing: false,
    invalidated: false,
    item: null,
    fetchedAt: null,
    error: null,
    errorStatus: null,
  };
  queueSnapshots.set(bookId, created);
  return created;
}

function setDetailSnapshot(snapshot: BookDetailCacheSnapshot): void {
  detailSnapshots.set(snapshot.bookId, snapshot);
  emitDetailSnapshot(snapshot.bookId);
}

function setQueueSnapshot(snapshot: BookQueueCacheSnapshot): void {
  queueSnapshots.set(snapshot.bookId, snapshot);
  emitQueueSnapshot(snapshot.bookId);
}

function subscribeBooksListStore(listener: () => void): () => void {
  listListeners.add(listener);

  return () => {
    listListeners.delete(listener);
  };
}

function getBooksListSnapshot(): BooksListCacheSnapshot {
  return listSnapshot;
}

function subscribeBookDetailStore(
  bookId: string,
  listener: () => void,
): () => void {
  const listeners = detailListeners.get(bookId) ?? new Set<() => void>();
  listeners.add(listener);
  detailListeners.set(bookId, listeners);

  return () => {
    const currentListeners = detailListeners.get(bookId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      detailListeners.delete(bookId);
    }
  };
}

function subscribeBookQueueStore(
  bookId: string,
  listener: () => void,
): () => void {
  const listeners = queueListeners.get(bookId) ?? new Set<() => void>();
  listeners.add(listener);
  queueListeners.set(bookId, listeners);

  return () => {
    const currentListeners = queueListeners.get(bookId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      queueListeners.delete(bookId);
    }
  };
}

function getBookDetailSnapshot(bookId: string): BookDetailCacheSnapshot {
  return ensureDetailSnapshot(bookId);
}

function getBookQueueSnapshot(bookId: string): BookQueueCacheSnapshot {
  return ensureQueueSnapshot(bookId);
}

function invalidateBooksListCache(): void {
  listSnapshot = {
    ...listSnapshot,
    invalidated: true,
  };
  emitListSnapshot();
}

function invalidateBookDetailCache(bookId: string): void {
  const snapshot = ensureDetailSnapshot(bookId);
  setDetailSnapshot({
    ...snapshot,
    invalidated: true,
  });
}

function invalidateBookQueueCache(bookId: string): void {
  const snapshot = ensureQueueSnapshot(bookId);
  setQueueSnapshot({
    ...snapshot,
    invalidated: true,
  });
}

function clearBookDetailCache(bookId: string): void {
  detailSnapshots.delete(bookId);
  detailRequestVersions.delete(bookId);
  emitDetailSnapshot(bookId);
}

function clearBookQueueCache(bookId: string): void {
  queueSnapshots.delete(bookId);
  queueRequestVersions.delete(bookId);
  emitQueueSnapshot(bookId);
}

function removeBookFromListCache(bookId: string): void {
  const nextItems = listSnapshot.items.filter((item) => item.id !== bookId);

  listSnapshot = {
    ...listSnapshot,
    items: nextItems,
    total: nextItems.length,
  };
  emitListSnapshot();
}

function toStaffBookListShape(item: StaffBookDetailItem): StaffBookListItem {
  return {
    id: item.id,
    title: item.title,
    author: item.author,
    category: item.category,
    status: item.status,
    replacement_cost: item.replacement_cost,
    fine_per_day_rate: item.fine_per_day_rate,
    override_borrow_duration_days: item.override_borrow_duration_days,
    created_at: item.created_at,
  };
}

function upsertBookListItem(item: StaffBookListItem): void {
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

async function refreshBooksListStore(
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<BooksListCacheSnapshot> {
  const hasLoadedData = listSnapshot.items.length > 0;

  if (listSnapshot.status === "loading" && !options.force) {
    return listSnapshot;
  }

  if (
    hasLoadedData &&
    !listSnapshot.invalidated &&
    !listSnapshot.error &&
    !options.force
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
    const response = await getAllStaffBooks({
      signal: options.signal,
    });

    if (requestVersion !== listRequestVersion) {
      return listSnapshot;
    }

    listSnapshot = {
      queryKey: BOOKS_QUERY_KEYS.list,
      status: "success",
      refreshing: false,
      invalidated: false,
      items: response.data.items,
      total: response.data.total,
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
      error: getErrorMessage(error, "Unable to load books right now."),
      errorStatus: isBooksApiError(error) ? error.status : null,
    };
    emitListSnapshot();
    throw error;
  }
}

async function refreshBookDetailStore(
  bookId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<BookDetailCacheSnapshot> {
  const currentSnapshot = ensureDetailSnapshot(bookId);
  const hasLoadedData = Boolean(currentSnapshot.item);

  if (currentSnapshot.status === "loading" && !options.force) {
    return currentSnapshot;
  }

  if (
    hasLoadedData &&
    !currentSnapshot.invalidated &&
    !currentSnapshot.error &&
    !options.force
  ) {
    return currentSnapshot;
  }

  const requestVersion = (detailRequestVersions.get(bookId) ?? 0) + 1;
  detailRequestVersions.set(bookId, requestVersion);
  setDetailSnapshot({
    ...currentSnapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getStaffBookById(bookId, {
      signal: options.signal,
    });

    if (detailRequestVersions.get(bookId) !== requestVersion) {
      return detailSnapshots.get(bookId) ?? currentSnapshot;
    }

    const nextSnapshot: BookDetailCacheSnapshot = {
      queryKey: BOOKS_QUERY_KEYS.detail(bookId),
      bookId,
      status: "success",
      refreshing: false,
      invalidated: false,
      item: response.data.book,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };
    setDetailSnapshot(nextSnapshot);
    upsertBookListItem(toStaffBookListShape(response.data.book));
    return nextSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return detailSnapshots.get(bookId) ?? currentSnapshot;
    }

    if (detailRequestVersions.get(bookId) !== requestVersion) {
      return detailSnapshots.get(bookId) ?? currentSnapshot;
    }

    const failedSnapshot: BookDetailCacheSnapshot = {
      ...currentSnapshot,
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(error, "Unable to load that book right now."),
      errorStatus: isBooksApiError(error) ? error.status : null,
    };
    setDetailSnapshot(failedSnapshot);
    throw error;
  }
}

async function refreshBookQueueStore(
  bookId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<BookQueueCacheSnapshot> {
  const currentSnapshot = ensureQueueSnapshot(bookId);
  const hasLoadedData = Boolean(currentSnapshot.item);

  if (currentSnapshot.status === "loading" && !options.force) {
    return currentSnapshot;
  }

  if (
    hasLoadedData &&
    !currentSnapshot.invalidated &&
    !currentSnapshot.error &&
    !options.force
  ) {
    return currentSnapshot;
  }

  const requestVersion = (queueRequestVersions.get(bookId) ?? 0) + 1;
  queueRequestVersions.set(bookId, requestVersion);
  setQueueSnapshot({
    ...currentSnapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getBookQueueStatus(bookId, {
      signal: options.signal,
    });

    if (queueRequestVersions.get(bookId) !== requestVersion) {
      return queueSnapshots.get(bookId) ?? currentSnapshot;
    }

    const nextSnapshot: BookQueueCacheSnapshot = {
      queryKey: BOOKS_QUERY_KEYS.queue(bookId),
      bookId,
      status: "success",
      refreshing: false,
      invalidated: false,
      item: response.data.queue,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };
    setQueueSnapshot(nextSnapshot);
    return nextSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return queueSnapshots.get(bookId) ?? currentSnapshot;
    }

    if (queueRequestVersions.get(bookId) !== requestVersion) {
      return queueSnapshots.get(bookId) ?? currentSnapshot;
    }

    const failedSnapshot: BookQueueCacheSnapshot = {
      ...currentSnapshot,
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(
        error,
        "Unable to load queue visibility for this book right now.",
      ),
      errorStatus: isBooksApiError(error) ? error.status : null,
    };
    setQueueSnapshot(failedSnapshot);
    throw error;
  }
}

async function refreshBookModuleStoresAfterMutation(bookId: string): Promise<void> {
  invalidateBooksListCache();
  const hasLoadedDetailSnapshot = detailSnapshots.has(bookId);
  const hasLoadedQueueSnapshot = queueSnapshots.has(bookId);

  if (hasLoadedDetailSnapshot) {
    invalidateBookDetailCache(bookId);
  }

  if (hasLoadedQueueSnapshot) {
    invalidateBookQueueCache(bookId);
  }

  await Promise.allSettled([
    ...(listSnapshot.fetchedAt !== null
      ? [
          refreshBooksListStore({
            force: true,
          }),
        ]
      : []),
    ...(hasLoadedDetailSnapshot
      ? [
          refreshBookDetailStore(bookId, {
            force: true,
          }),
        ]
      : []),
    ...(hasLoadedQueueSnapshot
      ? [
          refreshBookQueueStore(bookId, {
            force: true,
          }),
        ]
      : []),
  ]);
}

function useBooksMutationFeedback() {
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

export function useBooksList(options: {
  autoLoad?: boolean;
  initialFilters?: Partial<BooksListFilters>;
} = {}) {
  const snapshot = React.useSyncExternalStore(
    subscribeBooksListStore,
    getBooksListSnapshot,
    getBooksListSnapshot,
  );
  const [filters, setFilters] = React.useState<BooksListFilters>({
    ...DEFAULT_BOOKS_FILTERS,
    ...options.initialFilters,
    page: Math.max(1, options.initialFilters?.page ?? DEFAULT_BOOKS_FILTERS.page),
    pageSize: normalizeBooksPageSize(
      options.initialFilters?.pageSize ?? DEFAULT_BOOKS_FILTERS.pageSize,
    ),
    status: options.initialFilters?.status ?? DEFAULT_BOOKS_FILTERS.status,
    category: options.initialFilters?.category ?? DEFAULT_BOOKS_FILTERS.category,
  });
  const isInitialAutoLoad =
    Boolean(options.autoLoad) &&
    snapshot.status === "idle" &&
    snapshot.items.length === 0 &&
    snapshot.error === null;

  React.useEffect(() => {
    if (!options.autoLoad) {
      return;
    }

    void refreshBooksListStore().catch(() => {
      // Errors are exposed through the shared snapshot for page-level handling.
    });
  }, [options.autoLoad]);

  const normalizedSearchTerm = normalizeSearchTerm(filters.searchTerm);
  const filteredItems = snapshot.items.filter((item) => {
    const matchesStatus =
      filters.status === "all" || item.status === filters.status;
    const matchesCategory =
      filters.category === "all" || item.category === filters.category;
    const searchHaystack = [
      item.title,
      item.author,
      item.category,
      item.status,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      normalizedSearchTerm.length === 0
        ? true
        : searchHaystack.includes(normalizedSearchTerm);

    return matchesStatus && matchesCategory && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pageStart = (currentPage - 1) * filters.pageSize;
  const pageItems = filteredItems.slice(pageStart, pageStart + filters.pageSize);
  const hasAppliedFilters =
    normalizedSearchTerm.length > 0 ||
    filters.status !== "all" ||
    filters.category !== "all";

  const updateFilters = React.useCallback(
    (next: Partial<BooksListFilters>) => {
      setFilters((current) => ({
        ...current,
        ...next,
        page:
          next.page !== undefined
            ? Math.max(1, next.page)
            : next.pageSize !== undefined ||
                next.searchTerm !== undefined ||
                next.status !== undefined ||
                next.category !== undefined
              ? 1
              : current.page,
        pageSize:
          next.pageSize !== undefined
            ? normalizeBooksPageSize(next.pageSize)
            : current.pageSize,
      }));
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    try {
      await refreshBooksListStore({
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
    invalidateBooksListCache();
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
      updateFilters({ searchTerm });
    },
    setStatusFilter: (status: BookStatusFilter) => {
      updateFilters({ status });
    },
    setCategoryFilter: (category: BookCategoryFilter) => {
      updateFilters({ category });
    },
    setPage: (page: number) => {
      updateFilters({ page });
    },
    setPageSize: (pageSize: number) => {
      updateFilters({ pageSize });
    },
    resetFilters: () => {
      setFilters(DEFAULT_BOOKS_FILTERS);
    },
    refresh,
    retry,
    invalidate,
    pageSizeOptions: BOOKS_PAGE_SIZE_OPTIONS,
    categoryOptions: BOOK_CATEGORY_VALUES,
    statusOptions: BOOK_STATUS_VALUES,
  };
}

export function useBookDetail(
  bookId: string | null,
  options: {
    autoLoad?: boolean;
  } = {},
) {
  const resolvedBookId = bookId ?? "__missing__";
  const subscribe = React.useCallback(
    (listener: () => void) => subscribeBookDetailStore(resolvedBookId, listener),
    [resolvedBookId],
  );
  const getSnapshot = React.useCallback(
    () => getBookDetailSnapshot(resolvedBookId),
    [resolvedBookId],
  );
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  React.useEffect(() => {
    if (!options.autoLoad || !bookId) {
      return;
    }

    void refreshBookDetailStore(bookId).catch(() => {
      // The consuming screen reads the shared snapshot error state.
    });
  }, [bookId, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    if (!bookId) {
      return;
    }

    try {
      await refreshBookDetailStore(bookId, {
        force: true,
      });
    } catch {
      // Shared snapshot state already stores the latest fetch error.
    }
  }, [bookId]);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: Boolean(bookId) && snapshot.status === "loading",
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    item: bookId ? snapshot.item : null,
    hasData: Boolean(snapshot.item),
    hasStaleData: Boolean(snapshot.item && snapshot.error),
    refresh,
    retry,
  };
}

export function useBookQueueStatus(
  bookId: string | null,
  options: {
    autoLoad?: boolean;
  } = {},
) {
  const resolvedBookId = bookId ?? "__missing__";
  const subscribe = React.useCallback(
    (listener: () => void) => subscribeBookQueueStore(resolvedBookId, listener),
    [resolvedBookId],
  );
  const getSnapshot = React.useCallback(
    () => getBookQueueSnapshot(resolvedBookId),
    [resolvedBookId],
  );
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  React.useEffect(() => {
    if (!options.autoLoad || !bookId) {
      return;
    }

    void refreshBookQueueStore(bookId).catch(() => {
      // The consuming screen reads the shared snapshot error state.
    });
  }, [bookId, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    if (!bookId) {
      return;
    }

    try {
      await refreshBookQueueStore(bookId, {
        force: true,
      });
    } catch {
      // Shared snapshot state already stores the latest fetch error.
    }
  }, [bookId]);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: Boolean(bookId) && snapshot.status === "loading",
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    item: bookId ? snapshot.item : null,
    hasData: Boolean(snapshot.item),
    hasStaleData: Boolean(snapshot.item && snapshot.error),
    refresh,
    retry,
  };
}

export function useCreateBook() {
  const { reportMutationError } = useBooksMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const createBook = React.useCallback(
    async (payload: CreateBookPayload): Promise<string | null> => {
      setPending(true);
      setError(null);

      try {
        const response = await createBookRequest(payload);
        invalidateBooksListCache();

        if (listSnapshot.fetchedAt !== null) {
          await refreshBooksListStore({
            force: true,
          });
        }

        toast.success("Book created successfully.", {
          id: `books-create-${response.data.book_id}`,
        });
        return response.data.book_id;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to create that book right now.",
          toastId: "books-create-error",
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
    clearError,
    createBook,
  };
}

export function useUpdateBook() {
  const { reportMutationError } = useBooksMutationFeedback();
  const [pendingBookId, setPendingBookId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const updateBook = React.useCallback(
    async (bookId: string, payload: UpdateBookPayload): Promise<boolean> => {
      setPendingBookId(bookId);
      setError(null);

      try {
        await updateBookRequest(bookId, payload);
        await refreshBookModuleStoresAfterMutation(bookId);

        toast.success("Book updated successfully.", {
          id: `books-update-${bookId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to update that book right now.",
          toastId: `books-update-${bookId}-error`,
        });
        setError(message);
        return false;
      } finally {
        setPendingBookId((current) => (current === bookId ? null : current));
      }
    },
    [reportMutationError],
  );

  return {
    pending: pendingBookId !== null,
    pendingBookId,
    error,
    clearError,
    updateBook,
  };
}

export function useDeleteBook() {
  const { reportMutationError } = useBooksMutationFeedback();
  const [pendingBookId, setPendingBookId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const deleteBook = React.useCallback(
    async (bookId: string): Promise<boolean> => {
      setPendingBookId(bookId);
      setError(null);

      try {
        await deleteBookRequest(bookId);
        clearBookDetailCache(bookId);
        clearBookQueueCache(bookId);
        removeBookFromListCache(bookId);
        invalidateBooksListCache();

        if (listSnapshot.fetchedAt !== null) {
          await refreshBooksListStore({
            force: true,
          });
        }

        toast.success("Book deleted successfully.", {
          id: `books-delete-${bookId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to delete that book right now.",
          toastId: `books-delete-${bookId}-error`,
        });
        setError(message);
        return false;
      } finally {
        setPendingBookId((current) => (current === bookId ? null : current));
      }
    },
    [reportMutationError],
  );

  return {
    pending: pendingBookId !== null,
    pendingBookId,
    destructivePending: pendingBookId !== null,
    error,
    clearError,
    deleteBook,
  };
}
