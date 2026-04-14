"use client";

/**
 * Student queue hook/state boundary.
 *
 * Purpose:
 * - Keep the student queue workspace and queue mutations in one module-scoped
 *   hook.
 * - Let the selected-book detail surface trigger real queue joins without
 *   moving selected-book discovery state into the queue module.
 * - Preserve backend-owned queue truth by surfacing real status and mutation
 *   outcomes instead of simulating queue rules in the frontend.
 */

import * as React from "react";
import { toast } from "sonner";

import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import {
  cancelStudentQueue,
  getStudentQueue,
  isStudentQueueApiError,
  joinStudentQueue,
} from "@/lib/api/student-queue";
import type { StudentQueueItem } from "@/lib/student-queue";

type AsyncStatus = "idle" | "loading" | "success" | "error";

interface StudentQueueMutationOptions {
  onSuccess?: () => void | Promise<void>;
  successToastId?: string;
  errorToastId?: string;
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

export function useStudentQueue(options: { autoLoad?: boolean } = {}) {
  const { recoverFromSessionFailure } = useAuthSessionActions();

  const [status, setStatus] = React.useState<AsyncStatus>("idle");
  const [items, setItems] = React.useState<StudentQueueItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const [joinPendingBookId, setJoinPendingBookId] = React.useState<string | null>(
    null,
  );
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [cancelPendingBookId, setCancelPendingBookId] = React.useState<string | null>(
    null,
  );
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const requestVersionRef = React.useRef(0);
  const itemsRef = React.useRef<StudentQueueItem[]>([]);
  const statusRef = React.useRef<AsyncStatus>("idle");

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadQueue = React.useCallback(
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
      setErrorStatus(null);

      if (preserveCurrent) {
        setRefreshing(true);
      } else {
        setStatus("loading");
      }

      try {
        const response = await getStudentQueue({
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
          toastId: "student-queue-session",
        });

        if (recovered || requestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to load your queue right now.",
        );
        const nextErrorStatus = isStudentQueueApiError(requestError)
          ? requestError.status
          : null;

        setRefreshing(false);
        setError(message);
        setErrorStatus(nextErrorStatus);

        if (hasLoadedRows) {
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
    void loadQueue({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadQueue, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    await loadQueue({
      preserveCurrent:
        itemsRef.current.length > 0 || statusRef.current === "success",
    });
  }, [loadQueue]);

  const runMutationSuccessTasks = React.useCallback(
    async (mutationOptions?: StudentQueueMutationOptions) => {
      const queuedTasks: Promise<void>[] = [];

      if (mutationOptions?.onSuccess) {
        queuedTasks.push(Promise.resolve(mutationOptions.onSuccess()));
      }

      if (
        options.autoLoad
        || statusRef.current !== "idle"
        || itemsRef.current.length > 0
      ) {
        queuedTasks.push(
          loadQueue({
            preserveCurrent:
              itemsRef.current.length > 0 || statusRef.current === "success",
          }),
        );
      }

      if (queuedTasks.length > 0) {
        await Promise.allSettled(queuedTasks);
      }
    },
    [loadQueue, options.autoLoad],
  );

  const hasPendingMutation =
    joinPendingBookId !== null || cancelPendingBookId !== null;

  const join = React.useCallback(
    async (
      bookId: string,
      mutationOptions: StudentQueueMutationOptions = {},
    ): Promise<boolean> => {
      if (hasPendingMutation) {
        return false;
      }

      setJoinPendingBookId(bookId);
      setJoinError(null);

      try {
        const response = await joinStudentQueue(bookId);
        await runMutationSuccessTasks(mutationOptions);
        toast.success(response.message || "Joined queue.", {
          id: mutationOptions.successToastId ?? `student-queue-join-${bookId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const recovered = await recoverFromSessionFailure(mutationError, {
          toastId:
            mutationOptions.errorToastId
            ?? `student-queue-join-${bookId}-session`,
        });
        const message = getErrorMessage(
          mutationError,
          "Unable to join the queue right now.",
        );

        if (!recovered) {
          toast.error(message, {
            id:
              mutationOptions.errorToastId
              ?? `student-queue-join-${bookId}-error`,
          });
        }

        setJoinError(message);
        return false;
      } finally {
        setJoinPendingBookId(null);
      }
    },
    [hasPendingMutation, recoverFromSessionFailure, runMutationSuccessTasks],
  );

  const cancel = React.useCallback(
    async (
      bookId: string,
      mutationOptions: StudentQueueMutationOptions = {},
    ): Promise<boolean> => {
      if (hasPendingMutation) {
        return false;
      }

      setCancelPendingBookId(bookId);
      setCancelError(null);

      try {
        const response = await cancelStudentQueue(bookId);
        await runMutationSuccessTasks(mutationOptions);
        toast.success(response.message || "Queue entry cancelled.", {
          id: mutationOptions.successToastId ?? `student-queue-cancel-${bookId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const recovered = await recoverFromSessionFailure(mutationError, {
          toastId:
            mutationOptions.errorToastId
            ?? `student-queue-cancel-${bookId}-session`,
        });
        const message = getErrorMessage(
          mutationError,
          "Unable to cancel this queue entry right now.",
        );

        if (!recovered) {
          toast.error(message, {
            id:
              mutationOptions.errorToastId
              ?? `student-queue-cancel-${bookId}-error`,
          });
        }

        setCancelError(message);
        return false;
      } finally {
        setCancelPendingBookId(null);
      }
    },
    [hasPendingMutation, recoverFromSessionFailure, runMutationSuccessTasks],
  );

  return {
    status,
    loading: status === "loading",
    refreshing,
    error,
    errorStatus,
    items,
    hasData: items.length > 0,
    hasStaleData: items.length > 0 && Boolean(error),
    isEmpty: status === "success" && items.length === 0,
    refresh,
    retry: refresh,
    hasPendingMutation,
    joinAction: {
      pending: joinPendingBookId !== null,
      pendingBookId: joinPendingBookId,
      error: joinError,
      clearError: () => {
        setJoinError(null);
      },
      submit: join,
    },
    cancelAction: {
      pending: cancelPendingBookId !== null,
      pendingBookId: cancelPendingBookId,
      error: cancelError,
      clearError: () => {
        setCancelError(null);
      },
      submit: cancel,
    },
  };
}
