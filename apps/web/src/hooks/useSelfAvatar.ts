"use client";

/**
 * Shared self-avatar hook/state boundary.
 *
 * Purpose:
 * - Keep profile avatar reads and mutations behind the self-profile API.
 * - Synchronize the profile surface and authenticated shell immediately after
 *   upload or delete.
 */

import * as React from "react";
import { toast } from "sonner";

import { useAppAuth } from "@/hooks/useAppAuth";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";
import {
  deleteSelfAvatar,
  getSelfAvatar,
  uploadSelfAvatar,
} from "@/lib/api/self-profile";
import type { SelfAvatarItem } from "@/lib/self-profile";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

interface UseSelfAvatarOptions {
  autoLoad?: boolean;
}

export function useSelfAvatar(options: UseSelfAvatarOptions = {}) {
  const autoLoad = options.autoLoad ?? true;
  const { auth, hydrated, overrideProfileAvatarImageUrl } = useAppAuth();
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const [avatar, setAvatar] = React.useState<SelfAvatarItem | null>(null);
  const [loading, setLoading] = React.useState(Boolean(autoLoad));
  const [refreshing, setRefreshing] = React.useState(false);
  const [uploadPending, setUploadPending] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const refreshSequenceRef = React.useRef(0);

  const applyAvatar = React.useCallback(
    (nextAvatar: SelfAvatarItem) => {
      setAvatar(nextAvatar);
      overrideProfileAvatarImageUrl(nextAvatar.avatar_image_url);
    },
    [overrideProfileAvatarImageUrl],
  );

  const refresh = React.useCallback(async (): Promise<boolean> => {
    if (auth.status !== "authenticated") {
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
      return false;
    }

    const sequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = sequence;

    setRefreshing(hasLoaded);
    setLoading(!hasLoaded);
    setError(null);

    try {
      const response = await getSelfAvatar();

      if (refreshSequenceRef.current === sequence) {
        applyAvatar(response.data.avatar);
        setHasLoaded(true);
      }

      return true;
    } catch (refreshError: unknown) {
      const recovered = await recoverFromSessionFailure(refreshError, {
        toastId: "self-avatar-session",
      });
      const message = getErrorMessage(
        refreshError,
        "Unable to load your profile image right now.",
      );

      if (!recovered && refreshSequenceRef.current === sequence) {
        setError(message);
        setHasLoaded(true);
      }

      return false;
    } finally {
      if (refreshSequenceRef.current === sequence) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    applyAvatar,
    auth.status,
    hasLoaded,
    recoverFromSessionFailure,
  ]);

  React.useEffect(() => {
    if (!autoLoad || !hydrated) {
      return;
    }

    if (auth.status !== "authenticated") {
      setAvatar(null);
      overrideProfileAvatarImageUrl(null);
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
      return;
    }

    void refresh();
  }, [
    auth.status,
    autoLoad,
    hydrated,
    overrideProfileAvatarImageUrl,
    refresh,
  ]);

  const upload = React.useCallback(
    async (file: File): Promise<boolean> => {
      setUploadPending(true);
      setUploadError(null);
      setError(null);

      try {
        const response = await uploadSelfAvatar(file);
        applyAvatar(response.data.avatar);
        setHasLoaded(true);
        toast.success(response.message || "Profile image updated.", {
          id: "self-avatar-upload-success",
        });
        return true;
      } catch (uploadFailure: unknown) {
        const recovered = await recoverFromSessionFailure(uploadFailure, {
          toastId: "self-avatar-upload-session",
        });
        const message = getErrorMessage(
          uploadFailure,
          "Unable to update your profile image right now.",
        );

        if (!recovered) {
          toast.error(message, {
            id: "self-avatar-upload-error",
          });
        }

        setUploadError(message);
        return false;
      } finally {
        setUploadPending(false);
      }
    },
    [applyAvatar, recoverFromSessionFailure],
  );

  const remove = React.useCallback(async (): Promise<boolean> => {
    setDeletePending(true);
    setDeleteError(null);
    setError(null);

    try {
      const response = await deleteSelfAvatar();
      applyAvatar(response.data.avatar);
      setHasLoaded(true);
      toast.success(response.message || "Profile image removed.", {
        id: "self-avatar-delete-success",
      });
      return true;
    } catch (deleteFailure: unknown) {
      const recovered = await recoverFromSessionFailure(deleteFailure, {
        toastId: "self-avatar-delete-session",
      });
      const message = getErrorMessage(
        deleteFailure,
        "Unable to remove your profile image right now.",
      );

      if (!recovered) {
        toast.error(message, {
          id: "self-avatar-delete-error",
        });
      }

      setDeleteError(message);
      return false;
    } finally {
      setDeletePending(false);
    }
  }, [applyAvatar, recoverFromSessionFailure]);

  return {
    avatar,
    loading,
    refreshing,
    error,
    hasLoaded,
    refresh,
    upload: {
      pending: uploadPending,
      error: uploadError,
      clearError: () => {
        setUploadError(null);
      },
      submit: upload,
    },
    remove: {
      pending: deletePending,
      error: deleteError,
      clearError: () => {
        setDeleteError(null);
      },
      submit: remove,
    },
  };
}
