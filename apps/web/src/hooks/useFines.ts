// apps/web/src/hooks/useFines.ts
/**
 * Unified fine-management module hook/state boundary.
 *
 * Purpose:
 * - Keep the staff fine-management module hook logic in one file, matching the
 *   locked frontend convention for module-scoped hook ownership.
 * - Centralize one cached fine-directory list, local view-state derivation,
 *   fine-detail cache state, and settlement mutations without pushing data
 *   orchestration into page components.
 *
 * Important:
 * - This module does not invent backend behavior.
 * - The staff fine list now follows the cached directory flow used by the
 *   admin users module: load the full staff fine directory once, keep it in a
 *   shared module cache, and derive search, status, created-date range
 *   filtering, and pagination locally from that cached dataset.
 * - Settlement success refreshes the cached fine directory and the affected
 *   fine detail so the UI cannot drift from backend truth.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  getAllStaffFines,
  getStaffFineById,
  isFinesApiError,
  payFine as payFineRequest,
  waiveFine as waiveFineRequest,
  type FineStatus,
  type StaffFineDetailItem,
  type StaffFineListItem,
  type WaiveFinePayload,
} from "@/lib/api/fines";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";

export type StaffFineListStatus = "idle" | "loading" | "success" | "error";
export type StaffFineStatusFilter = FineStatus | "all";
export const STAFF_FINE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type StaffFinePageSize = (typeof STAFF_FINE_PAGE_SIZE_OPTIONS)[number];

export interface StaffFineListFilters {
  status: StaffFineStatusFilter;
  searchTerm: string;
  createdDateRange: {
    from: string;
    to: string;
  };
  page: number;
  pageSize: number;
}

interface StaffFinesListCacheSnapshot {
  queryKey: string;
  status: StaffFineListStatus;
  refreshing: boolean;
  invalidated: boolean;
  items: StaffFineListItem[];
  total: number;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface StaffFineDetailCacheSnapshot {
  queryKey: string;
  fineId: string;
  status: StaffFineListStatus;
  refreshing: boolean;
  invalidated: boolean;
  item: StaffFineDetailItem | null;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface MutationErrorOptions {
  fallbackMessage: string;
  toastId: string;
}

const STAFF_FINES_QUERY_KEYS = {
  list: "staff-fines:list",
  detail: (fineId: string) => `staff-fines:detail:${fineId}`,
} as const;

const DEFAULT_STAFF_FINE_FILTERS: StaffFineListFilters = {
  status: "all",
  searchTerm: "",
  createdDateRange: {
    from: "",
    to: "",
  },
  page: 1,
  pageSize: 10,
};

const listListeners = new Set<() => void>();
const detailListeners = new Map<string, Set<() => void>>();
const detailSnapshots = new Map<string, StaffFineDetailCacheSnapshot>();
const detailRequestVersions = new Map<string, number>();

let listRequestVersion = 0;
let listSnapshot: StaffFinesListCacheSnapshot = {
  queryKey: STAFF_FINES_QUERY_KEYS.list,
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

function emitDetailSnapshot(fineId: string): void {
  detailListeners.get(fineId)?.forEach((listener) => {
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

function normalizeFinePageSize(value: number): StaffFinePageSize {
  if (
    STAFF_FINE_PAGE_SIZE_OPTIONS.includes(
      value as StaffFinePageSize,
    )
  ) {
    return value as StaffFinePageSize;
  }

  return 10;
}

function normalizeTextFilter(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDateFilter(value: string): string {
  return value.trim();
}

function toLocalDateKey(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function matchesLocalDateWindow(
  value: string | null,
  from: string,
  to: string,
): boolean {
  const normalizedFrom = normalizeDateFilter(from);
  const normalizedTo = normalizeDateFilter(to);

  if (!normalizedFrom && !normalizedTo) {
    return true;
  }

  const itemDateKey = toLocalDateKey(value);

  if (!itemDateKey) {
    return false;
  }

  if (normalizedFrom && itemDateKey < normalizedFrom) {
    return false;
  }

  if (normalizedTo && itemDateKey > normalizedTo) {
    return false;
  }

  return true;
}

function ensureDetailSnapshot(fineId: string): StaffFineDetailCacheSnapshot {
  const existing = detailSnapshots.get(fineId);

  if (existing) {
    return existing;
  }

  const created: StaffFineDetailCacheSnapshot = {
    queryKey: STAFF_FINES_QUERY_KEYS.detail(fineId),
    fineId,
    status: "idle",
    refreshing: false,
    invalidated: false,
    item: null,
    fetchedAt: null,
    error: null,
    errorStatus: null,
  };
  detailSnapshots.set(fineId, created);
  return created;
}

function setDetailSnapshot(snapshot: StaffFineDetailCacheSnapshot): void {
  detailSnapshots.set(snapshot.fineId, snapshot);
  emitDetailSnapshot(snapshot.fineId);
}

function subscribeStaffFinesListStore(listener: () => void): () => void {
  listListeners.add(listener);

  return () => {
    listListeners.delete(listener);
  };
}

function getStaffFinesListSnapshot(): StaffFinesListCacheSnapshot {
  return listSnapshot;
}

function subscribeStaffFineDetailStore(
  fineId: string,
  listener: () => void,
): () => void {
  const listeners = detailListeners.get(fineId) ?? new Set<() => void>();
  listeners.add(listener);
  detailListeners.set(fineId, listeners);

  return () => {
    const currentListeners = detailListeners.get(fineId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      detailListeners.delete(fineId);
    }
  };
}

function getStaffFineDetailSnapshot(
  fineId: string,
): StaffFineDetailCacheSnapshot {
  return ensureDetailSnapshot(fineId);
}

function invalidateStaffFinesListCache(): void {
  listSnapshot = {
    ...listSnapshot,
    invalidated: true,
  };
  emitListSnapshot();
}

function invalidateStaffFineDetailCache(fineId: string): void {
  const snapshot = ensureDetailSnapshot(fineId);
  setDetailSnapshot({
    ...snapshot,
    invalidated: true,
  });
}

function toStaffFineListShape(
  item: StaffFineDetailItem,
): StaffFineListItem {
  return {
    fine_id: item.fine_id,
    transaction_id: item.transaction_id,
    user_id: item.user_id,
    user_full_name: item.user_full_name,
    book_id: item.book_id,
    title: item.title,
    amount: item.amount,
    status: item.status,
    fine_created_at: item.fine_created_at,
    resolved_at: item.resolved_at,
    resolved_by: item.resolved_by,
    resolved_by_name: item.resolved_by_name,
    waive_reason: item.waive_reason,
  };
}

function upsertStaffFineListItem(item: StaffFineListItem): void {
  if (listSnapshot.status === "idle") {
    return;
  }

  const existingIndex = listSnapshot.items.findIndex(
    (currentItem) => currentItem.fine_id === item.fine_id,
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

async function refreshStaffFinesListStore(
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<StaffFinesListCacheSnapshot> {
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
    const response = await getAllStaffFines({
      signal: options.signal,
    });

    if (requestVersion !== listRequestVersion) {
      return listSnapshot;
    }

    listSnapshot = {
      queryKey: STAFF_FINES_QUERY_KEYS.list,
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
      error: getErrorMessage(error, "Unable to load fines right now."),
      errorStatus: isFinesApiError(error) ? error.status : null,
    };
    emitListSnapshot();
    throw error;
  }
}

async function refreshStaffFineDetailStore(
  fineId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<StaffFineDetailCacheSnapshot> {
  const currentSnapshot = ensureDetailSnapshot(fineId);
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

  const requestVersion = (detailRequestVersions.get(fineId) ?? 0) + 1;
  detailRequestVersions.set(fineId, requestVersion);
  setDetailSnapshot({
    ...currentSnapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getStaffFineById(fineId, {
      signal: options.signal,
    });

    if (detailRequestVersions.get(fineId) !== requestVersion) {
      return detailSnapshots.get(fineId) ?? currentSnapshot;
    }

    const nextSnapshot: StaffFineDetailCacheSnapshot = {
      queryKey: STAFF_FINES_QUERY_KEYS.detail(fineId),
      fineId,
      status: "success",
      refreshing: false,
      invalidated: false,
      item: response.data.item,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };
    setDetailSnapshot(nextSnapshot);
    upsertStaffFineListItem(toStaffFineListShape(response.data.item));
    return nextSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return detailSnapshots.get(fineId) ?? currentSnapshot;
    }

    if (detailRequestVersions.get(fineId) !== requestVersion) {
      return detailSnapshots.get(fineId) ?? currentSnapshot;
    }

    const failedSnapshot: StaffFineDetailCacheSnapshot = {
      ...currentSnapshot,
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(error, "Unable to load that fine right now."),
      errorStatus: isFinesApiError(error) ? error.status : null,
    };
    setDetailSnapshot(failedSnapshot);
    throw error;
  }
}

async function refreshFineModuleStoresAfterMutation(fineId: string): Promise<void> {
  invalidateStaffFinesListCache();
  const hasLoadedDetailSnapshot = detailSnapshots.has(fineId);

  if (hasLoadedDetailSnapshot) {
    invalidateStaffFineDetailCache(fineId);
  }

  await Promise.allSettled([
    ...(listSnapshot.fetchedAt !== null
      ? [
          refreshStaffFinesListStore({
            force: true,
          }),
        ]
      : []),
    ...(hasLoadedDetailSnapshot
      ? [
          refreshStaffFineDetailStore(fineId, {
            force: true,
          }),
        ]
      : []),
  ]);
}

function useFinesMutationFeedback() {
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

export function useStaffFinesList(options: {
  autoLoad?: boolean;
  initialFilters?: Partial<StaffFineListFilters>;
} = {}) {
  const snapshot = React.useSyncExternalStore(
    subscribeStaffFinesListStore,
    getStaffFinesListSnapshot,
    getStaffFinesListSnapshot,
  );
  const [filters, setFilters] = React.useState<StaffFineListFilters>({
    ...DEFAULT_STAFF_FINE_FILTERS,
    ...options.initialFilters,
    page: Math.max(1, options.initialFilters?.page ?? DEFAULT_STAFF_FINE_FILTERS.page),
    pageSize: normalizeFinePageSize(
      options.initialFilters?.pageSize ?? DEFAULT_STAFF_FINE_FILTERS.pageSize,
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

    void refreshStaffFinesListStore().catch(() => {
      // Errors are exposed through the shared snapshot for page-level handling.
    });
  }, [options.autoLoad]);

  const normalizedSearchTerm = normalizeTextFilter(filters.searchTerm);
  const filteredItems = snapshot.items.filter((item) => {
    const matchesStatus =
      filters.status === "all" || item.status === filters.status;
    const searchHaystack = [
      item.user_full_name,
      item.title,
      item.fine_id,
      item.transaction_id,
      item.user_id,
      item.book_id,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      normalizedSearchTerm.length === 0
        ? true
        : searchHaystack.includes(normalizedSearchTerm);
    const matchesCreatedWindow = matchesLocalDateWindow(
      item.fine_created_at,
      filters.createdDateRange.from,
      filters.createdDateRange.to,
    );

    return matchesStatus && matchesSearch && matchesCreatedWindow;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pageStart = (currentPage - 1) * filters.pageSize;
  const pageItems = filteredItems.slice(pageStart, pageStart + filters.pageSize);
  const hasAppliedFilters =
    filters.status !== "all"
    || normalizeTextFilter(filters.searchTerm).length > 0
    || normalizeDateFilter(filters.createdDateRange.from).length > 0
    || normalizeDateFilter(filters.createdDateRange.to).length > 0;

  const updateFilters = React.useCallback(
    (next: Partial<StaffFineListFilters>) => {
      setFilters((current) => ({
        ...current,
        ...next,
        page:
          next.page !== undefined
            ? Math.max(1, next.page)
              : next.pageSize !== undefined
                || next.status !== undefined
                || next.searchTerm !== undefined
                || next.createdDateRange !== undefined
                ? 1
                : current.page,
        pageSize:
          next.pageSize !== undefined
            ? normalizeFinePageSize(next.pageSize)
            : current.pageSize,
      }));
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    try {
      await refreshStaffFinesListStore({
        force: true,
      });
    } catch {
      // Shared snapshot state already stores the latest fetch error.
    }
  }, []);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

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
    setStatusFilter: (status: StaffFineStatusFilter) => {
      updateFilters({
        status,
      });
    },
    setSearchTerm: (searchTerm: string) => {
      updateFilters({
        searchTerm,
      });
    },
    setCreatedDateRange: (createdDateRange: { from: string; to: string }) => {
      updateFilters({
        createdDateRange,
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
      setFilters(DEFAULT_STAFF_FINE_FILTERS);
    },
    refresh,
    retry,
    pageSizeOptions: STAFF_FINE_PAGE_SIZE_OPTIONS,
  };
}

export function useStaffFineDetail(
  fineId: string | null,
  options: {
    autoLoad?: boolean;
  } = {},
) {
  const resolvedFineId = fineId ?? "__missing__";
  const subscribe = React.useCallback(
    (listener: () => void) => subscribeStaffFineDetailStore(resolvedFineId, listener),
    [resolvedFineId],
  );
  const getSnapshot = React.useCallback(
    () => getStaffFineDetailSnapshot(resolvedFineId),
    [resolvedFineId],
  );
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  React.useEffect(() => {
    if (!options.autoLoad || !fineId) {
      return;
    }

    void refreshStaffFineDetailStore(fineId).catch(() => {
      // The consuming screen reads the shared snapshot error state.
    });
  }, [fineId, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    if (!fineId) {
      return;
    }

    try {
      await refreshStaffFineDetailStore(fineId, {
        force: true,
      });
    } catch {
      // Shared snapshot state already stores the latest fetch error.
    }
  }, [fineId]);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: Boolean(fineId) && snapshot.status === "loading",
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    item: fineId ? snapshot.item : null,
    hasData: Boolean(snapshot.item),
    hasStaleData: Boolean(snapshot.item && snapshot.error),
    refresh,
    retry,
  };
}

export function usePayFine() {
  const { reportMutationError } = useFinesMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const payFine = React.useCallback(
    async (fineId: string): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await payFineRequest(fineId);
        await refreshFineModuleStoresAfterMutation(fineId);

        toast.success("Fine marked as paid.", {
          id: `fines-pay-${fineId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to mark that fine as paid right now.",
          toastId: `fines-pay-${fineId}-error`,
        });
        setError(message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [reportMutationError],
  );

  return {
    pending,
    destructivePending: pending,
    error,
    clearError,
    payFine,
  };
}

export function useWaiveFine() {
  const { reportMutationError } = useFinesMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const waiveFine = React.useCallback(
    async (
      fineId: string,
      payload: WaiveFinePayload,
    ): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await waiveFineRequest(fineId, payload);
        await refreshFineModuleStoresAfterMutation(fineId);

        toast.success("Fine waived.", {
          id: `fines-waive-${fineId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to waive that fine right now.",
          toastId: `fines-waive-${fineId}-error`,
        });
        setError(message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [reportMutationError],
  );

  return {
    pending,
    destructivePending: pending,
    error,
    clearError,
    waiveFine,
  };
}
