/**
 * Shared student result contract for the frontend.
 *
 * Purpose:
 * - Keep student result payload types and presentation helpers separate from
 *   browser-only transport code.
 * - Preserve backend-owned academic truth while giving the student UI one
 *   honest place to format labels, numeric values, status copy, and row access.
 */

export interface StudentResultMetadata {
  title: string;
}

export type StudentResultStudentInfo = Record<string, string>;
export type StudentResultTableRow = Record<string, string>;

export interface StudentResultTable {
  headers: string[];
  rows: StudentResultTableRow[];
}

export interface StudentResultPayload {
  metadata: StudentResultMetadata;
  student_info: StudentResultStudentInfo;
  result_table: StudentResultTable;
}

export interface StudentCourseGPASummary {
  course_title: string;
  course_code: string;
  credit_hours: number;
  obtained_marks: number;
  total_marks: number;
  percentage: number;
  computed_grade: string;
  grade_point: number;
  quality_points: number;
}

export interface StudentSemesterGPASummary {
  semester_label: string;
  total_credit_hours: number;
  total_quality_points: number;
  gpa: number;
  courses: StudentCourseGPASummary[];
}

export interface StudentSkippedCourseSummary {
  row_identifier: string;
  reason: string;
}

export type StudentResultCalculationStatus =
  | "calculated"
  | "partial"
  | "unavailable"
  | string;

export interface StudentGPASummary {
  calculation_status: StudentResultCalculationStatus;
  semesters: StudentSemesterGPASummary[];
  cgpa: number | null;
  total_credit_hours: number;
  total_quality_points: number;
  skipped_courses: StudentSkippedCourseSummary[];
}

export interface StudentResultData {
  result: StudentResultPayload;
  gpa_summary: StudentGPASummary;
}

export function getStudentResultRegistration(
  studentInfo: StudentResultStudentInfo,
): string {
  return studentInfo.registration?.trim() || "Not available";
}

export function getStudentResultStudentName(
  studentInfo: StudentResultStudentInfo,
): string {
  return studentInfo.student_full_name?.trim() || "Student name unavailable";
}

export function hasStudentResultContent(data: StudentResultData | null): boolean {
  if (!data) {
    return false;
  }

  return Boolean(
    data.result.metadata.title?.trim()
      || data.result.result_table.headers.length > 0
      || data.result.result_table.rows.length > 0
      || Object.keys(data.result.student_info).length > 0
      || data.gpa_summary.semesters.length > 0
      || data.gpa_summary.skipped_courses.length > 0
      || data.gpa_summary.cgpa !== null,
  );
}

export function formatStudentResultLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatStudentResultNumber(
  value: number | null | undefined,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(value);
}

export function resolveStudentResultRowValue(
  row: StudentResultTableRow,
  header: string,
): string {
  const directValue = row[header];

  if (typeof directValue === "string" && directValue.trim()) {
    return directValue;
  }

  const normalizedHeader = header.trim().toLowerCase();

  const matchedKey = Object.keys(row).find(
    (key) => key.trim().toLowerCase() === normalizedHeader,
  );

  if (!matchedKey) {
    return "—";
  }

  const matchedValue = row[matchedKey];

  return typeof matchedValue === "string" && matchedValue.trim()
    ? matchedValue
    : "—";
}

export function getStudentResultCalculationPresentation(
  status: StudentResultCalculationStatus,
): {
  label: string;
  helper: string;
  toneClassName: string;
} {
  switch (status) {
    case "calculated":
      return {
        label: "Calculated",
        helper: "GPA and CGPA are available.",
        toneClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
      };
    case "partial":
      return {
        label: "Partial",
        helper: "Some academic rows were skipped, so the summary is only partially calculated.",
        toneClassName: "border-amber-500/20 bg-amber-500/10 text-amber-700",
      };
    case "unavailable":
      return {
        label: "Unavailable",
        helper: "GPA summary is not available for this result.",
        toneClassName: "border-border bg-muted text-muted-foreground",
      };
    default:
      return {
        label: formatStudentResultLabel(status),
        helper: "Calculation status from the result record.",
        toneClassName: "border-border bg-muted text-muted-foreground",
      };
  }
}
