// apps/web/src/hooks/use-app-auth.ts
/**
 * Thin hook wrapper for the normalized client auth store.
 *
 * Screens and layouts should consume this hook instead of pulling raw Supabase
 * session payloads directly into UI code.
 */

"use client";

import { useAuthContext } from "@/components/providers/auth-provider";

export function useAppAuth() {
  return useAuthContext();
}
