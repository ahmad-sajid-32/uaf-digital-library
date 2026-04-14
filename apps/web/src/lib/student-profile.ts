/**
 * Student self-profile contract compatibility layer.
 *
 * Purpose:
 * - Preserve existing student-profile imports while the actual self-profile
 *   foundation is shared across protected roles.
 */

export {
  SELF_PROFILE_DELETE_CONFIRMATION as STUDENT_ACCOUNT_DELETE_CONFIRMATION,
  SELF_PROFILE_FULL_NAME_MAX_LENGTH as STUDENT_PROFILE_FULL_NAME_MAX_LENGTH,
  SELF_PROFILE_FULL_NAME_MIN_LENGTH as STUDENT_PROFILE_FULL_NAME_MIN_LENGTH,
  normalizeSelfProfileFullName as normalizeStudentProfileFullName,
  validateSelfProfileFullName as validateStudentProfileFullName,
} from "@/lib/self-profile";

export type {
  SelfProfileIdentity as StudentProfileIdentity,
  SelfProfileUpdatePayload as StudentProfileUpdatePayload,
} from "@/lib/self-profile";
