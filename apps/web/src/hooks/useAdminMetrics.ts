"use client";

import * as React from "react";

import {
  getAdminDashboardMetrics,
  type AdminDashboardMetrics,
} from "@/lib/api/metrics";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";

type AdminMetricsStatus = "idle" | "loading" | "success" | "error";

interface UseAdminMetricsOptions {
  popularLimit?: number;
  queueLimit?: number;
  autoLoad?: boolean;
}

function isAbortError(error: unknown): boolean {
  return Boolean(error instanceof Error && error.name === "AbortError");
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useAdminMetrics(
  options: UseAdminMetricsOptions = {},
) {
  const popularLimit = options.popularLimit ?? 5;
  const queueLimit = options.queueLimit ?? 5;
  const autoLoad = options.autoLoad ?? true;
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const controllerRef = React.useRef<AbortController | null>(null);
  const requestVersionRef = React.useRef(0);
  const metricsRef = React.useRef<AdminDashboardMetrics | null>(null);
  const [status, setStatus] = React.useState<AdminMetricsStatus>("idle");
  const [refreshing, setRefreshing] = React.useState(false);
  const [metrics, setMetrics] = React.useState<AdminDashboardMetrics | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  const reportLoadError = React.useCallback(
    async (loadError: unknown): Promise<string> => {
      const recovered = await recoverFromSessionFailure(loadError, {
        toastId: "admin-metrics-session",
      });
      const message = getErrorMessage(
        loadError,
        "Unable to load dashboard metrics right now.",
      );

      if (recovered) {
        return message;
      }

      return message;
    },
    [recoverFromSessionFailure],
  );

  const loadMetrics = React.useCallback(
    async (forceRefresh: boolean): Promise<void> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      const currentMetrics = metricsRef.current;

      if (currentMetrics && forceRefresh) {
        setRefreshing(true);
      } else {
        setStatus("loading");
      }

      setError(null);

      try {
        const response = await getAdminDashboardMetrics({
          popularLimit,
          queueLimit,
          signal: controller.signal,
        });

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setMetrics(response.data);
        setStatus("success");
        setRefreshing(false);
        setLastLoadedAt(Date.now());
      } catch (loadError: unknown) {
        if (isAbortError(loadError)) {
          return;
        }

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        const message = await reportLoadError(loadError);
        setError(message);
        setStatus(currentMetrics ? "success" : "error");
        setRefreshing(false);
      }
    },
    [popularLimit, queueLimit, reportLoadError],
  );

  React.useEffect(() => {
    if (!autoLoad) {
      return;
    }

    void loadMetrics(false);

    return () => {
      controllerRef.current?.abort();
    };
  }, [autoLoad, loadMetrics]);

  const refresh = React.useCallback(async () => {
    await loadMetrics(true);
  }, [loadMetrics]);

  const queuePressure = metrics?.queuePressure ?? [];
  const popularBooks = metrics?.popularBooks ?? [];
  const topQueuedBook = queuePressure[0] ?? null;
  const topPopularBook = popularBooks[0] ?? null;
  const noQueuePressure = queuePressure.length === 0;
  const noPopularBooks = popularBooks.length === 0;
  const isSystemQuiet = Boolean(
    metrics &&
      metrics.activeBorrowCount === 0 &&
      metrics.overdueCount === 0 &&
      metrics.totalPendingFines === 0 &&
      noQueuePressure &&
      noPopularBooks,
  );

  return {
    status,
    loading: status === "loading" && metrics === null,
    refreshing,
    error,
    metrics,
    hasData: metrics !== null,
    hasStaleData: metrics !== null && Boolean(error),
    lastLoadedAt,
    popularLimit,
    queueLimit,
    queuePressure,
    popularBooks,
    topQueuedBook,
    topPopularBook,
    noQueuePressure,
    noPopularBooks,
    isSystemQuiet,
    refresh,
    retry: refresh,
  };
}
