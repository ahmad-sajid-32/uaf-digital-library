"use client";

// apps/web/src/hooks/useStudentCatalog.ts
/**
 * Student catalog hook/state boundary.
 *
 * Purpose:
 * - Centralize the student catalog list, selection, public detail, and
 *   authenticated queue-summary state machine in one module hook.
 * - Keep the student discovery flow aligned with the real backend contract:
 *   cursor-based public catalog reads plus selected-book queue visibility.
 * - Preserve truthful loading, retry, partial-failure, and landing behavior
 *   without pushing orchestration into the screen component.
 */

import * as React from "react";

import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import {
  getStudentBookById,
  getStudentBookQueueStatus,
  getStudentCatalogPage,
  isStudentCatalogApiError,
} from "@/lib/api/student-catalog";
import {
  BOOK_CATEGORY_VALUES,
  BOOK_STATUS_VALUES,
  type BookCategory,
  type BookQueueStatusItem,
  type BookStatus,
  type PublicBookDetailItem,
  type PublicCatalogBookListItem,
} from "@/lib/books";

type AsyncStatus = "idle" | "loading" | "success" | "error";
export type StudentCatalogStatusFilter = BookStatus | "all";
export type StudentCatalogCategoryFilter = BookCategory | "all";

const STUDENT_CATALOG_PAGE_SIZE = 20;

interface CatalogCursor {
  createdAt: string;
  id: string;
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

function mergeCatalogItems(
  current: PublicCatalogBookListItem[],
  next: PublicCatalogBookListItem[],
): PublicCatalogBookListItem[] {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];

  next.forEach((item) => {
    if (seen.has(item.id)) {
      return;
    }

    seen.add(item.id);
    merged.push(item);
  });

  return merged;
}

function getNextCursor(params: {
  items: PublicCatalogBookListItem[];
  cursorCreatedAt: string | null;
  cursorId: string | null;
}): CatalogCursor | null {
  if (
    params.items.length < STUDENT_CATALOG_PAGE_SIZE
    || !params.cursorCreatedAt
    || !params.cursorId
  ) {
    return null;
  }

  return {
    createdAt: params.cursorCreatedAt,
    id: params.cursorId,
  };
}

export function useStudentCatalog() {
  const { recoverFromSessionFailure } = useAuthSessionActions();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<StudentCatalogStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    React.useState<StudentCatalogCategoryFilter>("all");

  const [catalogStatus, setCatalogStatus] = React.useState<AsyncStatus>("idle");
  const [catalogItems, setCatalogItems] = React.useState<PublicCatalogBookListItem[]>([]);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [catalogErrorStatus, setCatalogErrorStatus] = React.useState<number | null>(
    null,
  );
  const [catalogRefreshing, setCatalogRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
  const [nextCursor, setNextCursor] = React.useState<CatalogCursor | null>(null);

  const [selectedBookId, setSelectedBookId] = React.useState<string | null>(null);

  const [detailStatus, setDetailStatus] = React.useState<AsyncStatus>("idle");
  const [detailItem, setDetailItem] = React.useState<PublicBookDetailItem | null>(
    null,
  );
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [detailErrorStatus, setDetailErrorStatus] = React.useState<number | null>(
    null,
  );
  const [detailRefreshing, setDetailRefreshing] = React.useState(false);

  const [queueStatus, setQueueStatus] = React.useState<AsyncStatus>("idle");
  const [queueItem, setQueueItem] = React.useState<BookQueueStatusItem | null>(
    null,
  );
  const [queueError, setQueueError] = React.useState<string | null>(null);
  const [queueErrorStatus, setQueueErrorStatus] = React.useState<number | null>(
    null,
  );
  const [queueRefreshing, setQueueRefreshing] = React.useState(false);

  const catalogRequestVersionRef = React.useRef(0);
  const detailRequestVersionRef = React.useRef(0);
  const queueRequestVersionRef = React.useRef(0);
  const catalogItemsRef = React.useRef<PublicCatalogBookListItem[]>([]);
  const detailItemRef = React.useRef<PublicBookDetailItem | null>(null);
  const queueItemRef = React.useRef<BookQueueStatusItem | null>(null);

  React.useEffect(() => {
    catalogItemsRef.current = catalogItems;
  }, [catalogItems]);

  React.useEffect(() => {
    detailItemRef.current = detailItem;
  }, [detailItem]);

  React.useEffect(() => {
    queueItemRef.current = queueItem;
  }, [queueItem]);

  const loadInitialCatalog = React.useCallback(
    async (options: { signal?: AbortSignal } = {}) => {
      const hasLoadedRows = catalogItemsRef.current.length > 0;
      const requestVersion = ++catalogRequestVersionRef.current;

      setCatalogError(null);
      setCatalogErrorStatus(null);
      setLoadMoreError(null);

      if (hasLoadedRows) {
        setCatalogRefreshing(true);
      } else {
        setCatalogStatus("loading");
      }

      try {
        const response = await getStudentCatalogPage({
          limit: STUDENT_CATALOG_PAGE_SIZE,
          signal: options.signal,
        });

        if (catalogRequestVersionRef.current !== requestVersion) {
          return;
        }

        const resolvedItems = response.data.items;

        setCatalogItems(resolvedItems);
        setCatalogStatus("success");
        setCatalogRefreshing(false);
        setNextCursor(
          getNextCursor({
            items: resolvedItems,
            cursorCreatedAt: response.data.next_cursor_created_at,
            cursorId: response.data.next_cursor_id,
          }),
        );

        if (resolvedItems.length === 0) {
          setSelectedBookId(null);
        }
      } catch (error: unknown) {
        if (isAbortError(error) || catalogRequestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          error,
          "Unable to load the catalog right now.",
        );
        const errorStatus = isStudentCatalogApiError(error) ? error.status : null;

        setCatalogRefreshing(false);
        setCatalogError(message);
        setCatalogErrorStatus(errorStatus);

        if (hasLoadedRows) {
          setCatalogStatus("success");
          return;
        }

        setCatalogStatus("error");
      }
    },
    [],
  );

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    const requestVersion = ++catalogRequestVersionRef.current;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const response = await getStudentCatalogPage({
        cursorCreatedAt: nextCursor.createdAt,
        cursorId: nextCursor.id,
        limit: STUDENT_CATALOG_PAGE_SIZE,
      });

      if (catalogRequestVersionRef.current !== requestVersion) {
        return;
      }

      setCatalogItems((current) => mergeCatalogItems(current, response.data.items));
      setNextCursor(
        getNextCursor({
          items: response.data.items,
          cursorCreatedAt: response.data.next_cursor_created_at,
          cursorId: response.data.next_cursor_id,
        }),
      );
    } catch (error: unknown) {
      if (catalogRequestVersionRef.current !== requestVersion) {
        return;
      }

      setLoadMoreError(
        getErrorMessage(error, "Unable to load more books right now."),
      );
    } finally {
      if (catalogRequestVersionRef.current === requestVersion) {
        setLoadingMore(false);
      }
    }
  }, [loadingMore, nextCursor]);

  const refresh = React.useCallback(async () => {
    await loadInitialCatalog();
  }, [loadInitialCatalog]);

  React.useEffect(() => {
    const controller = new AbortController();
    void loadInitialCatalog({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadInitialCatalog]);

  const loadSelectedBookDetail = React.useCallback(
    async (
      bookId: string,
      options: {
        signal?: AbortSignal;
        preserveCurrent?: boolean;
      } = {},
    ) => {
      const requestVersion = ++detailRequestVersionRef.current;
      const currentDetailItem = detailItemRef.current;
      const preserveCurrent =
        options.preserveCurrent && currentDetailItem?.id === bookId;

      setDetailError(null);
      setDetailErrorStatus(null);
      setDetailRefreshing(Boolean(preserveCurrent));
      setDetailStatus(preserveCurrent ? "success" : "loading");

      if (!preserveCurrent) {
        setDetailItem(null);
      }

      try {
        const response = await getStudentBookById(bookId, {
          signal: options.signal,
        });

        if (detailRequestVersionRef.current !== requestVersion) {
          return;
        }

        setDetailItem(response.data.book);
        setDetailStatus("success");
        setDetailRefreshing(false);
      } catch (error: unknown) {
        if (
          isAbortError(error)
          || detailRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        setDetailItem(preserveCurrent ? currentDetailItem : null);
        setDetailStatus(preserveCurrent ? "success" : "error");
        setDetailRefreshing(false);
        setDetailError(
          getErrorMessage(error, "Unable to load that book right now."),
        );
        setDetailErrorStatus(isStudentCatalogApiError(error) ? error.status : null);
      }
    },
    [],
  );

  const loadSelectedBookQueue = React.useCallback(
    async (
      bookId: string,
      options: {
        signal?: AbortSignal;
        preserveCurrent?: boolean;
      } = {},
    ) => {
      const requestVersion = ++queueRequestVersionRef.current;
      const currentQueueItem = queueItemRef.current;
      const preserveCurrent =
        options.preserveCurrent && currentQueueItem?.book_id === bookId;

      setQueueError(null);
      setQueueErrorStatus(null);
      setQueueRefreshing(Boolean(preserveCurrent));
      setQueueStatus(preserveCurrent ? "success" : "loading");

      if (!preserveCurrent) {
        setQueueItem(null);
      }

      try {
        const response = await getStudentBookQueueStatus(bookId, {
          signal: options.signal,
        });

        if (queueRequestVersionRef.current !== requestVersion) {
          return;
        }

        setQueueItem(response.data.queue);
        setQueueStatus("success");
        setQueueRefreshing(false);
      } catch (error: unknown) {
        if (
          isAbortError(error)
          || queueRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        const recovered = await recoverFromSessionFailure(error, {
          toastId: `student-catalog-queue-${bookId}-session`,
        });

        if (recovered || queueRequestVersionRef.current !== requestVersion) {
          return;
        }

        setQueueItem(preserveCurrent ? currentQueueItem : null);
        setQueueStatus(preserveCurrent ? "success" : "error");
        setQueueRefreshing(false);
        setQueueError(
          getErrorMessage(
            error,
            "Unable to load queue visibility for this book right now.",
          ),
        );
        setQueueErrorStatus(isStudentCatalogApiError(error) ? error.status : null);
      }
    },
    [recoverFromSessionFailure],
  );

  React.useEffect(() => {
    if (!selectedBookId) {
      setDetailStatus("idle");
      setDetailItem(null);
      setDetailError(null);
      setDetailErrorStatus(null);
      setDetailRefreshing(false);

      setQueueStatus("idle");
      setQueueItem(null);
      setQueueError(null);
      setQueueErrorStatus(null);
      setQueueRefreshing(false);
      return;
    }

    const detailController = new AbortController();
    const queueController = new AbortController();

    void loadSelectedBookDetail(selectedBookId, {
      signal: detailController.signal,
    });
    void loadSelectedBookQueue(selectedBookId, {
      signal: queueController.signal,
    });

    return () => {
      detailController.abort();
      queueController.abort();
    };
  }, [loadSelectedBookDetail, loadSelectedBookQueue, selectedBookId]);

  const selectedListItem = React.useMemo(
    () =>
      selectedBookId
        ? catalogItems.find((item) => item.id === selectedBookId) ?? null
        : null,
    [catalogItems, selectedBookId],
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredItems = React.useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
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
  }, [catalogItems, categoryFilter, normalizedSearchTerm, statusFilter]);

  const hasAppliedFilters =
    normalizedSearchTerm.length > 0
    || statusFilter !== "all"
    || categoryFilter !== "all";

  const retryDetail = React.useCallback(async () => {
    if (!selectedBookId) {
      return;
    }

    await loadSelectedBookDetail(selectedBookId, {
      preserveCurrent: Boolean(detailItemRef.current),
    });
  }, [loadSelectedBookDetail, selectedBookId]);

  const retryQueue = React.useCallback(async () => {
    if (!selectedBookId) {
      return;
    }

    await loadSelectedBookQueue(selectedBookId, {
      preserveCurrent: Boolean(queueItemRef.current),
    });
  }, [loadSelectedBookQueue, selectedBookId]);

  return {
    status: catalogStatus,
    loading: catalogStatus === "loading",
    refreshing: catalogRefreshing,
    error: catalogError,
    errorStatus: catalogErrorStatus,
    items: filteredItems,
    loadedItems: catalogItems,
    totalLoadedItems: catalogItems.length,
    filteredCount: filteredItems.length,
    hasData: catalogItems.length > 0,
    hasStaleData: catalogItems.length > 0 && Boolean(catalogError),
    isEmpty: catalogStatus === "success" && catalogItems.length === 0,
    isFilterEmpty:
      catalogStatus === "success"
      && catalogItems.length > 0
      && filteredItems.length === 0,
    hasAppliedFilters,
    searchTerm,
    statusFilter,
    categoryFilter,
    setSearchTerm,
    setStatusFilter,
    setCategoryFilter,
    resetFilters: () => {
      setSearchTerm("");
      setStatusFilter("all");
      setCategoryFilter("all");
    },
    hasMore: nextCursor !== null,
    loadingMore,
    loadMoreError,
    loadMore,
    refresh,
    retry: refresh,
    selectedBookId,
    selectedListItem,
    selectBook: (bookId: string) => {
      setSelectedBookId(bookId);
    },
    clearSelectedBook: () => {
      setSelectedBookId(null);
    },
    selectedBook: {
      status: detailStatus,
      loading: detailStatus === "loading",
      refreshing: detailRefreshing,
      error: detailError,
      errorStatus: detailErrorStatus,
      item: detailItem,
      hasData: Boolean(detailItem),
      retry: retryDetail,
    },
    selectedBookQueue: {
      status: queueStatus,
      loading: queueStatus === "loading",
      refreshing: queueRefreshing,
      error: queueError,
      errorStatus: queueErrorStatus,
      requiresAuth: queueErrorStatus === 401,
      item: queueItem,
      hasData: Boolean(queueItem),
      retry: retryQueue,
    },
    statusOptions: BOOK_STATUS_VALUES,
    categoryOptions: BOOK_CATEGORY_VALUES,
  };
}
