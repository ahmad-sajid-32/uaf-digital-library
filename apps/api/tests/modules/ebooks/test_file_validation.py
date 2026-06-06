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


def test_uploaded_object_accepts_supabase_content_type_field() -> None:
    content = b"%PDF-1.7\ncontent"
    result = EBooksService.validate_uploaded_object(
        {"file_format": "pdf", "file_size_bytes": len(content)},
        {"size": len(content), "content_type": "application/pdf", "metadata": {}},
        content,
    )
    assert result["mime_type"] == "application/pdf"


def test_uploaded_object_rejects_metadata_mismatch() -> None:
    content = b"%PDF-1.7\ncontent"
    with pytest.raises(RuntimeError, match="Stored object violates upload policy"):
        EBooksService.validate_uploaded_object(
            {"file_format": "pdf", "file_size_bytes": len(content)},
            {"size": len(content) + 1, "mimetype": "application/pdf"},
            content,
        )


@pytest.mark.parametrize(
    ("mime_type", "content"),
    [
        ("image/jpeg", b"\xff\xd8\xffdata"),
        ("image/png", b"\x89PNG\r\n\x1a\ndata"),
        ("image/webp", b"RIFF\x04\x00\x00\x00WEBP"),
    ],
)
def test_accepts_valid_cover_signatures(mime_type: str, content: bytes) -> None:
    EBooksService.validate_cover_bytes(mime_type, content)


def test_rejects_spoofed_cover_content() -> None:
    with pytest.raises(RuntimeError, match="Invalid cover image content"):
        EBooksService.validate_cover_bytes("image/png", b"not-an-image")


def test_cover_mime_falls_back_to_valid_extension() -> None:
    assert EBooksService.resolve_cover_mime_type("cover.webp", "") == "image/webp"


def test_cover_mime_rejects_extension_mismatch() -> None:
    with pytest.raises(RuntimeError, match="Invalid cover image type"):
        EBooksService.resolve_cover_mime_type("cover.png", "image/jpeg")
