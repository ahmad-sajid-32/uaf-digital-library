"use client";

/**
 * Student borrow lifecycle hook/state boundary.
 *
 * Purpose:
 * - Keep the student active-borrows workspace and borrow mutations in one
 *   module-scoped hook.
 * - Let the catalog detail surface trigger real borrow actions without moving
 *   catalog discovery state into the borrow module.
 * - Preserve backend-owned circulation truth by surfacing real success and
 *   failure outcomes instead of simulating borrow eligibility in the frontend.
 */

import * as React from "react";
import { toast } from "sonner";

import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import {
  borrowStudentBook,
  getStudentActiveBorrows,
  isStudentBorrowsApiError,
  renewStudentBook,
  returnStudentBook,
} from "@/lib/api/student-borrows";
import type { StudentActiveBorrowItem } from "@/lib/student-borrows";

type AsyncStatus = "idle" | "loading" | "success" | "error";

interface StudentBorrowMutationOptions {
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

export function useStudentBorrows(options: { autoLoad?: boolean } = {}) {
  const { recoverFromSessionFailure } = useAuthSessionActions();

  const [status, setStatus] = React.useState<AsyncStatus>("idle");
  const [items, setItems] = React.useState<StudentActiveBorrowItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const [borrowPendingBookId, setBorrowPendingBookId] = React.useState<string | null>(
    null,
  );
  const [borrowError, setBorrowError] = React.useState<string | null>(null);
  const [renewPendingBookId, setRenewPendingBookId] = React.useState<string | null>(
    null,
  );
  const [renewError, setRenewError] = React.useState<string | null>(null);
  const [returnPendingBookId, setReturnPendingBookId] = React.useState<string | null>(
    null,
  );
  const [returnError, setReturnError] = React.useState<string | null>(null);

  const requestVersionRef = React.useRef(0);
  const itemsRef = React.useRef<StudentActiveBorrowItem[]>([]);
  const statusRef = React.useRef<AsyncStatus>("idle");

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadActiveBorrows = React.useCallback(
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
        const response = await getStudentActiveBorrows({
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
          toastId: "student-borrows-session",
        });

        if (recovered || requestVersionRef.current !== requestVersion) {
          return;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to load your active borrows right now.",
        );
        const nextErrorStatus = isStudentBorrowsApiError(requestError)
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
    void loadActiveBorrows({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadActiveBorrows, options.autoLoad]);

  const refresh = React.useCallback(async () => {
    await loadActiveBorrows({
      preserveCurrent:
        itemsRef.current.length > 0 || statusRef.current === "success",
    });
  }, [loadActiveBorrows]);

  const runMutationSuccessTasks = React.useCallback(
    async (mutationOptions?: StudentBorrowMutationOptions) => {
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
          loadActiveBorrows({
            preserveCurrent:
              itemsRef.current.length > 0 || statusRef.current === "success",
          }),
        );
      }

      if (queuedTasks.length > 0) {
        await Promise.allSettled(queuedTasks);
      }
    },
    [loadActiveBorrows, options.autoLoad],
  );

  const hasPendingMutation =
    borrowPendingBookId !== null
    || renewPendingBookId !== null
    || returnPendingBookId !== null;

  const borrow = React.useCallback(
    async (
      bookId: string,
      mutationOptions: StudentBorrowMutationOptions = {},
    ): Promise<boolean> => {
      if (hasPendingMutation) {
        return false;
      }

      setBorrowPendingBookId(bookId);
      setBorrowError(null);

      try {
        const response = await borrowStudentBook(bookId);
        await runMutationSuccessTasks(mutationOptions);
        toast.success(response.message || "Book borrowed.", {
          id: mutationOptions.successToastId ?? `student-borrow-${bookId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const recovered = await recoverFromSessionFailure(mutationError, {
          toastId:
            mutationOptions.errorToastId ?? `student-borrow-${bookId}-session`,
        });
        const message = getErrorMessage(
          mutationError,
          "Unable to borrow this book right now.",
        );

        if (!recovered) {
          toast.error(message, {
            id: mutationOptions.errorToastId ?? `student-borrow-${bookId}-error`,
          });
        }

        setBorrowError(message);
        return false;
      } finally {
        setBorrowPendingBookId(null);
      }
    },
    [hasPendingMutation, recoverFromSessionFailure, runMutationSuccessTasks],
  );

  const renew = React.useCallback(
    async (
      bookId: string,
      mutationOptions: StudentBorrowMutationOptions = {},
    ): Promise<boolean> => {
      if (hasPendingMutation) {
        return false;
      }

      setRenewPendingBookId(bookId);
      setRenewError(null);

      try {
        const response = await renewStudentBook(bookId);
        await runMutationSuccessTasks(mutationOptions);
        toast.success(response.message || "Book renewed.", {
          id: mutationOptions.successToastId ?? `student-renew-${bookId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const recovered = await recoverFromSessionFailure(mutationError, {
          toastId:
            mutationOptions.errorToastId ?? `student-renew-${bookId}-session`,
        });
        const message = getErrorMessage(
          mutationError,
          "Unable to renew this book right now.",
        );

        if (!recovered) {
          toast.error(message, {
            id: mutationOptions.errorToastId ?? `student-renew-${bookId}-error`,
          });
        }

        setRenewError(message);
        return false;
      } finally {
        setRenewPendingBookId(null);
      }
    },
    [hasPendingMutation, recoverFromSessionFailure, runMutationSuccessTasks],
  );

  const returnBorrowedBook = React.useCallback(
    async (
      bookId: string,
      mutationOptions: StudentBorrowMutationOptions = {},
    ): Promise<boolean> => {
      if (hasPendingMutation) {
        return false;
      }

      setReturnPendingBookId(bookId);
      setReturnError(null);

      try {
        const response = await returnStudentBook(bookId);
        await runMutationSuccessTasks(mutationOptions);
        toast.success(response.message || "Book returned.", {
          id: mutationOptions.successToastId ?? `student-return-${bookId}`,
        });
        return true;
      } catch (mutationError: unknown) {
        const recovered = await recoverFromSessionFailure(mutationError, {
          toastId:
            mutationOptions.errorToastId ?? `student-return-${bookId}-session`,
        });
        const message = getErrorMessage(
          mutationError,
          "Unable to return this book right now.",
        );

        if (!recovered) {
          toast.error(message, {
            id: mutationOptions.errorToastId ?? `student-return-${bookId}-error`,
          });
        }

        setReturnError(message);
        return false;
      } finally {
        setReturnPendingBookId(null);
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
    borrowAction: {
      pending: borrowPendingBookId !== null,
      pendingBookId: borrowPendingBookId,
      error: borrowError,
      clearError: () => {
        setBorrowError(null);
      },
      submit: borrow,
    },
    renewAction: {
      pending: renewPendingBookId !== null,
      pendingBookId: renewPendingBookId,
      error: renewError,
      clearError: () => {
        setRenewError(null);
      },
      submit: renew,
    },
    returnAction: {
      pending: returnPendingBookId !== null,
      pendingBookId: returnPendingBookId,
      error: returnError,
      clearError: () => {
        setReturnError(null);
      },
      submit: returnBorrowedBook,
    },
  };
}
