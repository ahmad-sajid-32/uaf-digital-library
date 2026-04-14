"use client";

/**
 * Staff public-result lookup hook/state boundary.
 *
 * Purpose:
 * - Keep public registration-number lookup state in one shared hook for admin
 *   and librarian result screens.
 * - Preserve stale result data during re-fetches instead of clearing the screen
 *   for every lookup.
 */

import * as React from "react";

import {
  getStaffResultByRegistration,
  isStaffResultApiError,
} from "@/lib/api/staff-result";
import type { StaffResultData } from "@/lib/staff-result";
import {
  normalizeStaffResultRegistration,
  validateStaffResultRegistration,
} from "@/lib/staff-result";
import { hasStudentResultContent } from "@/lib/student-result";

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

export function useStaffResult() {
  const [registrationNumber, setRegistrationNumber] = React.useState("");
  const [lastSubmittedRegistration, setLastSubmittedRegistration] =
    React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AsyncStatus>("idle");
  const [result, setResult] = React.useState<StaffResultData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const requestVersionRef = React.useRef(0);
  const resultRef = React.useRef<StaffResultData | null>(null);
  const statusRef = React.useRef<AsyncStatus>("idle");

  React.useEffect(() => {
    resultRef.current = result;
  }, [result]);

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const normalizedRegistration = React.useMemo(
    () => normalizeStaffResultRegistration(registrationNumber),
    [registrationNumber],
  );
  const validationError = React.useMemo(
    () => validateStaffResultRegistration(registrationNumber),
    [registrationNumber],
  );

  const lookupResult = React.useCallback(
    async (
      regNumber: string,
      requestOptions: {
        signal?: AbortSignal;
        preserveCurrent?: boolean;
      } = {},
    ): Promise<boolean> => {
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
        const response = await getStaffResultByRegistration(regNumber, {
          signal: requestOptions.signal,
        });

        if (requestVersionRef.current !== requestVersion) {
          return false;
        }

        setLastSubmittedRegistration(regNumber);
        setResult(response.data);
        setStatus("success");
        setRefreshing(false);

        return true;
      } catch (requestError: unknown) {
        if (
          isAbortError(requestError)
          || requestVersionRef.current !== requestVersion
        ) {
          return false;
        }

        const message = getErrorMessage(
          requestError,
          "Unable to fetch the academic result right now.",
        );
        const nextErrorStatus = isStaffResultApiError(requestError)
          ? requestError.status
          : null;

        setRefreshing(false);
        setError(message);
        setErrorStatus(nextErrorStatus);

        if (hasLoadedData) {
          setStatus("success");
          return false;
        }

        setStatus("error");
        return false;
      }
    },
    [],
  );

  const submit = React.useCallback(async (): Promise<boolean> => {
    const nextValidationError = validateStaffResultRegistration(
      registrationNumber,
    );

    if (nextValidationError) {
      setError(nextValidationError);
      setErrorStatus(null);

      if (!hasStudentResultContent(resultRef.current)) {
        setStatus("error");
      }

      return false;
    }

    return lookupResult(normalizeStaffResultRegistration(registrationNumber), {
      preserveCurrent:
        hasStudentResultContent(resultRef.current)
        || statusRef.current === "success",
    });
  }, [lookupResult, registrationNumber]);

  const refresh = React.useCallback(async (): Promise<boolean> => {
    if (!lastSubmittedRegistration) {
      return false;
    }

    return lookupResult(lastSubmittedRegistration, {
      preserveCurrent:
        hasStudentResultContent(resultRef.current)
        || statusRef.current === "success",
    });
  }, [lastSubmittedRegistration, lookupResult]);

  const hasData = hasStudentResultContent(result);

  return {
    registrationNumber: {
      value: registrationNumber,
      normalizedValue: normalizedRegistration,
      validationError,
      setValue: (value: string) => {
        setRegistrationNumber(value);
        if (errorStatus === 400 || error) {
          setError(null);
          setErrorStatus(null);
          if (statusRef.current === "error" && !hasData) {
            setStatus("idle");
          }
        }
      },
    },
    status,
    loading: status === "loading",
    refreshing,
    error,
    errorStatus,
    result,
    hasData,
    hasStaleData: hasData && Boolean(error),
    isIdle: status === "idle" && !hasData,
    isEmpty: status === "success" && !hasData,
    hasSubmitted: Boolean(lastSubmittedRegistration),
    submit,
    refresh,
    retry: refresh,
  };
}
