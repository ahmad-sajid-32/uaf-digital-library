# apps/api/modules/results/schemas.py
"""
Pydantic schemas for the Results Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Validate registration number format for LMS lookups.
- Define normalized response envelopes for result scraping responses.
- Extend the existing result payload with GPA / CGPA summaries.
"""

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, StringConstraints
from typing_extensions import Annotated


REG_NUMBER_PATTERN = r"^\d{4}-[a-zA-Z]+-\d{4}$"


class ResultLookupRequest(BaseModel):
    """
    Request model for validating a registration number.
    """

    reg_number: Annotated[
        str,
        StringConstraints(pattern=REG_NUMBER_PATTERN),
    ] = Field(
        ...,
        example="2022-ag-9159",
        description="Student registration number in UAF LMS format.",
    )


class ResultMetadata(BaseModel):
    """
    Metadata extracted from the LMS result page.
    """

    title: str = Field(..., example="Result Award List")


class ResultTable(BaseModel):
    """
    Tabular result payload extracted from the LMS result page.
    """

    headers: List[str] = Field(
        ...,
        example=[
            "sr",
            "semester",
            "course_code",
            "course_title",
            "credit_hours",
            "total",
            "grade",
        ],
    )
    rows: List[Dict[str, str]] = Field(
        ...,
        example=[
            {
                "sr": "1",
                "semester": "Spring Semester 2024-25",
                "course_code": "CS-508",
                "course_title": "Cloud Computing",
                "credit_hours": "3(2-1)",
                "total": "50",
                "grade": "A",
            }
        ],
    )


class ResultPayload(BaseModel):
    """
    Parsed student result payload.
    """

    metadata: ResultMetadata
    student_info: Dict[str, str] = Field(
        ...,
        example={
            "registration": "2022-ag-9159",
            "student_full_name": "Ahmad Sajid",
        },
    )
    result_table: ResultTable


class CourseGPASummary(BaseModel):
    """
    GPA computation summary for a single course row.
    """

    course_title: str = Field(..., example="Cloud Computing")
    course_code: str = Field(..., example="CS-508")
    credit_hours: int = Field(..., example=3)
    obtained_marks: float = Field(..., example=50.0)
    total_marks: int = Field(..., example=60)
    percentage: float = Field(..., example=83.33)
    computed_grade: str = Field(..., example="A")
    grade_point: float = Field(..., example=4.0)
    quality_points: float = Field(..., example=12.0)


class SemesterGPASummary(BaseModel):
    """
    GPA summary for one semester.
    """

    semester_label: str = Field(..., example="Spring Semester 2024-25")
    total_credit_hours: int = Field(..., example=17)
    total_quality_points: float = Field(..., example=49.67)
    gpa: float = Field(..., example=2.92)
    courses: List[CourseGPASummary]


class SkippedCourseSummary(BaseModel):
    """
    Description of a course row that could not be used in GPA / CGPA computation.
    """

    row_identifier: str = Field(..., example="row_14 | CS-404 | Spring Semester 2023-2024")
    reason: str = Field(..., example="missing credit hours")


class GPASummary(BaseModel):
    """
    Aggregate GPA / CGPA summary for the scraped LMS result.
    """

    calculation_status: Literal["calculated", "partial", "unavailable"] = Field(
        ...,
        example="calculated",
    )
    semesters: List[SemesterGPASummary]
    cgpa: Optional[float] = Field(default=None, example=3.08)
    total_credit_hours: int = Field(..., example=132)
    total_quality_points: float = Field(..., example=406.56)
    skipped_courses: List[SkippedCourseSummary]


class ResultData(BaseModel):
    """
    Data wrapper for normalized success responses.
    """

    result: ResultPayload
    gpa_summary: GPASummary


class ResultResponse(BaseModel):
    """
    Normalized 200 response for result scraping endpoints.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Result retrieved successfully")
    data: ResultData
    timestamp_ms: int = Field(..., example=1741348800000)


RESULT_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Result retrieved successfully",
    "data": {
        "result": {
            "metadata": {
                "title": "Result Award List",
            },
            "student_info": {
                "registration": "2022-ag-9159",
                "student_full_name": "Ahmad Sajid",
            },
            "result_table": {
                "headers": [
                    "sr",
                    "semester",
                    "course_code",
                    "course_title",
                    "credit_hours",
                    "total",
                    "grade",
                ],
                "rows": [
                    {
                        "sr": "1",
                        "semester": "Spring Semester 2024-25",
                        "course_code": "CS-508",
                        "course_title": "Cloud Computing",
                        "credit_hours": "3(2-1)",
                        "total": "50",
                        "grade": "A",
                    }
                ],
            },
        },
        "gpa_summary": {
            "calculation_status": "calculated",
            "semesters": [
                {
                    "semester_label": "Spring Semester 2024-25",
                    "total_credit_hours": 3,
                    "total_quality_points": 12.0,
                    "gpa": 4.0,
                    "courses": [
                        {
                            "course_title": "Cloud Computing",
                            "course_code": "CS-508",
                            "credit_hours": 3,
                            "obtained_marks": 50.0,
                            "total_marks": 60,
                            "percentage": 83.33,
                            "computed_grade": "A",
                            "grade_point": 4.0,
                            "quality_points": 12.0,
                        }
                    ],
                }
            ],
            "cgpa": 4.0,
            "total_credit_hours": 3,
            "total_quality_points": 12.0,
            "skipped_courses": [],
        },
    },
    "timestamp_ms": 1741348800000,
}
