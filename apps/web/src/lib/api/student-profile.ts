/**
 * Student self-profile transport compatibility layer.
 *
 * Purpose:
 * - Preserve existing student-profile API imports while the actual self-profile
 *   transport is shared across protected roles.
 */

export {
  SelfProfileApiError as StudentProfileApiError,
  deleteMyAccount as deleteStudentAccount,
  isSelfProfileApiError as isStudentProfileApiError,
  syncSelfProfileSession as syncStudentProfileSession,
  updateSelfProfile as updateStudentProfile,
} from "@/lib/api/self-profile";

export type {
  BackendSuccessEnvelope,
  SelfProfileMutationResponse as StudentProfileMutationResponse,
} from "@/lib/api/self-profile";
