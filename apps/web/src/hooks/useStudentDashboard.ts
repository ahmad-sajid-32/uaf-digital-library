"use client";

/**
 * Student dashboard hook/state boundary.
 *
 * Purpose:
 * - Keep the student dashboard overview state in one module hook.
 * - Preserve backend-owned overview truth while keeping the screen component
 *   presentation-focused.
 * - Recover cleanly from expired authenticated sessions.
 */

import * as React from "react";

import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import {
  getStudentDashboard,
  isStudentDashboardApiError,
} from "@/lib/api/student-dashboard";
import {
  hasStudentDashboardContent,
  isStudentDashboardQuiet,
  type StudentDashboardData,
} from "@/lib/student-dashboard";

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

export function useStudentDashboard(options: {
  autoLoad?: boolean;
} = {}) {
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const [status, setStatus] = React.useState<AsyncStatus>("idle");
  const [dashboard, setDashboard] = React.useState<StudentDashboardData | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const requestVersionRef = React.useRef(0);
  const dashboardRef = React.useRef<StudentDashboardData | null>(null);
  const statusRef = React.useRef<AsyncStatus>("idle");

  React.useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadDashboard = React.useCallback(
    async (requestOptions: {
      signal?: AbortSignal;
      preserveCurrent?: boolean;
    } = {}) => {
      const requestVersion = ++requestVersionRef.current;
      const hasLoadedData = hasStudentDashboardContent(dashboardRef.current);
      const preserveCurrent = Boolean(
        requestOptions.preserveCurrent ?? hasLoadedData,
      );

      setError(null);
      setErrorStatus(null);

      if (preserveCurrent) {
        setRefreshing(true);
      } else {
        setStatus("loading");
      }

      try {
        const response = await getStudentDashboard({
          signal: requestOptions.signal,
        });

        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        setDashboard(response.data);
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
          toastId: "student-dashboard-session",
        });

        if (recovered || requestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to load your dashboard right now.",
        );
        const nextErrorStatus = isStudentDashboardApiError(requestError)
          ? requestError.status
          : null;

        setRefreshing(false);
        setError(message);
        setErrorStatus(nextErrorStatus);

        if (hasLoadedData) {
          setStatus("success");
          return;
        }

        setStatus("error");
      }
    },
    [recoverFromSessionFailure],
  );

  React.useEffect(() => {
    if (!options.autoLoad) {
      return;
    }

    const controller = new AbortController();
    void loadDashboard({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadDashboard, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    await loadDashboard({
      preserveCurrent:
        hasStudentDashboardContent(dashboardRef.current)
        || statusRef.current === "success",
    });
  }, [loadDashboard]);

  const hasData = hasStudentDashboardContent(dashboard);

  return {
    status,
    loading: status === "loading",
    refreshing,
    error,
    errorStatus,
    dashboard,
    hasData,
    hasStaleData: hasData && Boolean(error),
    isQuiet: isStudentDashboardQuiet(dashboard),
    refresh,
    retry: refresh,
  };
}
