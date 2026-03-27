// apps/web/src/hooks/useAdmin.ts
/**
 * Unified admin module hook/state boundary.
 *
 * Purpose:
 * - Keep the admin users module hook logic in one file, matching the locked
 *   frontend convention for module-scoped hook ownership.
 * - Centralize list/detail cache state, role-aware mutations, local view-state
 *   derivation, and module-only helper types without introducing a second data
 *   stack into the repo.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  createAdminAccount,
  createLibrarianAccount,
  createStudentAccount,
  deleteAdminManagedUser,
  getAllAdminManagedUsers,
  getAdminManagedUserById,
  isAdminApiError,
  updateAdminManagedUserProfile,
  updateAdminManagedUserStatus,
  type AdminCreatedUser,
  type AdminManagedUser,
  type AdminManagedUserDetail,
  type CreateAdminPayload,
  type CreateLibrarianPayload,
  type CreateStudentPayload,
  type UpdateAdminManagedUserProfilePayload,
} from "@/lib/api/admin";
import type { AppRole } from "@/lib/auth/types";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";

export type AdminUsersActivityFilter = "all" | "active" | "inactive";
export type AdminUsersListStatus = "idle" | "loading" | "success" | "error";
export type AdminUsersRoleFilter = AppRole | "all";
export const ADMIN_USERS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type AdminUsersPageSize = (typeof ADMIN_USERS_PAGE_SIZE_OPTIONS)[number];

export interface AdminUsersLocalFilters {
  searchTerm: string;
  role: AdminUsersRoleFilter;
  activity: AdminUsersActivityFilter;
  page: number;
  pageSize: number;
}

export interface CreateStudentAdminUserInput {
  role: "student";
  payload: CreateStudentPayload;
}

export interface CreateLibrarianAdminUserInput {
  role: "librarian";
  payload: CreateLibrarianPayload;
}

export interface CreateAdminAdminUserInput {
  role: "admin";
  payload: CreateAdminPayload;
}

export type CreateAdminManagedUserInput =
  | CreateStudentAdminUserInput
  | CreateLibrarianAdminUserInput
  | CreateAdminAdminUserInput;

interface AdminUsersListCacheSnapshot {
  queryKey: string;
  status: AdminUsersListStatus;
  refreshing: boolean;
  invalidated: boolean;
  items: AdminManagedUser[];
  total: number;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

interface AdminUserDetailCacheSnapshot {
  queryKey: string;
  userId: string;
  status: AdminUsersListStatus;
  refreshing: boolean;
  invalidated: boolean;
  user: AdminManagedUserDetail | null;
  fetchedAt: number | null;
  error: string | null;
  errorStatus: number | null;
}

type AdminUsersTabId = AppRole;

interface AdminUsersTabControls {
  searchTerm: string;
  activity: AdminUsersActivityFilter;
  page: number;
  pageSize: number;
}

interface MutationErrorOptions {
  fallbackMessage: string;
  toastId: string;
}

const ADMIN_USERS_QUERY_KEYS = {
  list: "admin-users:list",
  detail: (userId: string) => `admin-users:detail:${userId}`,
} as const;

const DEFAULT_FILTERS: AdminUsersLocalFilters = {
  searchTerm: "",
  role: "all",
  activity: "all",
  page: 1,
  pageSize: 10,
};

const ROLE_TABS: readonly AdminUsersTabId[] = [
  "admin",
  "librarian",
  "student",
] as const;

const DEFAULT_TAB_CONTROLS: AdminUsersTabControls = {
  searchTerm: "",
  activity: "all",
  page: 1,
  pageSize: 10,
};

const listListeners = new Set<() => void>();
const detailListeners = new Map<string, Set<() => void>>();
const detailSnapshots = new Map<string, AdminUserDetailCacheSnapshot>();
const detailRequestVersions = new Map<string, number>();

let listRequestVersion = 0;
let listSnapshot: AdminUsersListCacheSnapshot = {
  queryKey: ADMIN_USERS_QUERY_KEYS.list,
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

function emitDetailSnapshot(userId: string): void {
  detailListeners.get(userId)?.forEach((listener) => {
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

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAdminUsersPageSize(value: number): AdminUsersPageSize {
  if (
    ADMIN_USERS_PAGE_SIZE_OPTIONS.includes(
      value as AdminUsersPageSize,
    )
  ) {
    return value as AdminUsersPageSize;
  }

  return 10;
}

function createInitialControls(): Record<AdminUsersTabId, AdminUsersTabControls> {
  return {
    admin: { ...DEFAULT_TAB_CONTROLS },
    librarian: { ...DEFAULT_TAB_CONTROLS },
    student: { ...DEFAULT_TAB_CONTROLS },
  };
}

function ensureDetailSnapshot(userId: string): AdminUserDetailCacheSnapshot {
  const existing = detailSnapshots.get(userId);

  if (existing) {
    return existing;
  }

  const created: AdminUserDetailCacheSnapshot = {
    queryKey: ADMIN_USERS_QUERY_KEYS.detail(userId),
    userId,
    status: "idle",
    refreshing: false,
    invalidated: false,
    user: null,
    fetchedAt: null,
    error: null,
    errorStatus: null,
  };

  detailSnapshots.set(userId, created);
  return created;
}

function setDetailSnapshot(
  userId: string,
  snapshot: AdminUserDetailCacheSnapshot,
): void {
  detailSnapshots.set(userId, snapshot);
  emitDetailSnapshot(userId);
}

function subscribeAdminUsersListStore(listener: () => void): () => void {
  listListeners.add(listener);

  return () => {
    listListeners.delete(listener);
  };
}

function getAdminUsersListSnapshot(): AdminUsersListCacheSnapshot {
  return listSnapshot;
}

function subscribeAdminUserDetailStore(
  userId: string,
  listener: () => void,
): () => void {
  const listeners = detailListeners.get(userId) ?? new Set<() => void>();
  listeners.add(listener);
  detailListeners.set(userId, listeners);

  return () => {
    const currentListeners = detailListeners.get(userId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      detailListeners.delete(userId);
    }
  };
}

function getAdminUserDetailSnapshot(
  userId: string,
): AdminUserDetailCacheSnapshot {
  return ensureDetailSnapshot(userId);
}

function invalidateAdminUsersListCache(): void {
  listSnapshot = {
    ...listSnapshot,
    invalidated: true,
  };
  emitListSnapshot();
}

function invalidateAdminUserDetailCache(userId: string): void {
  const snapshot = ensureDetailSnapshot(userId);
  setDetailSnapshot(userId, {
    ...snapshot,
    invalidated: true,
  });
}

function clearAdminUserDetailCache(userId: string): void {
  detailSnapshots.delete(userId);
  detailRequestVersions.delete(userId);
  emitDetailSnapshot(userId);
}

function removeAdminUserFromListCache(userId: string): void {
  const nextItems = listSnapshot.items.filter((item) => item.user_id !== userId);

  listSnapshot = {
    ...listSnapshot,
    items: nextItems,
    total: nextItems.length,
  };
  emitListSnapshot();
}

export function normalizeAdminManagedUserRole(role: string): AppRole | null {
  const normalized = role.trim().toLowerCase();

  if (
    normalized === "student"
    || normalized === "librarian"
    || normalized === "admin"
  ) {
    return normalized;
  }

  return null;
}

function toAdminManagedUserListShape(
  user: AdminManagedUserDetail,
): AdminManagedUser {
  switch (user.role) {
    case "STUDENT":
      return {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        full_name: user.full_name,
        roll_number: user.student_profile.roll_number,
        department: user.student_profile.department,
        semester: user.student_profile.semester,
        employee_code: null,
        designation: null,
        created_at: user.created_at,
      };
    case "LIBRARIAN":
      return {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        full_name: user.full_name,
        roll_number: null,
        department: user.librarian_profile.department,
        semester: null,
        employee_code: user.librarian_profile.employee_code,
        designation: null,
        created_at: user.created_at,
      };
    case "ADMIN":
      return {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        full_name: user.full_name,
        roll_number: null,
        department: null,
        semester: null,
        employee_code: null,
        designation: user.admin_profile.designation,
        created_at: user.created_at,
      };
  }
}

function upsertAdminUserListItem(item: AdminManagedUser): void {
  if (listSnapshot.status === "idle") {
    return;
  }

  const existingIndex = listSnapshot.items.findIndex(
    (currentItem) => currentItem.user_id === item.user_id,
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

async function refreshAdminUsersListStore(
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<AdminUsersListCacheSnapshot> {
  const hasLoadedData = listSnapshot.items.length > 0;

  if (listSnapshot.status === "loading" && !options.force) {
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
    const response = await getAllAdminManagedUsers({
      signal: options.signal,
    });

    if (requestVersion !== listRequestVersion) {
      return listSnapshot;
    }

    listSnapshot = {
      queryKey: ADMIN_USERS_QUERY_KEYS.list,
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

    const message = getErrorMessage(
      error,
      "Unable to load admin users right now.",
    );

    listSnapshot = {
      ...listSnapshot,
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: message,
      errorStatus: isAdminApiError(error) ? error.status : null,
    };
    emitListSnapshot();
    throw error;
  }
}

async function refreshAdminUserDetailStore(
  userId: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<AdminUserDetailCacheSnapshot> {
  const currentSnapshot = ensureDetailSnapshot(userId);
  const hasLoadedData = Boolean(currentSnapshot.user);

  if (currentSnapshot.status === "loading" && !options.force) {
    return currentSnapshot;
  }

  const requestVersion = (detailRequestVersions.get(userId) ?? 0) + 1;
  detailRequestVersions.set(userId, requestVersion);
  setDetailSnapshot(userId, {
    ...currentSnapshot,
    status: hasLoadedData ? "success" : "loading",
    refreshing: hasLoadedData,
    invalidated: false,
    error: null,
    errorStatus: null,
  });

  try {
    const response = await getAdminManagedUserById(userId, {
      signal: options.signal,
    });

    if (detailRequestVersions.get(userId) !== requestVersion) {
      return ensureDetailSnapshot(userId);
    }

    const nextSnapshot: AdminUserDetailCacheSnapshot = {
      queryKey: ADMIN_USERS_QUERY_KEYS.detail(userId),
      userId,
      status: "success",
      refreshing: false,
      invalidated: false,
      user: response.data.user,
      fetchedAt: Date.now(),
      error: null,
      errorStatus: null,
    };

    setDetailSnapshot(userId, nextSnapshot);
    upsertAdminUserListItem(toAdminManagedUserListShape(response.data.user));
    return nextSnapshot;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return ensureDetailSnapshot(userId);
    }

    if (detailRequestVersions.get(userId) !== requestVersion) {
      return ensureDetailSnapshot(userId);
    }

    const message = getErrorMessage(
      error,
      "Unable to load that user right now.",
    );

    const failedSnapshot: AdminUserDetailCacheSnapshot = {
      ...ensureDetailSnapshot(userId),
      status: hasLoadedData ? "success" : "error",
      refreshing: false,
      invalidated: hasLoadedData,
      error: message,
      errorStatus: isAdminApiError(error) ? error.status : null,
    };

    setDetailSnapshot(userId, failedSnapshot);
    throw error;
  }
}

function getCreateSuccessMessage(role: CreateAdminManagedUserInput["role"]): string {
  switch (role) {
    case "student":
      return "Student account created successfully.";
    case "librarian":
      return "Librarian account created successfully.";
    case "admin":
      return "Admin account created successfully.";
  }
}

function useAdminUsersMutationFeedback() {
  const { recoverFromSessionFailure } = useAuthSessionActions();

  const reportMutationError = React.useCallback(
    async (
      error: unknown,
      options: MutationErrorOptions,
    ): Promise<string> => {
      const recovered = await recoverFromSessionFailure(error, {
        toastId: `${options.toastId}-session`,
      });

      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : options.fallbackMessage;

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

export function useAdminUserDetail(
  userId: string | null,
  options: {
    autoLoad?: boolean;
  } = {},
) {
  const resolvedUserId = userId ?? "__missing__";
  const subscribe = React.useCallback(
    (listener: () => void) =>
      subscribeAdminUserDetailStore(resolvedUserId, listener),
    [resolvedUserId],
  );
  const getSnapshot = React.useCallback(
    () => getAdminUserDetailSnapshot(resolvedUserId),
    [resolvedUserId],
  );
  const snapshot = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  React.useEffect(() => {
    if (!options.autoLoad || !userId) {
      return;
    }

    void refreshAdminUserDetailStore(userId).catch(() => {
      // Errors are kept in the shared snapshot for consuming screens.
    });
  }, [options.autoLoad, userId]);

  const refresh = React.useCallback(async () => {
    if (!userId) {
      return;
    }

    await refreshAdminUserDetailStore(userId, {
      force: true,
    });
  }, [userId]);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: Boolean(userId) && snapshot.status === "loading",
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    errorStatus: snapshot.errorStatus,
    fetchedAt: snapshot.fetchedAt,
    user: userId ? snapshot.user : null,
    hasData: Boolean(snapshot.user),
    hasStaleData: Boolean(snapshot.user && snapshot.error),
    refresh,
    retry,
  };
}

export function useAdminUsersList(options: {
  autoLoad?: boolean;
  initialFilters?: Partial<AdminUsersLocalFilters>;
} = {}) {
  const snapshot = React.useSyncExternalStore(
    subscribeAdminUsersListStore,
    getAdminUsersListSnapshot,
    getAdminUsersListSnapshot,
  );
  const [filters, setFilters] = React.useState<AdminUsersLocalFilters>({
    ...DEFAULT_FILTERS,
    ...options.initialFilters,
  });

  React.useEffect(() => {
    if (!options.autoLoad) {
      return;
    }

    void refreshAdminUsersListStore().catch(() => {
      // Errors are exposed through the shared snapshot for page-level handling.
    });
  }, [options.autoLoad]);

  const normalizedSearchTerm = normalizeSearchTerm(filters.searchTerm);
  const filteredItems = snapshot.items.filter((item) => {
    const normalizedRole = normalizeAdminManagedUserRole(item.role);
    const matchesRole =
      filters.role === "all" || normalizedRole === filters.role;
    const matchesActivity =
      filters.activity === "all"
        ? true
        : filters.activity === "active"
          ? item.is_active
          : !item.is_active;
    const searchHaystack = [
      item.email,
      item.full_name,
      item.roll_number ?? "",
      item.employee_code ?? "",
      item.department ?? "",
      item.designation ?? "",
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      normalizedSearchTerm.length === 0
        ? true
        : searchHaystack.includes(normalizedSearchTerm);

    return matchesRole && matchesActivity && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pageStart = (currentPage - 1) * filters.pageSize;
  const pageItems = filteredItems.slice(pageStart, pageStart + filters.pageSize);

  const updateFilters = React.useCallback(
    (next: Partial<AdminUsersLocalFilters>) => {
      setFilters((current) => ({
        ...current,
        ...next,
        page:
          next.page !== undefined
            ? next.page
            : next.pageSize !== undefined
              || next.searchTerm !== undefined
              || next.role !== undefined
              || next.activity !== undefined
              ? 1
              : current.page,
      }));
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    await refreshAdminUsersListStore({
      force: true,
    });
  }, []);

  const retry = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  const invalidate = React.useCallback(() => {
    invalidateAdminUsersListCache();
  }, []);

  return {
    queryKey: snapshot.queryKey,
    status: snapshot.status as AdminUsersListStatus,
    loading: snapshot.status === "loading",
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
    isEmpty: snapshot.status === "success" && filteredItems.length === 0,
    hasData: snapshot.items.length > 0,
    hasStaleData: snapshot.items.length > 0 && Boolean(snapshot.error),
    filters: {
      ...filters,
      page: currentPage,
    },
    totalPages,
    setSearchTerm: (searchTerm: string) => {
      updateFilters({
        searchTerm,
      });
    },
    setRoleFilter: (role: AdminUsersRoleFilter) => {
      updateFilters({
        role,
      });
    },
    setActivityFilter: (activity: AdminUsersActivityFilter) => {
      updateFilters({
        activity,
      });
    },
    setPage: (page: number) => {
      updateFilters({
        page: Math.max(1, page),
      });
    },
    setPageSize: (pageSize: number) => {
      updateFilters({
        pageSize: normalizeAdminUsersPageSize(pageSize),
      });
    },
    resetFilters: () => {
      setFilters(DEFAULT_FILTERS);
    },
    refresh,
    retry,
    invalidate,
  };
}

export function useAdminUsersTabsView(options: {
  autoLoad?: boolean;
} = {}) {
  const snapshot = React.useSyncExternalStore(
    subscribeAdminUsersListStore,
    getAdminUsersListSnapshot,
    getAdminUsersListSnapshot,
  );
  const [activeTab, setActiveTab] = React.useState<AdminUsersTabId>("admin");
  const [controlsByTab, setControlsByTab] = React.useState(createInitialControls);
  const isInitialAutoLoad =
    Boolean(options.autoLoad)
    && snapshot.status === "idle"
    && snapshot.items.length === 0
    && snapshot.error === null;

  React.useEffect(() => {
    if (!options.autoLoad) {
      return;
    }

    void refreshAdminUsersListStore().catch(() => {
      // The screen consumes error state from the shared snapshot.
    });
  }, [options.autoLoad]);

  const tabViews = ROLE_TABS.reduce((accumulator, role) => {
    const controls = controlsByTab[role];
    const normalizedSearchTerm = normalizeSearchTerm(controls.searchTerm);
    const roleServerItems = snapshot.items.filter((item) => {
      const normalizedRole = normalizeAdminManagedUserRole(item.role);

      return normalizedRole === role;
    });
    const roleItems = roleServerItems.filter((item) => {
      const matchesActivity =
        controls.activity === "all"
          ? true
          : controls.activity === "active"
            ? item.is_active
            : !item.is_active;
      const searchHaystack = [
        item.full_name,
        item.email,
        item.department ?? "",
        item.roll_number ?? "",
        item.employee_code ?? "",
        item.designation ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        normalizedSearchTerm.length === 0
          ? true
          : searchHaystack.includes(normalizedSearchTerm);

      return matchesActivity && matchesSearch;
    });
    const hasAppliedFilters =
      normalizedSearchTerm.length > 0 || controls.activity !== "all";

    const totalPages = Math.max(1, Math.ceil(roleItems.length / controls.pageSize));
    const page = Math.min(controls.page, totalPages);
    const startIndex = (page - 1) * controls.pageSize;

    accumulator[role] = {
      role,
      label: role.charAt(0).toUpperCase() + role.slice(1),
      controls: {
        ...controls,
        page,
      },
      hasAppliedFilters,
      serverTotalItems: roleServerItems.length,
      totalItems: roleItems.length,
      totalPages,
      pagedItems: roleItems.slice(startIndex, startIndex + controls.pageSize),
      allItems: roleItems,
      empty: roleItems.length === 0,
    };

    return accumulator;
  }, {} as Record<AdminUsersTabId, {
    role: AdminUsersTabId;
    label: string;
    controls: AdminUsersTabControls;
    hasAppliedFilters: boolean;
    serverTotalItems: number;
    totalItems: number;
    totalPages: number;
    pagedItems: typeof snapshot.items;
    allItems: typeof snapshot.items;
    empty: boolean;
  }>);

  const updateTabControls = React.useCallback(
    (
      role: AdminUsersTabId,
      next: Partial<AdminUsersTabControls>,
    ) => {
      setControlsByTab((current) => {
        const currentTab = current[role];

        return {
          ...current,
          [role]: {
            ...currentTab,
            ...next,
            page:
              next.page !== undefined
                ? next.page
                : next.pageSize !== undefined
                  || next.searchTerm !== undefined
                  || next.activity !== undefined
                  ? 1
                  : currentTab.page,
          },
        };
      });
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    await refreshAdminUsersListStore({
      force: true,
    });
  }, []);

  return {
    activeTab,
    setActiveTab: (value: string) => {
      if (value === "admin" || value === "librarian" || value === "student") {
        setActiveTab(value);
      }
    },
    tabs: ROLE_TABS.map((role) => tabViews[role]),
    tabViews,
    queryKey: snapshot.queryKey,
    status: snapshot.status,
    loading: snapshot.status === "loading" || isInitialAutoLoad,
    refreshing: snapshot.refreshing,
    invalidated: snapshot.invalidated,
    error: snapshot.error,
    fetchedAt: snapshot.fetchedAt,
    totalCount: snapshot.total,
    totalLoadedItems: snapshot.items.length,
    hasData: snapshot.items.length > 0,
    hasStaleData: snapshot.items.length > 0 && Boolean(snapshot.error),
    refresh,
    retry: refresh,
    setSearchTerm: (role: AdminUsersTabId, searchTerm: string) => {
      updateTabControls(role, {
        searchTerm,
      });
    },
    setActivityFilter: (role: AdminUsersTabId, activity: AdminUsersActivityFilter) => {
      updateTabControls(role, {
        activity,
      });
    },
    setPage: (role: AdminUsersTabId, page: number) => {
      updateTabControls(role, {
        page: Math.max(1, page),
      });
    },
    setPageSize: (role: AdminUsersTabId, pageSize: number) => {
      updateTabControls(role, {
        pageSize: normalizeAdminUsersPageSize(pageSize),
      });
    },
    pageSizeOptions: ADMIN_USERS_PAGE_SIZE_OPTIONS,
  };
}

export function useCreateAdminManagedUser() {
  const { reportMutationError } = useAdminUsersMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const createUser = React.useCallback(
    async (input: CreateAdminManagedUserInput): Promise<AdminCreatedUser | null> => {
      setPending(true);
      setError(null);

      try {
        const response =
          input.role === "student"
            ? await createStudentAccount(input.payload)
            : input.role === "librarian"
              ? await createLibrarianAccount(input.payload)
              : await createAdminAccount(input.payload);

        invalidateAdminUsersListCache();
        await Promise.allSettled([
          refreshAdminUsersListStore({
            force: true,
          }),
          refreshAdminUserDetailStore(response.data.user_id, {
            force: true,
          }),
        ]);

        toast.success(getCreateSuccessMessage(input.role), {
          id: `admin-users-create-${input.role}`,
        });
        return response.data;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to create that account right now.",
          toastId: `admin-users-create-${input.role}-error`,
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
    createUser,
  };
}

export function useUpdateAdminUserProfile() {
  const { reportMutationError } = useAdminUsersMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const updateProfile = React.useCallback(
    async (
      userId: string,
      payload: UpdateAdminManagedUserProfilePayload,
    ): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await updateAdminManagedUserProfile(userId, payload);
        invalidateAdminUserDetailCache(userId);
        invalidateAdminUsersListCache();
        await Promise.allSettled([
          refreshAdminUserDetailStore(userId, {
            force: true,
          }),
          refreshAdminUsersListStore({
            force: true,
          }),
        ]);

        toast.success("User profile updated successfully.", {
          id: `admin-users-profile-${userId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to update that user right now.",
          toastId: `admin-users-profile-${userId}-error`,
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
    updateProfile,
  };
}

export function useUpdateAdminUserStatus() {
  const { reportMutationError } = useAdminUsersMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const updateStatus = React.useCallback(
    async (userId: string, isActive: boolean): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await updateAdminManagedUserStatus(userId, {
          is_active: isActive,
        });
        invalidateAdminUserDetailCache(userId);
        invalidateAdminUsersListCache();
        await Promise.allSettled([
          refreshAdminUserDetailStore(userId, {
            force: true,
          }),
          refreshAdminUsersListStore({
            force: true,
          }),
        ]);

        toast.success(
          isActive
            ? "User reactivated successfully."
            : "User deactivated successfully.",
          {
            id: `admin-users-status-${userId}`,
          },
        );
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to change that user status right now.",
          toastId: `admin-users-status-${userId}-error`,
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
    updateStatus,
  };
}

export function useDeleteAdminUser() {
  const { reportMutationError } = useAdminUsersMutationFeedback();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const deleteUser = React.useCallback(
    async (userId: string): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await deleteAdminManagedUser(userId);
        clearAdminUserDetailCache(userId);
        removeAdminUserFromListCache(userId);
        invalidateAdminUsersListCache();
        await refreshAdminUsersListStore({
          force: true,
        });

        toast.success("User deleted successfully.", {
          id: `admin-users-delete-${userId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const message = await reportMutationError(mutationError, {
          fallbackMessage: "Unable to delete that user right now.",
          toastId: `admin-users-delete-${userId}-error`,
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
    deleteUser,
  };
}
