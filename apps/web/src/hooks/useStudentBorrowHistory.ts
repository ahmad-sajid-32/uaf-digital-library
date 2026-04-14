"use client";

/**
 * Student borrow-history hook/state boundary.
 *
 * Purpose:
 * - Keep the read-only student borrow-history workspace in one module-scoped
 *   hook.
 * - Preserve the separation between active borrow lifecycle actions and
 *   historical borrow reads.
 * - Surface authenticated failures and stale-data refresh outcomes without
 *   inventing unsupported history behavior.
 */

import * as React from "react";

import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import { getStudentBorrowHistory } from "@/lib/api/student-borrow-history";
import {
  DEFAULT_STUDENT_BORROW_HISTORY_LIMIT,
  type StudentBorrowHistoryItem,
} from "@/lib/student-borrow-history";

type AsyncStatus = "idle" | "loading" | "success" | "error";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function isAbortError(error: unknown): boolean {
  return Boolean(error instanceof Error && error.name === "AbortError");
}

export function useStudentBorrowHistory(
  options: { autoLoad?: boolean; limit?: number } = {},
) {
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const requestedLimit = options.limit ?? DEFAULT_STUDENT_BORROW_HISTORY_LIMIT;

  const [status, setStatus] = React.useState<AsyncStatus>("idle");
  const [items, setItems] = React.useState<StudentBorrowHistoryItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const requestVersionRef = React.useRef(0);
  const itemsRef = React.useRef<StudentBorrowHistoryItem[]>([]);
  const statusRef = React.useRef<AsyncStatus>("idle");

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadHistory = React.useCallback(
    async (requestOptions: {
      signal?: AbortSignal;
      preserveCurrent?: boolean;
    } = {}) => {
      const requestVersion = ++requestVersionRef.current;
      const hasLoadedRows = itemsRef.current.length > 0;
      const preserveCurrent = Boolean(
        requestOptions.preserveCurrent ?? hasLoadedRows,
      );

      setError(null);

      if (preserveCurrent) {
        setRefreshing(true);
      } else {
        setStatus("loading");
      }

      try {
        const response = await getStudentBorrowHistory({
          limit: requestedLimit,
          signal: requestOptions.signal,
        });

        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        setItems(response.data.items);
        setStatus("success");
        setRefreshing(false);
      } catch (requestError: unknown) {
        if (
          isAbortError(requestError)
          || requestVersionRef.current !== requestVersion
        ) {
          return;
        }

        const recovered = await recoverFromSessionFailure(requestError, {
          toastId: "student-borrow-history-session",
        });

        if (recovered || requestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to load your borrow history right now.",
        );

        setRefreshing(false);
        setError(message);

        if (hasLoadedRows) {
          setStatus("success");
          return;
        }

        setStatus("error");
      }
    },
    [recoverFromSessionFailure, requestedLimit],
  );

  React.useEffect(() => {
    if (!options.autoLoad) {
      return;
    }

    const controller = new AbortController();
    void loadHistory({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadHistory, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    await loadHistory({
      preserveCurrent:
        itemsRef.current.length > 0 || statusRef.current === "success",
    });
  }, [loadHistory]);

  return {
    status,
    loading: status === "loading",
    refreshing,
    error,
    items,
    limit: requestedLimit,
    hasData: items.length > 0,
    hasStaleData: items.length > 0 && Boolean(error),
    isEmpty: status === "success" && items.length === 0,
    refresh,
    retry: refresh,
  };
}
