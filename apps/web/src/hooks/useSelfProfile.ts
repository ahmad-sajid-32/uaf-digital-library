"use client";

/**
 * Shared self-profile hook/state boundary.
 *
 * Purpose:
 * - Keep protected self-profile state in one reusable hook for every role.
 * - Expose only the current self-service contract: editable `full_name` plus
 *   optional destructive account deletion where explicitly enabled.
 * - Align the shell display name after a successful save because the current
 *   repo still exposes no profile read route.
 */

import * as React from "react";
import { toast } from "sonner";

import { useAppAuth } from "@/hooks/useAppAuth";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import { signOut } from "@/lib/api/auth";
import {
  deleteMyAccount,
  updateSelfProfile,
  syncSelfProfileSession,
} from "@/lib/api/self-profile";
import { clearClientAuthTransientState } from "@/lib/auth/session-client";
import type { SelfProfileIdentity } from "@/lib/self-profile";
import {
  normalizeSelfProfileFullName,
  validateSelfProfileFullName,
} from "@/lib/self-profile";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function buildSelfProfileIdentity(params: {
  userId: string | null;
  email: string | null;
  role: SelfProfileIdentity["role"] | null;
  fullName: string | null;
}): SelfProfileIdentity | null {
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

interface UseSelfProfileOptions {
  allowAccountDeletion?: boolean;
  deleteRedirectTo?: string;
  deletionSuccessToastId?: string;
}

export function useSelfProfile(options: UseSelfProfileOptions = {}) {
  const allowAccountDeletion = Boolean(options.allowAccountDeletion);
  const {
    auth,
    hydrated,
    refreshAuthState,
    overrideProfileDisplayName,
  } = useAppAuth();
  const { recoverFromSessionFailure } = useAuthSessionActions();

  const identity = React.useMemo(
    () =>
      buildSelfProfileIdentity({
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
    () => normalizeSelfProfileFullName(fullNameInput),
    [fullNameInput],
  );
  const normalizedPersisted = React.useMemo(
    () => normalizeSelfProfileFullName(persistedFullName),
    [persistedFullName],
  );
  const fullNameValidationError = React.useMemo(
    () => validateSelfProfileFullName(fullNameInput),
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
      const response = await updateSelfProfile({
        full_name: normalizedInput,
      });

      overrideProfileDisplayName(normalizedInput);

      try {
        await syncSelfProfileSession(normalizedInput);
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
        id: "self-profile-update-success",
      });

      return true;
    } catch (updateError: unknown) {
      const recovered = await recoverFromSessionFailure(updateError, {
        toastId: "self-profile-update-session",
      });

      const message = getErrorMessage(
        updateError,
        "Unable to update your profile right now.",
      );

      if (!recovered) {
        toast.error(message, {
          id: "self-profile-update-error",
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
    if (
      !allowAccountDeletion
      || !identity
      || savePending
      || deletePending
    ) {
      return false;
    }

    setDeletePending(true);
    setDeleteError(null);

    try {
      await deleteMyAccount();
      overrideProfileDisplayName(null);

      try {
        await signOut();
      } catch {
        // The backend already deleted the account. Local teardown must still
        // happen even if browser-session sign-out reports a follow-up error.
      }

      clearClientAuthTransientState();
      await refreshAuthState();
      window.location.replace(options.deleteRedirectTo ?? "/login");

      return true;
    } catch (deletionError: unknown) {
      const recovered = await recoverFromSessionFailure(deletionError, {
        toastId: options.deletionSuccessToastId ?? "self-profile-delete-session",
      });
      const message = getErrorMessage(
        deletionError,
        "Unable to delete your account right now.",
      );

      if (!recovered) {
        toast.error(message, {
          id: "self-profile-delete-error",
        });
      }

      setDeleteError(message);
      return false;
    } finally {
      setDeletePending(false);
    }
  }, [
    allowAccountDeletion,
    deletePending,
    identity,
    options.deleteRedirectTo,
    options.deletionSuccessToastId,
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
    refresh,
    retry: refresh,
    fullName: {
      value: fullNameInput,
      dirty: isDirty,
      pending: savePending,
      canSubmit,
      validationError: fullNameValidationError,
      error: saveError,
      syncWarning: saveSyncWarning,
      setValue: (value: string) => {
        setSaveError(null);
        setSaveSyncWarning(null);
        setFullNameInput(value);
      },
      reset: () => {
        setSaveError(null);
        setSaveSyncWarning(null);
        setFullNameInput(persistedFullName);
      },
      submit: submitProfileUpdate,
    },
    deleteAccount: {
      enabled: allowAccountDeletion,
      pending: deletePending,
      error: deleteError,
      clearError: () => {
        setDeleteError(null);
      },
      submit: submitAccountDeletion,
    },
  };
}
