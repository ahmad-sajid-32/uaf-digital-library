"""Targeted E-Book binary validation tests."""

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

import pytest

from modules.ebooks.service import EBooksService


def _epub(*, include_container: bool = True, mimetype: bytes = b"application/epub+zip") -> bytes:
    target = BytesIO()
    with ZipFile(target, "w") as archive:
        archive.writestr("mimetype", mimetype, compress_type=ZIP_STORED)
        if include_container:
            archive.writestr("META-INF/container.xml", "<container/>", compress_type=ZIP_DEFLATED)
    return target.getvalue()


def test_accepts_pdf_signature() -> None:
    EBooksService.validate_file_bytes("pdf", b"%PDF-1.7\ncontent")


def test_rejects_invalid_pdf_signature() -> None:
    with pytest.raises(RuntimeError, match="Stored PDF is invalid"):
        EBooksService.validate_file_bytes("pdf", b"not-pdf")


def test_accepts_valid_epub_structure() -> None:
    EBooksService.validate_file_bytes("epub", _epub())


@pytest.mark.parametrize("content", [_epub(include_container=False), _epub(mimetype=b"text/plain"), b"not-zip"])
def test_rejects_invalid_epub_structure(content: bytes) -> None:
    with pytest.raises(RuntimeError, match="Stored EPUB is invalid"):
        EBooksService.validate_file_bytes("epub", content)


def test_uploaded_object_must_match_upload_intent() -> None:
    content = b"%PDF-1.7\ncontent"
    result = EBooksService.validate_uploaded_object(
        {"file_format": "pdf", "file_size_bytes": len(content)},
        {"size": len(content), "mimetype": "application/pdf"},
        content,
    )
    assert result == {"mime_type": "application/pdf", "file_size_bytes": len(content)}


def test_uploaded_object_rejects_metadata_mismatch() -> None:
    content = b"%PDF-1.7\ncontent"
    with pytest.raises(RuntimeError, match="Stored object violates upload policy"):
        EBooksService.validate_uploaded_object(
            {"file_format": "pdf", "file_size_bytes": len(content)},
            {"size": len(content) + 1, "mimetype": "application/pdf"},
            content,
        )
