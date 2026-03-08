# apps/api/modules/results/calculator.py
"""
GPA / CGPA calculation logic for the Results Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Convert parsed LMS course rows into deterministic GPA / CGPA summaries.
- Apply the exact UAF progressive quality-point formula.
- Keep academic calculation logic separate from scraping and HTML parsing.
"""

import re
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from core.logging import get_logger

logger = get_logger(__name__)


def normalize_number(value: str) -> Optional[float]:
    """
    Convert a text value into a numeric value when possible.

    Args:
        value (str): Raw text value from the parsed LMS row.

    Returns:
        Optional[float]: Parsed number, or None when the value is empty or invalid.
    """

    normalized_value = value.strip()

    if normalized_value == "":
        return None

    normalized_value = normalized_value.replace(",", "")

    if not re.fullmatch(r"-?\d+(\.\d+)?", normalized_value):
        return None

    try:
        return float(normalized_value)
    except ValueError:
        return None


def normalize_credit_hours(value: str) -> Optional[int]:
    """
    Extract the leading credit-hour number from LMS text like ``3(2-1)``.

    Args:
        value (str): Raw credit-hours text.

    Returns:
        Optional[int]: Parsed credit hours, or None when extraction fails.
    """

    normalized_value = value.strip()

    if normalized_value == "":
        return None

    match = re.match(r"^(\d+)", normalized_value)

    if match is None:
        return None

    return int(match.group(1))


def compute_grade_letter(percentage: float) -> str:
    """
    Compute the UAF grade label from percentage.

    Args:
        percentage (float): Course percentage.

    Returns:
        str: Grade letter.
    """

    if percentage >= 80:
        return "A"

    if percentage >= 65:
        return "B"

    if percentage >= 50:
        return "C"

    if percentage >= 40:
        return "D"

    return "F"


def _compute_grade_point_value(percentage: float) -> float:
    if percentage < 40:
        return 0.0

    if percentage < 50:
        return 1 + ((percentage - 40) / 10)

    if percentage < 65:
        return 2 + ((percentage - 50) / 15)

    if percentage < 80:
        return 3 + ((percentage - 65) / 15)

    return 4.0


def compute_grade_point(percentage: float) -> float:
    """
    Compute the exact UAF progressive grade point and round it to 2 decimals.

    Args:
        percentage (float): Course percentage.

    Returns:
        float: Rounded grade point.
    """

    return round(_compute_grade_point_value(percentage), 2)


def _compute_quality_points_value(grade_point_value: float, credit_hours: int) -> float:
    return grade_point_value * credit_hours


def compute_quality_points(grade_point: float, credit_hours: int) -> float:
    """
    Compute rounded quality points for a course.

    Args:
        grade_point (float): Grade point for the course.
        credit_hours (int): Credit hours for the course.

    Returns:
        float: Rounded quality points.
    """

    return round(_compute_quality_points_value(grade_point, credit_hours), 2)


class ResultCalculator:
    """
    Deterministic GPA / CGPA calculator for parsed LMS results.
    """

    @classmethod
    def build_semester_gpa_summary(cls, parsed_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build semester GPA and final CGPA summary from parsed LMS rows.

        Args:
            parsed_result (Dict[str, Any]): Parsed LMS result payload returned by ResultParser.

        Returns:
            Dict[str, Any]: GPA / CGPA summary block.
        """

        parsed_course_rows = parsed_result.get("parsed_course_rows", [])
        semester_buckets: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        skipped_courses: List[Dict[str, str]] = []
        valid_courses_count = 0
        overall_credit_hours = 0
        overall_quality_points = 0.0

        for course_row in parsed_course_rows:
            validation_error = cls._validate_course_row(course_row)

            if validation_error is not None:
                skipped_courses.append(validation_error)
                continue

            semester_label = course_row["semester_label"].strip()
            credit_hours = normalize_credit_hours(course_row["credit_hours"])
            obtained_marks = normalize_number(course_row["total_obtained_marks"])

            if credit_hours is None or obtained_marks is None:
                skipped_courses.append(
                    cls._build_skipped_course(
                        course_row,
                        "unexpected numeric normalization failure",
                    )
                )
                continue

            total_marks = credit_hours * 20
            percentage_value = (obtained_marks / total_marks) * 100
            grade_point_value = _compute_grade_point_value(percentage_value)
            quality_points_value = _compute_quality_points_value(
                grade_point_value,
                credit_hours,
            )

            course_summary = {
                "course_title": course_row["course_title"].strip(),
                "course_code": course_row["course_code"].strip(),
                "credit_hours": credit_hours,
                "obtained_marks": round(obtained_marks, 2),
                "total_marks": total_marks,
                "percentage": round(percentage_value, 2),
                "computed_grade": compute_grade_letter(percentage_value),
                "grade_point": round(grade_point_value, 2),
                "quality_points": round(quality_points_value, 2),
            }

            if semester_label not in semester_buckets:
                semester_buckets[semester_label] = {
                    "semester_label": semester_label,
                    "total_credit_hours_raw": 0,
                    "total_quality_points_raw": 0.0,
                    "courses": [],
                }

            semester_buckets[semester_label]["total_credit_hours_raw"] += credit_hours
            semester_buckets[semester_label]["total_quality_points_raw"] += quality_points_value
            semester_buckets[semester_label]["courses"].append(course_summary)

            overall_credit_hours += credit_hours
            overall_quality_points += quality_points_value
            valid_courses_count += 1

        semesters = [
            cls._build_semester_output(bucket)
            for bucket in semester_buckets.values()
        ]

        if valid_courses_count == 0:
            calculation_status = "unavailable"
            cgpa = None
        elif skipped_courses:
            calculation_status = "partial"
            cgpa = round(overall_quality_points / overall_credit_hours, 2)
        else:
            calculation_status = "calculated"
            cgpa = round(overall_quality_points / overall_credit_hours, 2)

        summary = {
            "calculation_status": calculation_status,
            "semesters": semesters,
            "cgpa": cgpa,
            "total_credit_hours": overall_credit_hours,
            "total_quality_points": round(overall_quality_points, 2),
            "skipped_courses": skipped_courses,
        }

        logger.info(
            "RESULTS: GPA summary built",
            extra={
                "semesters_detected": len(semesters),
                "valid_courses_count": valid_courses_count,
                "skipped_courses_count": len(skipped_courses),
                "calculation_status": calculation_status,
                "cgpa": cgpa,
            },
        )

        return summary

    @classmethod
    def _validate_course_row(cls, course_row: Dict[str, str]) -> Optional[Dict[str, str]]:
        semester_label = course_row.get("semester_label", "").strip()

        if semester_label == "":
            return cls._build_skipped_course(course_row, "missing semester label")

        credit_hours_value = course_row.get("credit_hours", "")
        credit_hours = normalize_credit_hours(credit_hours_value)

        if credit_hours_value.strip() == "" or credit_hours is None:
            return cls._build_skipped_course(course_row, "missing credit hours")

        if credit_hours <= 0:
            return cls._build_skipped_course(course_row, "invalid credit hours")

        obtained_marks_value = course_row.get("total_obtained_marks", "")
        obtained_marks = normalize_number(obtained_marks_value)

        if obtained_marks_value.strip() == "" or obtained_marks is None:
            return cls._build_skipped_course(course_row, "missing total obtained marks")

        if obtained_marks > (credit_hours * 20):
            return cls._build_skipped_course(course_row, "obtained marks exceed total marks")

        return None

    @staticmethod
    def _build_skipped_course(course_row: Dict[str, str], reason: str) -> Dict[str, str]:
        return {
            "row_identifier": course_row.get("row_identifier", "unknown_row"),
            "reason": reason,
        }

    @staticmethod
    def _build_semester_output(bucket: Dict[str, Any]) -> Dict[str, Any]:
        total_credit_hours = bucket["total_credit_hours_raw"]
        total_quality_points = bucket["total_quality_points_raw"]

        gpa = 0.0

        if total_credit_hours > 0:
            gpa = round(total_quality_points / total_credit_hours, 2)

        return {
            "semester_label": bucket["semester_label"],
            "total_credit_hours": total_credit_hours,
            "total_quality_points": round(total_quality_points, 2),
            "gpa": gpa,
            "courses": bucket["courses"],
        }
