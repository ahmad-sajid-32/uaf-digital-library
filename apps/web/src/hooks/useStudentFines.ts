"use client";

/**
 * Student fines hook/state boundary.
 *
 * Purpose:
 * - Keep student fine visibility state in one read-only module hook.
 * - Partition current versus history views truthfully inside the student module
 *   because the current backend reads are not yet cleanly split at the SQL
 *   layer.
 * - Preserve backend-owned fine truth while avoiding staff settlement logic in
 *   the student shell.
 */

import * as React from "react";

import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import {
  getStudentCurrentFines,
  getStudentFineHistory,
  isStudentFinesApiError,
} from "@/lib/api/student-fines";
import {
  isStudentCurrentFine,
  isStudentHistoricalFine,
  type StudentFineHistoryItem,
  type StudentFineItem,
  type StudentFineSection,
} from "@/lib/student-fines";

type AsyncStatus = "idle" | "loading" | "success" | "error";

interface StudentFineSectionState<TItem> {
  status: AsyncStatus;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  errorStatus: number | null;
  items: TItem[];
  hasData: boolean;
  hasStaleData: boolean;
  isEmpty: boolean;
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

export function useStudentFines(options: {
  autoLoad?: boolean;
  initialSection?: StudentFineSection;
} = {}) {
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const [section, setSection] = React.useState<StudentFineSection>(
    options.initialSection ?? "current",
  );

  const [currentStatus, setCurrentStatus] = React.useState<AsyncStatus>("idle");
  const [currentItems, setCurrentItems] = React.useState<StudentFineItem[]>([]);
  const [currentError, setCurrentError] = React.useState<string | null>(null);
  const [currentErrorStatus, setCurrentErrorStatus] = React.useState<number | null>(
    null,
  );
  const [currentRefreshing, setCurrentRefreshing] = React.useState(false);

  const [historyStatus, setHistoryStatus] = React.useState<AsyncStatus>("idle");
  const [historyItems, setHistoryItems] = React.useState<StudentFineHistoryItem[]>([]);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [historyErrorStatus, setHistoryErrorStatus] = React.useState<number | null>(
    null,
  );
  const [historyRefreshing, setHistoryRefreshing] = React.useState(false);

  const currentRequestVersionRef = React.useRef(0);
  const historyRequestVersionRef = React.useRef(0);
  const currentItemsRef = React.useRef<StudentFineItem[]>([]);
  const historyItemsRef = React.useRef<StudentFineHistoryItem[]>([]);
  const currentStatusRef = React.useRef<AsyncStatus>("idle");
  const historyStatusRef = React.useRef<AsyncStatus>("idle");

  React.useEffect(() => {
    currentItemsRef.current = currentItems;
  }, [currentItems]);

  React.useEffect(() => {
    historyItemsRef.current = historyItems;
  }, [historyItems]);

  React.useEffect(() => {
    currentStatusRef.current = currentStatus;
  }, [currentStatus]);

  React.useEffect(() => {
    historyStatusRef.current = historyStatus;
  }, [historyStatus]);

  const loadCurrentFines = React.useCallback(
    async (requestOptions: {
      signal?: AbortSignal;
      preserveCurrent?: boolean;
    } = {}) => {
      const requestVersion = ++currentRequestVersionRef.current;
      const hasLoadedRows = currentItemsRef.current.length > 0;
      const preserveCurrent = Boolean(
        requestOptions.preserveCurrent ?? hasLoadedRows,
      );

      setCurrentError(null);
      setCurrentErrorStatus(null);

      if (preserveCurrent) {
        setCurrentRefreshing(true);
      } else {
        setCurrentStatus("loading");
      }

      try {
        const response = await getStudentCurrentFines({
          signal: requestOptions.signal,
        });

        if (currentRequestVersionRef.current !== requestVersion) {
          return;
        }

        setCurrentItems(response.data.items.filter(isStudentCurrentFine));
        setCurrentStatus("success");
        setCurrentRefreshing(false);
      } catch (requestError: unknown) {
        if (
          isAbortError(requestError)
          || currentRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        const recovered = await recoverFromSessionFailure(requestError, {
          toastId: "student-fines-current-session",
        });

        if (recovered || currentRequestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to load your current fines right now.",
        );
        const nextErrorStatus = isStudentFinesApiError(requestError)
          ? requestError.status
          : null;

        setCurrentRefreshing(false);
        setCurrentError(message);
        setCurrentErrorStatus(nextErrorStatus);

        if (hasLoadedRows) {
          setCurrentStatus("success");
          return;
        }

        setCurrentStatus("error");
      }
    },
    [recoverFromSessionFailure],
  );

  const loadHistoryFines = React.useCallback(
    async (requestOptions: {
      signal?: AbortSignal;
      preserveCurrent?: boolean;
    } = {}) => {
      const requestVersion = ++historyRequestVersionRef.current;
      const hasLoadedRows = historyItemsRef.current.length > 0;
      const preserveCurrent = Boolean(
        requestOptions.preserveCurrent ?? hasLoadedRows,
      );

      setHistoryError(null);
      setHistoryErrorStatus(null);

      if (preserveCurrent) {
        setHistoryRefreshing(true);
      } else {
        setHistoryStatus("loading");
      }

      try {
        const response = await getStudentFineHistory({
          signal: requestOptions.signal,
        });

        if (historyRequestVersionRef.current !== requestVersion) {
          return;
        }

        setHistoryItems(
          response.data.items.filter(isStudentHistoricalFine),
        );
        setHistoryStatus("success");
        setHistoryRefreshing(false);
      } catch (requestError: unknown) {
        if (
          isAbortError(requestError)
          || historyRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        const recovered = await recoverFromSessionFailure(requestError, {
          toastId: "student-fines-history-session",
        });

        if (recovered || historyRequestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to load your fine history right now.",
        );
        const nextErrorStatus = isStudentFinesApiError(requestError)
          ? requestError.status
          : null;

        setHistoryRefreshing(false);
        setHistoryError(message);
        setHistoryErrorStatus(nextErrorStatus);

        if (hasLoadedRows) {
          setHistoryStatus("success");
          return;
        }

        setHistoryStatus("error");
      }
    },
    [recoverFromSessionFailure],
  );

  React.useEffect(() => {
    if (!options.autoLoad) {
      return;
    }

    const controller = new AbortController();
    void Promise.allSettled([
      loadCurrentFines({
        signal: controller.signal,
      }),
      loadHistoryFines({
        signal: controller.signal,
      }),
    ]);

    return () => {
      controller.abort();
    };
  }, [loadCurrentFines, loadHistoryFines, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    await Promise.allSettled([
      loadCurrentFines({
        preserveCurrent:
          currentItemsRef.current.length > 0 || currentStatusRef.current === "success",
      }),
      loadHistoryFines({
        preserveCurrent:
          historyItemsRef.current.length > 0 || historyStatusRef.current === "success",
      }),
    ]);
  }, [loadCurrentFines, loadHistoryFines]);

  const current: StudentFineSectionState<StudentFineItem> = {
    status: currentStatus,
    loading: currentStatus === "loading",
    refreshing: currentRefreshing,
    error: currentError,
    errorStatus: currentErrorStatus,
    items: currentItems,
    hasData: currentItems.length > 0,
    hasStaleData: currentItems.length > 0 && Boolean(currentError),
    isEmpty: currentStatus === "success" && currentItems.length === 0,
  };

  const history: StudentFineSectionState<StudentFineHistoryItem> = {
    status: historyStatus,
    loading: historyStatus === "loading",
    refreshing: historyRefreshing,
    error: historyError,
    errorStatus: historyErrorStatus,
    items: historyItems,
    hasData: historyItems.length > 0,
    hasStaleData: historyItems.length > 0 && Boolean(historyError),
    isEmpty: historyStatus === "success" && historyItems.length === 0,
  };

  return {
    section,
    setSection,
    current,
    history,
    refresh,
    retry: refresh,
  };
}
