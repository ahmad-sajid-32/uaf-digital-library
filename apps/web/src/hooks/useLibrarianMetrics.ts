"use client";

// apps/web/src/hooks/useLibrarianMetrics.ts
/**
 * Unified hook/state boundary for the librarian operational dashboard.
 *
 * Purpose:
 * - Centralize request orchestration for librarian dashboard metrics.
 * - Keep session failure recovery, retry, refresh, and stale-data state out of
 *   the screen component.
 * - Preserve one truthful dashboard state machine for operational reads.
 */

import * as React from "react";

import {
  getLibrarianDashboardMetrics,
  type LibrarianDashboardMetrics,
} from "@/lib/api/librarian-metrics";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";

type LibrarianMetricsStatus = "idle" | "loading" | "success" | "error";

interface UseLibrarianMetricsOptions {
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

export function useLibrarianMetrics(
  options: UseLibrarianMetricsOptions = {},
) {
  const autoLoad = options.autoLoad ?? true;
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const controllerRef = React.useRef<AbortController | null>(null);
  const requestVersionRef = React.useRef(0);
  const metricsRef = React.useRef<LibrarianDashboardMetrics | null>(null);
  const [status, setStatus] = React.useState<LibrarianMetricsStatus>("idle");
  const [refreshing, setRefreshing] = React.useState(false);
  const [metrics, setMetrics] = React.useState<LibrarianDashboardMetrics | null>(
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
        toastId: "librarian-metrics-session",
      });
      const message = getErrorMessage(
        loadError,
        "Unable to load librarian dashboard metrics right now.",
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
        const response = await getLibrarianDashboardMetrics({
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
    [reportLoadError],
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

  const queueHotspots = metrics?.queueHotspots ?? [];
  const documentAttention = metrics?.documentAttention ?? [];
  const popularBooks = metrics?.popularBooks ?? [];
  const topQueueHotspot = queueHotspots[0] ?? null;
  const topPopularBook = popularBooks[0] ?? null;
  const hasQueuePressure = queueHotspots.length > 0;
  const hasDocumentAttention = documentAttention.length > 0;
  const hasPopularBooks = popularBooks.length > 0;
  const isOperationallyQuiet = Boolean(
    metrics &&
      metrics.activeLoanCount === 0 &&
      metrics.overdueLoanCount === 0 &&
      metrics.pendingFineCount === 0 &&
      metrics.documentsRequiringActionCount === 0 &&
      !hasQueuePressure &&
      !hasDocumentAttention,
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
    queueHotspots,
    documentAttention,
    popularBooks,
    topQueueHotspot,
    topPopularBook,
    hasQueuePressure,
    hasDocumentAttention,
    hasPopularBooks,
    isOperationallyQuiet,
    refresh,
    retry: refresh,
  };
}
