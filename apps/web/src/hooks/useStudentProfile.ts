"use client";

/**
 * Student self-profile compatibility hook.
 *
 * Purpose:
 * - Preserve the existing student hook entry point while the actual
 *   self-profile behavior is shared across protected roles.
 */

import { useSelfProfile } from "@/hooks/useSelfProfile";

export function useStudentProfile() {
  return useSelfProfile({
    allowAccountDeletion: true,
    deleteRedirectTo: "/login?auth=account-deleted",
  });
}
