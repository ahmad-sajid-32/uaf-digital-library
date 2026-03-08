# apps/api/services/ocr_service.py
"""
OCR-only service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Extract plain English text from image bytes.
- Provide no routing, storage, or document lifecycle logic.

Integration Notes:
- OCR is fallback only for scanned PDFs and direct image uploads.
- Requires a working Tesseract binary in the runtime environment.
"""

from io import BytesIO

from PIL import Image
import pytesseract

from core.logging import get_logger

logger = get_logger(__name__)


class OCRService:
    """
    Stateless OCR helper.
    """

    OCR_LANGUAGE = "eng"

    @staticmethod
    def _ensure_runtime_available() -> None:
        try:
            pytesseract.get_tesseract_version()
        except Exception as exc:
            logger.error(
                "DOCUMENTS: tesseract unavailable",
                extra={"error": str(exc)},
            )
            raise RuntimeError("Indexing failure: OCR engine unavailable") from exc

    @classmethod
    def extract_text_from_image_bytes(cls, image_bytes: bytes) -> str:
        """
        Extract text from image bytes using Tesseract OCR.
        """

        cls._ensure_runtime_available()

        try:
            with Image.open(BytesIO(image_bytes)) as image:
                text = pytesseract.image_to_string(image, lang=cls.OCR_LANGUAGE)
        except Exception as exc:
            logger.error(
                "DOCUMENTS: OCR extraction failed",
                extra={"error": str(exc)},
            )
            raise RuntimeError("Indexing failure: OCR extraction failed") from exc

        return text.strip()
