# apps/api/modules/results/parser.py
"""
HTML parser for the Results Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Parse LMS result HTML returned by Selenium.
- Extract page title, student information, and result table content.
- Build normalized course rows needed for GPA / CGPA calculation.
- Raise a clean ValueError when the HTML does not match the expected result shape.
"""

import re
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from core.logging import get_logger

logger = get_logger(__name__)


class ResultParser:
    """
    Parser for UAF LMS result HTML pages.
    """

    _HEADER_ALIASES = {
        "sr": ("sr", "serial", "serial no", "serial number"),
        "semester": ("semester",),
        "teacher_name": ("teacher name", "teacher"),
        "course_code": ("course code", "course no", "course number"),
        "course_title": ("theory title", "course title", "title"),
        "credit_hours": ("credit hours", "credit hour", "credit"),
        "mid": ("mid", "mid term", "midterm"),
        "assignment": ("assignment", "assignments"),
        "final": ("final", "final term"),
        "practical": ("practical", "lab"),
        "total": ("total", "marks total", "obtained total"),
        "grade": ("grade",),
    }

    _REQUIRED_RESULT_FIELDS = {"semester", "credit_hours", "total"}

    @staticmethod
    def parse(html: str) -> Dict[str, Any]:
        """
        Parse LMS result HTML and return structured data.

        Args:
            html (str): Raw HTML returned from the LMS result page.

        Returns:
            Dict[str, Any]: Parsed result payload plus normalized course rows.

        Raises:
            ValueError: If the HTML cannot be parsed into the expected structure.
        """

        try:
            soup = BeautifulSoup(html, "lxml")

            metadata_title = ResultParser._extract_title(soup)
            student_info = ResultParser._extract_student_info(soup)
            headers, rows = ResultParser._extract_result_table(soup)
            parsed_course_rows = ResultParser._extract_course_rows(headers, rows)

            return {
                "metadata": {
                    "title": metadata_title,
                },
                "student_info": student_info,
                "result_table": {
                    "headers": headers,
                    "rows": rows,
                },
                "parsed_course_rows": parsed_course_rows,
            }
        except ValueError:
            raise
        except Exception as exc:
            logger.error(
                "RESULTS: unexpected parser failure",
                extra={"error": str(exc)},
            )
            raise ValueError("Failed to parse result HTML") from exc

    @staticmethod
    def _extract_title(soup: BeautifulSoup) -> str:
        title_node = soup.find("h3", {"align": "center"})

        if title_node is None:
            raise ValueError("Failed to parse result HTML")

        title = " ".join(title_node.stripped_strings)

        if title == "":
            raise ValueError("Failed to parse result HTML")

        return title

    @staticmethod
    def _extract_student_info(soup: BeautifulSoup) -> Dict[str, str]:
        info_table = ResultParser._find_student_info_table(soup)

        if info_table is None:
            raise ValueError("Failed to parse result HTML")

        student_info: Dict[str, str] = {}

        for row in info_table.find_all("tr"):
            cells = row.find_all("td")

            if len(cells) != 2:
                continue

            key = ResultParser._normalize_key(cells[0].get_text(" ", strip=True))
            value = cells[1].get_text(" ", strip=True)

            if key != "" and value != "":
                student_info[key] = value

        if not student_info:
            raise ValueError("Failed to parse result HTML")

        return student_info

    @staticmethod
    def _extract_result_table(soup: BeautifulSoup) -> tuple[List[str], List[Dict[str, str]]]:
        result_table = ResultParser._find_result_table(soup)

        if result_table is None:
            raise ValueError("Failed to parse result HTML")

        table_rows = result_table.find_all("tr")

        if not table_rows:
            raise ValueError("Failed to parse result HTML")

        header_cells = table_rows[0].find_all(["th", "td"])
        raw_headers = [
            cell.get_text(" ", strip=True)
            for cell in header_cells
            if cell.get_text(" ", strip=True) != ""
        ]
        headers = [ResultParser._normalize_key(value) for value in raw_headers]

        if not headers:
            raise ValueError("Failed to parse result HTML")

        rows: List[Dict[str, str]] = []

        for row in table_rows[1:]:
            cells = row.find_all("td")

            if not cells:
                continue

            row_data = {
                headers[index]: cells[index].get_text(" ", strip=True) if index < len(cells) else ""
                for index in range(len(headers))
            }

            if any(value != "" for value in row_data.values()):
                rows.append(row_data)

        if not rows:
            raise ValueError("Failed to parse result HTML")

        return headers, rows

    @staticmethod
    def _extract_course_rows(
        headers: List[str],
        rows: List[Dict[str, str]],
    ) -> List[Dict[str, str]]:
        """
        Build normalized course rows for GPA / CGPA calculation.
        """

        field_map = {
            header: ResultParser._map_header_to_field(header)
            for header in headers
        }

        parsed_rows: List[Dict[str, str]] = []

        for index, row in enumerate(rows, start=1):
            semester_label = row.get("semester", "").strip()
            course_code = ResultParser._first_non_empty(
                row.get("course_code", ""),
                ResultParser._lookup_mapped_value(row, field_map, "course_code"),
            )
            course_title = ResultParser._first_non_empty(
                row.get("course_title", ""),
                ResultParser._lookup_mapped_value(row, field_map, "course_title"),
            )

            parsed_row = {
                "row_identifier": ResultParser._build_row_identifier(
                    index=index,
                    sr=ResultParser._lookup_mapped_value(row, field_map, "sr"),
                    course_code=course_code,
                    semester_label=semester_label,
                ),
                "semester_label": ResultParser._first_non_empty(
                    semester_label,
                    ResultParser._lookup_mapped_value(row, field_map, "semester"),
                ),
                "course_title": course_title,
                "course_code": course_code,
                "credit_hours": ResultParser._lookup_mapped_value(row, field_map, "credit_hours"),
                "total_obtained_marks": ResultParser._lookup_mapped_value(row, field_map, "total"),
                "grade_letter": ResultParser._lookup_mapped_value(row, field_map, "grade"),
                "mid": ResultParser._lookup_mapped_value(row, field_map, "mid"),
                "assignment": ResultParser._lookup_mapped_value(row, field_map, "assignment"),
                "final": ResultParser._lookup_mapped_value(row, field_map, "final"),
                "practical": ResultParser._lookup_mapped_value(row, field_map, "practical"),
            }
            parsed_rows.append(parsed_row)

        return parsed_rows

    @staticmethod
    def _find_student_info_table(soup: BeautifulSoup) -> Optional[Any]:
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            pair_rows = 0

            for row in rows:
                if len(row.find_all("td")) == 2:
                    pair_rows += 1

            if pair_rows >= 2:
                return table

        return None

    @staticmethod
    def _find_result_table(soup: BeautifulSoup) -> Optional[Any]:
        for table in soup.find_all("table"):
            first_row = table.find("tr")

            if first_row is None:
                continue

            header_texts = [
                ResultParser._normalize_header_text(cell.get_text(" ", strip=True))
                for cell in first_row.find_all(["th", "td"])
                if cell.get_text(" ", strip=True) != ""
            ]

            if not header_texts:
                continue

            mapped_fields = {
                ResultParser._map_header_to_field(header)
                for header in header_texts
            }
            mapped_fields.discard(None)

            if ResultParser._REQUIRED_RESULT_FIELDS.issubset(mapped_fields):
                return table

        return None

    @staticmethod
    def _lookup_mapped_value(
        row: Dict[str, str],
        field_map: Dict[str, Optional[str]],
        field_name: str,
    ) -> str:
        for header, mapped_field in field_map.items():
            if mapped_field == field_name:
                return row.get(header, "").strip()

        return ""

    @staticmethod
    def _map_header_to_field(header: str) -> Optional[str]:
        normalized_header = ResultParser._normalize_header_text(header)

        for field_name, aliases in ResultParser._HEADER_ALIASES.items():
            for alias in aliases:
                if normalized_header == alias or alias in normalized_header:
                    return field_name

        return None

    @staticmethod
    def _build_row_identifier(
        index: int,
        sr: str,
        course_code: str,
        semester_label: str,
    ) -> str:
        parts = [f"row_{index}"]

        if sr.strip():
            parts.append(f"sr_{sr.strip()}")

        if course_code.strip():
            parts.append(course_code.strip())

        if semester_label.strip():
            parts.append(semester_label.strip())

        return " | ".join(parts)

    @staticmethod
    def _first_non_empty(*values: str) -> str:
        for value in values:
            if value and value.strip():
                return value.strip()

        return ""

    @staticmethod
    def _normalize_header_text(raw_value: str) -> str:
        normalized_value = raw_value.strip().lower()
        normalized_value = re.sub(r"[^a-z0-9]+", " ", normalized_value)
        normalized_value = re.sub(r"\s+", " ", normalized_value)
        return normalized_value.strip()

    @staticmethod
    def _normalize_key(raw_value: str) -> str:
        normalized_value = ResultParser._normalize_header_text(raw_value)
        return normalized_value.replace(" ", "_")
