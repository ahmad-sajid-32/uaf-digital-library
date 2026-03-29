# apps/api/services/text_extraction_service.py
"""
Document text extraction service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Select the correct extraction strategy by MIME type and file extension.
- Extract text from PDF, DOCX, and TXT files.
- Preserve page-level signals when available for later citation support.
"""

import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import List, Optional

import fitz
from docx import Document

from core.logging import get_logger

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


@dataclass(frozen=True)
class ExtractedPage:
    """
    One extracted page or logical page-like unit.
    """

    page_number: Optional[int]
    text: str


@dataclass(frozen=True)
class ExtractionResult:
    """
    Normalized extraction output consumed by the ingestion service.
    """

    full_text: str
    extraction_path: str
    pages: List[ExtractedPage]


class TextExtractionService:
    """
    Text extraction orchestrator without storage or indexing side effects.
    """

    @staticmethod
    def extract_document(
        original_filename: str,
        mime_type: Optional[str],
        file_bytes: bytes,
    ) -> ExtractionResult:
        """
        Extract normalized text from a supported document type.
        """

        if not file_bytes:
            raise RuntimeError("Invalid input")

        extension = Path(original_filename).suffix.lower()

        if extension not in SUPPORTED_EXTENSIONS:
            raise RuntimeError("Unsupported file type")

        if extension == ".pdf" or (mime_type or "").lower() == "application/pdf":
            return TextExtractionService._extract_pdf(file_bytes)

        if extension == ".docx":
            return TextExtractionService._extract_docx(file_bytes)

        if extension == ".txt" or (mime_type or "").lower().startswith("text/plain"):
            return TextExtractionService._extract_txt(file_bytes)

        raise RuntimeError("Unsupported file type")

    @staticmethod
    def _normalize_text(text: str) -> str:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def _extract_pdf(cls, file_bytes: bytes) -> ExtractionResult:
        pages: List[ExtractedPage] = []

        try:
            with fitz.open(stream=file_bytes, filetype="pdf") as document:
                for index, page in enumerate(document, start=1):
                    page_text = cls._normalize_text(page.get_text("text"))
                    pages.append(ExtractedPage(page_number=index, text=page_text))

                extracted_text = "\n\n".join(page.text for page in pages if page.text)

                logger.info(
                    "DOCUMENTS: extraction path chosen",
                    extra={"extraction_path": "pdf-text"},
                )
                return ExtractionResult(
                    full_text=extracted_text,
                    extraction_path="pdf-text",
                    pages=pages,
                )
        except RuntimeError:
            raise
        except Exception as exc:
            logger.error(
                "DOCUMENTS: pdf extraction failed",
                extra={"error": str(exc)},
            )
            raise RuntimeError("Indexing failure: text extraction failed") from exc

    @classmethod
    def _extract_docx(cls, file_bytes: bytes) -> ExtractionResult:
        try:
            document = Document(BytesIO(file_bytes))
            paragraphs = [
                cls._normalize_text(paragraph.text)
                for paragraph in document.paragraphs
                if paragraph.text and paragraph.text.strip()
            ]
        except Exception as exc:
            logger.error(
                "DOCUMENTS: docx extraction failed",
                extra={"error": str(exc)},
            )
            raise RuntimeError("Indexing failure: text extraction failed") from exc

        full_text = "\n\n".join(paragraphs)
        logger.info(
            "DOCUMENTS: extraction path chosen",
            extra={"extraction_path": "docx"},
        )
        return ExtractionResult(
            full_text=full_text,
            extraction_path="docx",
            pages=[ExtractedPage(page_number=None, text=full_text)],
        )

    @classmethod
    def _extract_txt(cls, file_bytes: bytes) -> ExtractionResult:
        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                full_text = cls._normalize_text(file_bytes.decode(encoding))
                logger.info(
                    "DOCUMENTS: extraction path chosen",
                    extra={"extraction_path": "txt"},
                )
                return ExtractionResult(
                    full_text=full_text,
                    extraction_path="txt",
                    pages=[ExtractedPage(page_number=None, text=full_text)],
                )
            except UnicodeDecodeError:
                continue

        raise RuntimeError("Indexing failure: text extraction failed")
