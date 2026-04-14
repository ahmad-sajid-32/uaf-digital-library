"use client";

/**
 * Student profile/account hook.
 *
 * Purpose:
 * - Keep protected student profile/account state in one module-scoped hook.
 * - Expose only the current self-service contract: editable `full_name` plus
 *   destructive account deletion.
 * - Align the shell display name after a successful save because the current
 *   repo does not expose a profile read route.
 */

import * as React from "react";
import { toast } from "sonner";

import { useAppAuth } from "@/hooks/useAppAuth";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import { signOut } from "@/lib/api/auth";
import {
  deleteStudentAccount,
  updateStudentProfile,
  syncStudentProfileSession,
} from "@/lib/api/student-profile";
import { clearClientAuthTransientState } from "@/lib/auth/session-client";
import type { StudentProfileIdentity } from "@/lib/student-profile";
import {
  normalizeStudentProfileFullName,
  validateStudentProfileFullName,
} from "@/lib/student-profile";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function buildStudentProfileIdentity(params: {
  userId: string | null;
  email: string | null;
  role: StudentProfileIdentity["role"] | null;
  fullName: string | null;
}): StudentProfileIdentity | null {
  if (!params.userId || !params.email || !params.role) {
    return null;
  }

  return {
    userId: params.userId,
    email: params.email,
    role: params.role,
    roleLabel: params.role.charAt(0).toUpperCase() + params.role.slice(1),
    fullName: params.fullName,
  };
}

export function useStudentProfile() {
  const {
    auth,
    hydrated,
    refreshAuthState,
    overrideProfileDisplayName,
  } = useAppAuth();
  const { recoverFromSessionFailure } = useAuthSessionActions();

  const identity = React.useMemo(
    () =>
      buildStudentProfileIdentity({
        userId: auth.userId,
        email: auth.email,
        role: auth.role,
        fullName: auth.fullName,
      }),
    [auth.email, auth.fullName, auth.role, auth.userId],
  );

  const [fullNameInput, setFullNameInput] = React.useState(
    identity?.fullName ?? "",
  );
  const [persistedFullName, setPersistedFullName] = React.useState(
    identity?.fullName ?? "",
  );
  const [refreshPending, setRefreshPending] = React.useState(false);
  const [savePending, setSavePending] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSyncWarning, setSaveSyncWarning] = React.useState<string | null>(
    null,
  );
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!hydrated || savePending || deletePending) {
      return;
    }

    const nextFullName = identity?.fullName ?? "";
    setPersistedFullName(nextFullName);
    setFullNameInput(nextFullName);
  }, [deletePending, hydrated, identity?.fullName, identity?.userId, savePending]);

  const normalizedInput = React.useMemo(
    () => normalizeStudentProfileFullName(fullNameInput),
    [fullNameInput],
  );
  const normalizedPersisted = React.useMemo(
    () => normalizeStudentProfileFullName(persistedFullName),
    [persistedFullName],
  );
  const fullNameValidationError = React.useMemo(
    () => validateStudentProfileFullName(fullNameInput),
    [fullNameInput],
  );
  const isDirty = normalizedInput !== normalizedPersisted;
  const canSubmit =
    Boolean(identity)
    && isDirty
    && !fullNameValidationError
    && !savePending
    && !deletePending;

  const refresh = React.useCallback(async () => {
    setRefreshPending(true);
    setSaveError(null);
    setDeleteError(null);

    try {
      await refreshAuthState();
    } finally {
      setRefreshPending(false);
    }
  }, [refreshAuthState]);

  const submitProfileUpdate = React.useCallback(async (): Promise<boolean> => {
    if (!identity || !canSubmit) {
      return false;
    }

    setSavePending(true);
    setSaveError(null);
    setSaveSyncWarning(null);

    try {
      const response = await updateStudentProfile({
        full_name: normalizedInput,
      });

      overrideProfileDisplayName(normalizedInput);

      try {
        await syncStudentProfileSession(normalizedInput);
      } catch (syncError: unknown) {
        setSaveSyncWarning(
          getErrorMessage(
            syncError,
            "Profile updated, but the shell name may refresh after the next session validation.",
          ),
        );
      }

      await refreshAuthState();
      setPersistedFullName(normalizedInput);
      setFullNameInput(normalizedInput);

      toast.success(response.message || "Profile updated successfully.", {
        id: "student-profile-update-success",
      });

      return true;
    } catch (updateError: unknown) {
      const recovered = await recoverFromSessionFailure(updateError, {
        toastId: "student-profile-update-session",
      });

      const message = getErrorMessage(
        updateError,
        "Unable to update your profile right now.",
      );

      if (!recovered) {
        toast.error(message, {
          id: "student-profile-update-error",
        });
      }

      setSaveError(message);
      return false;
    } finally {
      setSavePending(false);
    }
  }, [
    canSubmit,
    identity,
    normalizedInput,
    overrideProfileDisplayName,
    recoverFromSessionFailure,
    refreshAuthState,
  ]);

  const submitAccountDeletion = React.useCallback(async (): Promise<boolean> => {
    if (!identity || savePending || deletePending) {
      return false;
    }

    setDeletePending(true);
    setDeleteError(null);

    try {
      await deleteStudentAccount();
      overrideProfileDisplayName(null);

      try {
        await signOut();
      } catch {
        // The backend already deleted the account. Local teardown must still
        // happen even if browser-session sign-out reports a follow-up error.
      }

      clearClientAuthTransientState();
      await refreshAuthState();
      window.location.replace("/login?auth=account-deleted");

      return true;
    } catch (deletionError: unknown) {
      const recovered = await recoverFromSessionFailure(deletionError, {
        toastId: "student-profile-delete-session",
      });
      const message = getErrorMessage(
        deletionError,
        "Unable to delete your account right now.",
      );

      if (!recovered) {
        toast.error(message, {
          id: "student-profile-delete-error",
        });
      }

      setDeleteError(message);
      return false;
    } finally {
      setDeletePending(false);
    }
  }, [
    deletePending,
    identity,
    overrideProfileDisplayName,
    recoverFromSessionFailure,
    refreshAuthState,
    savePending,
  ]);

  return {
    hydrated,
    loading: !hydrated,
    refreshing: refreshPending,
    profile: identity,
    unavailable: hydrated && !identity,
    fullName: {
      value: fullNameInput,
      persistedValue: persistedFullName,
      setValue: (nextValue: string) => {
        setFullNameInput(nextValue);
        setSaveError(null);
        setSaveSyncWarning(null);
      },
      validationError: fullNameValidationError,
      dirty: isDirty,
      canSubmit,
      pending: savePending,
      error: saveError,
      syncWarning: saveSyncWarning,
      submit: submitProfileUpdate,
      reset: () => {
        setFullNameInput(persistedFullName);
        setSaveError(null);
        setSaveSyncWarning(null);
      },
    },
    deleteAccount: {
      pending: deletePending,
      error: deleteError,
      submit: submitAccountDeletion,
      clearError: () => {
        setDeleteError(null);
      },
    },
    refresh,
    retry: refresh,
  };
}
