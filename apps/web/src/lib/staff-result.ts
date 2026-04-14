/**
 * Staff result lookup contracts.
 *
 * Purpose:
 * - Keep public registration-number lookup state separate from the protected
 *   student result transport while reusing the same academic payload shape.
 */

import type { StudentResultData } from "@/lib/student-result";

export type StaffResultData = StudentResultData;

export const STAFF_RESULT_REG_NUMBER_PATTERN = /^\d{4}-[a-zA-Z]+-\d{4}$/;

export function normalizeStaffResultRegistration(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function validateStaffResultRegistration(value: string): string | null {
  const normalizedValue = normalizeStaffResultRegistration(value);

  if (!normalizedValue) {
    return "Enter a registration number to fetch the academic result.";
  }

  if (!STAFF_RESULT_REG_NUMBER_PATTERN.test(normalizedValue)) {
    return "Enter a valid registration number in UAF LMS format, for example 2022-ag-9159.";
  }

  return null;
}
