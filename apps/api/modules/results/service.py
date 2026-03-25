# apps/api/modules/results/service.py
"""
Service layer for the Results Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Resolve the authenticated student's registration number from PostgreSQL.
- Validate the registration number format.
- Scrape LMS HTML through Selenium.
- Parse result HTML into a normalized Python mapping.
- Compute GPA / CGPA from parsed course rows.
- Cache recent results with a bounded in-memory LRU strategy.
"""

from collections import OrderedDict
from copy import deepcopy
from typing import Any, Dict

import asyncpg
from pydantic import ValidationError

from core.database import Database
from core.logging import get_logger
from core.rate_limit import hash_sensitive_value
from modules.results.calculator import ResultCalculator
from modules.results.parser import ResultParser
from modules.results.schemas import ResultLookupRequest
from modules.results.scraper import UAFResultScraper

logger = get_logger(__name__)


class ResultsService:
    """
    Orchestrator for LMS result scraping and GPA / CGPA calculation.
    """

    _scraper = UAFResultScraper()
    _cache: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
    _cache_size = 100

    @classmethod
    async def get_my_result(cls, user_id: str) -> Dict[str, Any]:
        """
        Fetch the authenticated student's LMS result and GPA summary.

        Args:
            user_id (str): Authenticated user UUID from request context.

        Returns:
            Dict[str, Any]: Structured response payload suitable for Pydantic hydration.

        Raises:
            RuntimeError: On missing profile, invalid registration number, or scrape failure.
        """

        reg_number = await cls._get_reg_number_for_user(user_id)
        return await cls._get_result_by_reg_number(reg_number, user_id=user_id)

    @classmethod
    async def get_public_result(cls, reg_number: str) -> Dict[str, Any]:
        """
        Fetch a student's LMS result and GPA summary from a public registration number lookup.

        Args:
            reg_number (str): Student registration number supplied by the caller.

        Returns:
            Dict[str, Any]: Structured response payload suitable for Pydantic hydration.

        Raises:
            RuntimeError: On invalid registration number or scrape failure.
        """

        return await cls._get_result_by_reg_number(reg_number)

    @classmethod
    async def _get_result_by_reg_number(
        cls,
        reg_number: str,
        user_id: str | None = None,
    ) -> Dict[str, Any]:
        """
        Validate, cache, scrape, parse, and calculate GPA for a result.

        Args:
            reg_number (str): Student registration number.
            user_id (str | None): Optional authenticated user UUID for logging context.

        Returns:
            Dict[str, Any]: Structured response payload suitable for Pydantic hydration.

        Raises:
            RuntimeError: On invalid registration number, scrape failure, or parse failure.
        """

        try:
            validated = ResultLookupRequest(reg_number=reg_number)
        except ValidationError as exc:
            logger.error(
                "RESULTS: invalid registration number",
                extra={
                    "user_id": user_id,
                    "reg_number_hash": hash_sensitive_value(reg_number),
                    "error": str(exc),
                },
            )
            raise RuntimeError("Invalid registration number format") from exc

        cached_result = cls._cache_get(validated.reg_number)

        if cached_result is not None:
            logger.info(
                "RESULTS: cache hit",
                extra={
                    "user_id": user_id,
                    "reg_number_hash": hash_sensitive_value(validated.reg_number),
                },
            )
            return cached_result

        html = await cls._scraper.fetch_html(validated.reg_number)

        try:
            parsed_result = ResultParser.parse(html)
        except ValueError as exc:
            logger.error(
                "RESULTS: parse failed",
                extra={
                    "user_id": user_id,
                    "reg_number_hash": hash_sensitive_value(validated.reg_number),
                    "error": str(exc),
                },
            )
            raise RuntimeError("Failed to parse result HTML") from exc

        gpa_summary = ResultCalculator.build_semester_gpa_summary(parsed_result)
        response_payload = {
            "result": cls._build_public_result_payload(parsed_result),
            "gpa_summary": gpa_summary,
        }

        cls._cache_set(validated.reg_number, response_payload)

        logger.info(
            "RESULTS: result fetched",
            extra={
                "user_id": user_id,
                "reg_number_hash": hash_sensitive_value(validated.reg_number),
                "semesters_detected": len(gpa_summary["semesters"]),
                "valid_courses_count": sum(
                    len(semester["courses"]) for semester in gpa_summary["semesters"]
                ),
                "skipped_courses_count": len(gpa_summary["skipped_courses"]),
                "calculation_status": gpa_summary["calculation_status"],
                "cgpa": gpa_summary["cgpa"],
            },
        )

        return deepcopy(response_payload)

    @staticmethod
    def _build_public_result_payload(parsed_result: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "metadata": deepcopy(parsed_result["metadata"]),
            "student_info": deepcopy(parsed_result["student_info"]),
            "result_table": deepcopy(parsed_result["result_table"]),
        }

    @staticmethod
    async def _get_reg_number_for_user(user_id: str) -> str:
        """
        Resolve the student's registration number from PostgreSQL.

        Args:
            user_id (str): Authenticated user UUID.

        Returns:
            str: Student roll number / registration number.

        Raises:
            RuntimeError: If the student row does not exist.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )
                reg_number = await connection.fetchval(
                    """
                    select s.roll_number
                    from library.students s
                    where s.id = $1::uuid
                    """,
                    user_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "RESULTS: failed to resolve registration number",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Failed to resolve registration number") from exc

        if reg_number is None:
            raise RuntimeError("Profile not found")

        return reg_number

    @classmethod
    def _cache_get(cls, reg_number: str) -> Dict[str, Any] | None:
        cached_value = cls._cache.get(reg_number)

        if cached_value is None:
            return None

        cls._cache.move_to_end(reg_number)
        return deepcopy(cached_value)

    @classmethod
    def _cache_set(cls, reg_number: str, result: Dict[str, Any]) -> None:
        cls._cache[reg_number] = deepcopy(result)
        cls._cache.move_to_end(reg_number)

        if len(cls._cache) > cls._cache_size:
            cls._cache.popitem(last=False)
