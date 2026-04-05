// apps/web/src/hooks/useCirculation.ts
/**
 * Unified staff circulation module hook/state boundary.
 *
 * Purpose:
 * - Keep the staff circulation module hook logic in one file, matching the
 *   locked frontend convention for module-scoped hook ownership.
 * - Centralize scope-specific cached loan directories, local refinement,
 *   selected-loan detail state, queue visibility, and circulation mutations.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  adjustStaffCirculationLoanDueDate,
  getAllStaffCirculationLoans,
  getCirculationBookQueueStatus,
  getStaffCirculationLoanById,
  isCirculationApiError,
  renewStaffCirculationLoan,
  returnStaffCirculationLoan,
} from "@/lib/api/circulation";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import type {
  AdjustLoanDueDatePayload,
  CirculationBookQueueStatusItem,
  CirculationBookStatus,
  CirculationRole,
  CirculationScope,
  StaffCirculationLoanDetailItem,
  StaffCirculationLoanListItem,
} from "@/lib/circulation";

export type CirculationListStatus = "idle" | "loading" | "success" | "error";
export type CirculationRoleFilter = CirculationRole | "all";
export type CirculationBookStatusFilter = CirculationBookStatus | "all";
export const STAFF_CIRCULATION_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type StaffCirculationPageSize =
  (typeof STAFF_CIRCULATION_PAGE_SIZE_OPTIONS)[number];

export interface StaffCirculationFilters {
  searchTerm: string;
  role: CirculationRoleFilter;
  bookStatus: CirculationBookStatusFilter;
  dueDateRange: {
    from: string;
    to: string;
  };
  page: number;
  pageSize: number;
}

interface ScopeSnapshot {
  queryKey: string;
  scope: CirculationScope;
  status: CirculationListStatus;
  refreshing: boolean;
  invalidated: boolean;
  items: StaffCirculationLoanListItem[];
  total: number;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface DetailSnapshot {
  queryKey: string;
  transactionId: string;
  status: CirculationListStatus;
  refreshing: boolean;
  invalidated: boolean;
  item: StaffCirculationLoanDetailItem | null;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface QueueSnapshot {
  queryKey: string;
  bookId: string;
  status: CirculationListStatus;
  refreshing: boolean;
  invalidated: boolean;
  item: CirculationBookQueueStatusItem | null;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface MutationErrorOptions {
  fallbackMessage: string;
  toastId: string;
}

const DEFAULT_FILTERS: StaffCirculationFilters = {
  searchTerm: "",
  role: "all",
  bookStatus: "all",
  dueDateRange: {
    from: "",
    to: "",
  },
  page: 1,
  pageSize: 10,
};

const SCOPE_KEYS: CirculationScope[] = ["active", "overdue", "history"];
const scopeListeners = new Map<CirculationScope, Set<() => void>>();
const detailListeners = new Map<string, Set<() => void>>();
const queueListeners = new Map<string, Set<() => void>>();
const detailSnapshots = new Map<string, DetailSnapshot>();
const queueSnapshots = new Map<string, QueueSnapshot>();
const detailRequestVersions = new Map<string, number>();
const queueRequestVersions = new Map<string, number>();
const scopeRequestVersions = new Map<CirculationScope, number>(
  SCOPE_KEYS.map((scope) => [scope, 0]),
);
const scopeSnapshots = new Map<CirculationScope, ScopeSnapshot>(
  SCOPE_KEYS.map((scope) => [
    scope,
    {
      queryKey: `staff-circulation:${scope}`,
      scope,
      status: "idle",
      refreshing: false,
      invalidated: false,
      items: [],
      total: 0,
      fetchedAt: null,
      error: null,
      errorStatus: null,
    },
  ]),
);

function emitScopeSnapshot(scope: CirculationScope): void {
  scopeListeners.get(scope)?.forEach((listener) => {
    listener();
  });
}

function emitDetailSnapshot(transactionId: string): void {
  detailListeners.get(transactionId)?.forEach((listener) => {
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

function normalizePageSize(value: number): StaffCirculationPageSize {
  if (
    STAFF_CIRCULATION_PAGE_SIZE_OPTIONS.includes(
      value as StaffCirculationPageSize,
    )
  ) {
    return value as StaffCirculationPageSize;
  }

  return 10;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDate(value: string): string {
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
  const normalizedFrom = normalizeDate(from);
  const normalizedTo = normalizeDate(to);

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

function getScopeSnapshot(scope: CirculationScope): ScopeSnapshot {
  return scopeSnapshots.get(scope)!;
}

function setScopeSnapshot(scope: CirculationScope, snapshot: ScopeSnapshot): void {
  scopeSnapshots.set(scope, snapshot);
  emitScopeSnapshot(scope);
}

function ensureDetailSnapshot(transactionId: string): DetailSnapshot {
  const existing = detailSnapshots.get(transactionId);

  if (existing) {
    return existing;
  }

  const created: DetailSnapshot = {
    queryKey: `staff-circulation:detail:${transactionId}`,
    transactionId,
    status: "idle",
    refreshing: false,
    invalidated: false,
    item: null,
    fetchedAt: null,
    error: null,
    errorStatus: null,
  };
  detailSnapshots.set(transactionId, created);
  return created;
}

function setDetailSnapshot(snapshot: DetailSnapshot): void {
  detailSnapshots.set(snapshot.transactionId, snapshot);
  emitDetailSnapshot(snapshot.transactionId);
}

function ensureQueueSnapshot(bookId: string): QueueSnapshot {
  const existing = queueSnapshots.get(bookId);

  if (existing) {
    return existing;
  }

  const created: QueueSnapshot = {
    queryKey: `staff-circulation:queue:${bookId}`,
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

function setQueueSnapshot(snapshot: QueueSnapshot): void {
  queueSnapshots.set(snapshot.bookId, snapshot);
  emitQueueSnapshot(snapshot.bookId);
}

function subscribeScope(scope: CirculationScope, listener: () => void): () => void {
  const listeners = scopeListeners.get(scope) ?? new Set<() => void>();
  listeners.add(listener);
  scopeListeners.set(scope, listeners);

  return () => {
    const currentListeners = scopeListeners.get(scope);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      scopeListeners.delete(scope);
    }
  };
}

function subscribeDetail(transactionId: string, listener: () => void): () => void {
  const listeners = detailListeners.get(transactionId) ?? new Set<() => void>();
  listeners.add(listener);
  detailListeners.set(transactionId, listeners);

  return () => {
    const currentListeners = detailListeners.get(transactionId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      detailListeners.delete(transactionId);
    }
  };
}

function subscribeQueue(bookId: string, listener: () => void): () => void {
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

async function refreshScopeStore(
  scope: CirculationScope,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<ScopeSnapshot> {
  const snapshot = getScopeSnapshot(scope);
  const hasLoadedData = snapshot.items.length > 0;

  if (snapshot.status === "loading" && !options.force) {
    return snapshot;
  }

  if (
    hasLoadedData &&
    !snapshot.invalidated &&
    !snapshot.error &&
    !options.force
  ) {
    return snapshot;
  }

  const requestVersion = (scopeRequestVersions.get(scope) ?? 0) + 1;
  scopeRequestVersions.set(scope, requestVersion);
  setScopeSnapshot(scope, {
    ...snapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getAllStaffCirculationLoans(scope, {
      signal: options.signal,
    });

    if (requestVersion !== scopeRequestVersions.get(scope)) {
      return getScopeSnapshot(scope);
    }

    const nextSnapshot: ScopeSnapshot = {
      queryKey: `staff-circulation:${scope}`,
      scope,
      status: "success",
      refreshing: false,
      invalidated: false,
      items: response.data.items,
      total: response.data.total,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };
    setScopeSnapshot(scope, nextSnapshot);
    return nextSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return getScopeSnapshot(scope);
    }

    if (requestVersion !== scopeRequestVersions.get(scope)) {
      return getScopeSnapshot(scope);
    }

    const failedSnapshot: ScopeSnapshot = {
      ...getScopeSnapshot(scope),
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(error, "Unable to load circulation loans."),
      errorStatus: isCirculationApiError(error) ? error.status : null,
    };
    setScopeSnapshot(scope, failedSnapshot);
    throw error;
  }
}

async function refreshDetailStore(
  transactionId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<DetailSnapshot> {
  const snapshot = ensureDetailSnapshot(transactionId);
  const hasLoadedData = Boolean(snapshot.item);

  if (snapshot.status === "loading" && !options.force) {
    return snapshot;
  }

  if (hasLoadedData && !snapshot.invalidated && !snapshot.error && !options.force) {
    return snapshot;
  }

  const requestVersion = (detailRequestVersions.get(transactionId) ?? 0) + 1;
  detailRequestVersions.set(transactionId, requestVersion);
  setDetailSnapshot({
    ...snapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getStaffCirculationLoanById(transactionId, {
      signal: options.signal,
    });

    if (requestVersion !== detailRequestVersions.get(transactionId)) {
      return ensureDetailSnapshot(transactionId);
    }

    const nextSnapshot: DetailSnapshot = {
      queryKey: `staff-circulation:detail:${transactionId}`,
      transactionId,
      status: "success",
      refreshing: false,
      invalidated: false,
      item: response.data.item,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };
    setDetailSnapshot(nextSnapshot);
    return nextSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return ensureDetailSnapshot(transactionId);
    }

    if (requestVersion !== detailRequestVersions.get(transactionId)) {
      return ensureDetailSnapshot(transactionId);
    }

    const failedSnapshot: DetailSnapshot = {
      ...ensureDetailSnapshot(transactionId),
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(error, "Unable to load this loan right now."),
      errorStatus: isCirculationApiError(error) ? error.status : null,
    };
    setDetailSnapshot(failedSnapshot);
    throw error;
  }
}

async function refreshQueueStore(
  bookId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<QueueSnapshot> {
  const snapshot = ensureQueueSnapshot(bookId);
  const hasLoadedData = Boolean(snapshot.item);

  if (snapshot.status === "loading" && !options.force) {
    return snapshot;
  }

  if (hasLoadedData && !snapshot.invalidated && !snapshot.error && !options.force) {
    return snapshot;
  }

  const requestVersion = (queueRequestVersions.get(bookId) ?? 0) + 1;
  queueRequestVersions.set(bookId, requestVersion);
  setQueueSnapshot({
    ...snapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getCirculationBookQueueStatus(bookId, {
      signal: options.signal,
    });

    if (requestVersion !== queueRequestVersions.get(bookId)) {
      return ensureQueueSnapshot(bookId);
    }

    const nextSnapshot: QueueSnapshot = {
      queryKey: `staff-circulation:queue:${bookId}`,
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
      return ensureQueueSnapshot(bookId);
    }

    if (requestVersion !== queueRequestVersions.get(bookId)) {
      return ensureQueueSnapshot(bookId);
    }

    const failedSnapshot: QueueSnapshot = {
      ...ensureQueueSnapshot(bookId),
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: getErrorMessage(error, "Unable to load queue visibility right now."),
      errorStatus: isCirculationApiError(error) ? error.status : null,
    };
    setQueueSnapshot(failedSnapshot);
    throw error;
  }
}

function invalidateAllScopeCaches(): void {
  SCOPE_KEYS.forEach((scope) => {
    const snapshot = getScopeSnapshot(scope);
    setScopeSnapshot(scope, {
      ...snapshot,
      invalidated: true,
    });
  });
}

async function refreshCirculationModuleAfterMutation(
  transactionId: string,
  options: {
    relatedBookId?: string | null;
  } = {},
): Promise<void> {
  invalidateAllScopeCaches();
  const detailSnapshot = detailSnapshots.get(transactionId);
  const queueSnapshot = options.relatedBookId
    ? queueSnapshots.get(options.relatedBookId)
    : null;

  await Promise.allSettled([
    ...SCOPE_KEYS.map((scope) =>
      refreshScopeStore(scope, {
        force: true,
      }),
    ),
    ...(detailSnapshot?.fetchedAt
      ? [
          refreshDetailStore(transactionId, {
            force: true,
          }),
        ]
      : []),
    ...(options.relatedBookId && queueSnapshot?.fetchedAt
      ? [
          refreshQueueStore(options.relatedBookId, {
            force: true,
          }),
        ]
      : []),
  ]);
}

function useCirculationMutationFeedback() {
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

export function useStaffCirculationScopeView(
  scope: CirculationScope,
  options: {
    autoLoad?: boolean;
    initialFilters?: Partial<StaffCirculationFilters>;
  } = {},
) {
  const subscribe = React.useCallback(
    (listener: () => void) => subscribeScope(scope, listener),
    [scope],
  );
  const getSnapshot = React.useCallback(() => getScopeSnapshot(scope), [scope]);
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [filters, setFilters] = React.useState<StaffCirculationFilters>({
    ...DEFAULT_FILTERS,
    ...options.initialFilters,
    page: Math.max(1, options.initialFilters?.page ?? DEFAULT_FILTERS.page),
    pageSize: normalizePageSize(
      options.initialFilters?.pageSize ?? DEFAULT_FILTERS.pageSize,
    ),
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

    void refreshScopeStore(scope).catch(() => {
      // Shared snapshot handles the visible error state.
    });
  }, [options.autoLoad, scope]);

  const normalizedSearchTerm = normalizeText(filters.searchTerm);
  const filteredItems = snapshot.items.filter((item) => {
    const matchesRole =
      filters.role === "all" || item.user_role === filters.role;
    const matchesBookStatus =
      filters.bookStatus === "all" || item.book_status === filters.bookStatus;
    const searchHaystack = [
      item.transaction_id,
      item.user_full_name,
      item.user_email ?? "",
      item.roll_number ?? "",
      item.employee_code ?? "",
      item.book_title,
      item.book_author,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      normalizedSearchTerm.length === 0
        ? true
        : searchHaystack.includes(normalizedSearchTerm);
    const matchesDueDate = matchesLocalDateWindow(
      item.due_date,
      filters.dueDateRange.from,
      filters.dueDateRange.to,
    );

    return matchesRole && matchesBookStatus && matchesSearch && matchesDueDate;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pageStart = (currentPage - 1) * filters.pageSize;
  const pagedItems = filteredItems.slice(pageStart, pageStart + filters.pageSize);
  const hasAppliedFilters =
    normalizeText(filters.searchTerm).length > 0 ||
    filters.role !== "all" ||
    filters.bookStatus !== "all" ||
    normalizeDate(filters.dueDateRange.from).length > 0 ||
    normalizeDate(filters.dueDateRange.to).length > 0;

  const updateFilters = React.useCallback(
    (next: Partial<StaffCirculationFilters>) => {
      setFilters((current) => ({
        ...current,
        ...next,
        page:
          next.page !== undefined
            ? Math.max(1, next.page)
            : next.pageSize !== undefined ||
                next.searchTerm !== undefined ||
                next.role !== undefined ||
                next.bookStatus !== undefined ||
                next.dueDateRange !== undefined
              ? 1
              : current.page,
        pageSize:
          next.pageSize !== undefined
            ? normalizePageSize(next.pageSize)
            : current.pageSize,
      }));
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    try {
      await refreshScopeStore(scope, {
        force: true,
      });
    } catch {
      // Shared snapshot stores the visible error state.
    }
  }, [scope]);

  return {
    queryKey: snapshot.queryKey,
    scope,
    status: snapshot.status,
    loading: snapshot.status === "loading" || isInitialAutoLoad,
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    items: pagedItems,
    allItems: snapshot.items,
    filteredItems,
    totalLoadedItems: snapshot.items.length,
    totalCount: snapshot.total,
    filteredCount: filteredItems.length,
    totalPages,
    hasData: snapshot.items.length > 0,
    hasStaleData: snapshot.items.length > 0 && Boolean(snapshot.error),
    hasAppliedFilters,
    filters: {
      ...filters,
      page: currentPage,
    },
    setSearchTerm: (searchTerm: string) => {
      updateFilters({ searchTerm });
    },
    setRoleFilter: (role: CirculationRoleFilter) => {
      updateFilters({ role });
    },
    setBookStatusFilter: (bookStatus: CirculationBookStatusFilter) => {
      updateFilters({ bookStatus });
    },
    setDueDateRange: (dueDateRange: { from: string; to: string }) => {
      updateFilters({ dueDateRange });
    },
    setPage: (page: number) => {
      updateFilters({ page });
    },
    setPageSize: (pageSize: number) => {
      updateFilters({ pageSize });
    },
    resetFilters: () => {
      setFilters(DEFAULT_FILTERS);
    },
    refresh,
    retry: refresh,
    pageSizeOptions: STAFF_CIRCULATION_PAGE_SIZE_OPTIONS,
  };
}

export function useStaffCirculationLoanDetail(
  transactionId: string | null,
  options: {
    autoLoad?: boolean;
  } = {},
) {
  const resolvedTransactionId = transactionId ?? "__missing__";
  const subscribe = React.useCallback(
    (listener: () => void) => subscribeDetail(resolvedTransactionId, listener),
    [resolvedTransactionId],
  );
  const getSnapshot = React.useCallback(
    () => ensureDetailSnapshot(resolvedTransactionId),
    [resolvedTransactionId],
  );
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  React.useEffect(() => {
    if (!options.autoLoad || !transactionId) {
      return;
    }

    void refreshDetailStore(transactionId).catch(() => {
      // Shared snapshot handles the visible error state.
    });
  }, [options.autoLoad, transactionId]);

  const refresh = React.useCallback(async () => {
    if (!transactionId) {
      return;
    }

    try {
      await refreshDetailStore(transactionId, {
        force: true,
      });
    } catch {
      // Shared snapshot handles the visible error state.
    }
  }, [transactionId]);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: Boolean(transactionId) && snapshot.status === "loading",
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    item: transactionId ? snapshot.item : null,
    hasData: Boolean(snapshot.item),
    hasStaleData: Boolean(snapshot.item && snapshot.error),
    refresh,
    retry: refresh,
  };
}

export function useCirculationBookQueueStatus(
  bookId: string | null,
  options: {
    autoLoad?: boolean;
  } = {},
) {
  const resolvedBookId = bookId ?? "__missing__";
  const subscribe = React.useCallback(
    (listener: () => void) => subscribeQueue(resolvedBookId, listener),
    [resolvedBookId],
  );
  const getSnapshot = React.useCallback(
    () => ensureQueueSnapshot(resolvedBookId),
    [resolvedBookId],
  );
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  React.useEffect(() => {
    if (!options.autoLoad || !bookId) {
      return;
    }

    void refreshQueueStore(bookId).catch(() => {
      // Shared snapshot handles the visible error state.
    });
  }, [bookId, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    if (!bookId) {
      return;
    }

    try {
      await refreshQueueStore(bookId, {
        force: true,
      });
    } catch {
      // Shared snapshot handles the visible error state.
    }
  }, [bookId]);

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
    refresh,
    retry: refresh,
  };
}

export function useAdjustCirculationDueDate() {
  const { reportMutationError } = useCirculationMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const adjustDueDate = React.useCallback(
    async (
      transactionId: string,
      payload: AdjustLoanDueDatePayload,
      options: { relatedBookId?: string | null } = {},
    ): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await adjustStaffCirculationLoanDueDate(transactionId, payload);
        await refreshCirculationModuleAfterMutation(transactionId, options);
        toast.success("Due date updated.", {
          id: `circulation-adjust-${transactionId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to update that due date right now.",
          toastId: `circulation-adjust-${transactionId}-error`,
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
    error,
    clearError,
    adjustDueDate,
  };
}

export function useReturnCirculationLoan() {
  const { reportMutationError } = useCirculationMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const returnLoan = React.useCallback(
    async (
      transactionId: string,
      options: { relatedBookId?: string | null } = {},
    ): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await returnStaffCirculationLoan(transactionId);
        await refreshCirculationModuleAfterMutation(transactionId, options);
        toast.success("Loan returned.", {
          id: `circulation-return-${transactionId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to return that loan right now.",
          toastId: `circulation-return-${transactionId}-error`,
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
    returnLoan,
  };
}

export function useRenewCirculationLoan() {
  const { reportMutationError } = useCirculationMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const renewLoan = React.useCallback(
    async (
      transactionId: string,
      options: { relatedBookId?: string | null } = {},
    ): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await renewStaffCirculationLoan(transactionId);
        await refreshCirculationModuleAfterMutation(transactionId, options);
        toast.success("Loan renewed.", {
          id: `circulation-renew-${transactionId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to renew that loan right now.",
          toastId: `circulation-renew-${transactionId}-error`,
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
    error,
    clearError,
    renewLoan,
  };
}
