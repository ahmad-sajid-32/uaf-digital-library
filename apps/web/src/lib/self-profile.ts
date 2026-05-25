/**
 * Shared self-profile contracts.
 *
 * Purpose:
 * - Keep the self-service profile surface aligned to the current backend truth
 *   for every protected role.
 * - Preserve the intentionally narrow editable scope instead of implying a
 *   richer profile contract than the repo actually supports.
 */

import type { AppRole } from "@/lib/auth/types";

export const SELF_PROFILE_FULL_NAME_MIN_LENGTH = 2;
export const SELF_PROFILE_FULL_NAME_MAX_LENGTH = 100;
export const SELF_PROFILE_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
export const SELF_AVATAR_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const SELF_AVATAR_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export interface SelfProfileIdentity {
  userId: string;
  email: string;
  role: AppRole;
  roleLabel: string;
  fullName: string | null;
}

export interface SelfProfileUpdatePayload {
  full_name: string;
}

export interface SelfAvatarItem {
  avatar_image_path: string | null;
  avatar_image_url: string | null;
  avatar_image_mime_type: string | null;
  avatar_image_size_bytes: number | null;
  avatar_image_updated_at: string | null;
}

export interface SelfAvatarData {
  avatar: SelfAvatarItem;
}

export interface SelfAvatarResponse {
  status: number;
  message: string;
  data: SelfAvatarData;
  timestamp_ms: number;
}

export type SelfAvatarUploadResponse = SelfAvatarResponse;
export type SelfAvatarDeleteResponse = SelfAvatarResponse;

export function normalizeSelfProfileFullName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateSelfProfileFullName(value: string): string | null {
  const normalizedValue = normalizeSelfProfileFullName(value);

  if (normalizedValue.length < SELF_PROFILE_FULL_NAME_MIN_LENGTH) {
    return "Full name must be at least 2 characters long.";
  }

  if (normalizedValue.length > SELF_PROFILE_FULL_NAME_MAX_LENGTH) {
    return "Full name cannot exceed 100 characters.";
  }

  return null;
}

export function isAllowedSelfAvatarMimeType(value: string): boolean {
  return SELF_AVATAR_ALLOWED_MIME_TYPES.includes(
    value as (typeof SELF_AVATAR_ALLOWED_MIME_TYPES)[number],
  );
}
