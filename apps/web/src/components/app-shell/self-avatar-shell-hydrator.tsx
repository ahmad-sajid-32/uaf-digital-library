"use client";

/**
 * Hydrates the topbar avatar from the backend-owned profile avatar contract.
 */

import { useSelfAvatar } from "@/hooks/useSelfAvatar";

export function SelfAvatarShellHydrator(): null {
  useSelfAvatar({ autoLoad: true });

  return null;
}
