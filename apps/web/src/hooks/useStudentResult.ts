"use client";

/**
 * Student result hook/state boundary.
 *
 * Purpose:
 * - Keep protected student result state in one read-only module hook.
 * - Preserve backend-owned academic truth while keeping page components thin.
 * - Recover cleanly from expired authenticated sessions.
 */

import * as React from "react";

import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import {
  getStudentResult,
  isStudentResultApiError,
} from "@/lib/api/student-result";
import {
  hasStudentResultContent,
  type StudentResultData,
} from "@/lib/student-result";

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

export function useStudentResult(options: {
  autoLoad?: boolean;
} = {}) {
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const [status, setStatus] = React.useState<AsyncStatus>("idle");
  const [result, setResult] = React.useState<StudentResultData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const requestVersionRef = React.useRef(0);
  const resultRef = React.useRef<StudentResultData | null>(null);
  const statusRef = React.useRef<AsyncStatus>("idle");

  React.useEffect(() => {
    resultRef.current = result;
  }, [result]);

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadResult = React.useCallback(
    async (requestOptions: {
      signal?: AbortSignal;
      preserveCurrent?: boolean;
    } = {}) => {
      const requestVersion = ++requestVersionRef.current;
      const hasLoadedData = hasStudentResultContent(resultRef.current);
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
        const response = await getStudentResult({
          signal: requestOptions.signal,
        });

        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        setResult(response.data);
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
          toastId: "student-result-session",
        });

        if (recovered || requestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to load your academic result right now.",
        );
        const nextErrorStatus = isStudentResultApiError(requestError)
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
    void loadResult({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadResult, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    await loadResult({
      preserveCurrent:
        hasStudentResultContent(resultRef.current)
        || statusRef.current === "success",
    });
  }, [loadResult]);

  const hasData = hasStudentResultContent(result);

  return {
    status,
    loading: status === "loading",
    refreshing,
    error,
    errorStatus,
    result,
    hasData,
    hasStaleData: hasData && Boolean(error),
    isEmpty: status === "success" && !hasData,
    refresh,
    retry: refresh,
  };
}
