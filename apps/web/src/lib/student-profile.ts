/**
 * Student profile/account contracts.
 *
 * Purpose:
 * - Lock the student self-service profile surface to the current backend truth.
 * - Keep editable-field scope explicit instead of implying a richer profile
 *   contract than the repo currently provides.
 */

import type { AppRole } from "@/lib/auth/types";

export const STUDENT_PROFILE_FULL_NAME_MIN_LENGTH = 2;
export const STUDENT_PROFILE_FULL_NAME_MAX_LENGTH = 100;
export const STUDENT_ACCOUNT_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

export interface StudentProfileIdentity {
  userId: string;
  email: string;
  role: AppRole;
  roleLabel: string;
  fullName: string | null;
}

export interface StudentProfileUpdatePayload {
  full_name: string;
}

export function normalizeStudentProfileFullName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateStudentProfileFullName(value: string): string | null {
  const normalizedValue = normalizeStudentProfileFullName(value);

  if (normalizedValue.length < STUDENT_PROFILE_FULL_NAME_MIN_LENGTH) {
    return "Full name must be at least 2 characters long.";
  }

  if (normalizedValue.length > STUDENT_PROFILE_FULL_NAME_MAX_LENGTH) {
    return "Full name cannot exceed 100 characters.";
  }

  return null;
}

