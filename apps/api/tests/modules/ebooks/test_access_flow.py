"""Targeted access URL orchestration tests."""

from uuid import uuid4

import pytest

from modules.ebooks.service import EBooksService
from services.storage_service import StorageService


@pytest.mark.asyncio
async def test_successful_access_signs_url_then_records_one_event(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    async def fake_rpc(user_id: str, sql: str, *args: object) -> object:
        if "can_access_ebook" in sql:
            calls.append("authorize")
            return {
                "bucket_name": "ebooks-private",
                "storage_object_path": "ebooks/example/book.pdf",
                "original_filename": "book.pdf",
            }
        calls.append("record")
        return str(uuid4())

    async def fake_signed_url(*args: object, **kwargs: object) -> str:
        calls.append("sign")
        return "https://example.test/signed"

    monkeypatch.setattr(EBooksService, "_rpc", fake_rpc)
    monkeypatch.setattr(StorageService, "create_signed_read_url", fake_signed_url)

    result = await EBooksService.access_url(str(uuid4()), uuid4(), "preview")

    assert result["url"] == "https://example.test/signed"
    assert calls == ["authorize", "sign", "record"]


@pytest.mark.asyncio
async def test_denied_access_creates_no_url_or_event(monkeypatch: pytest.MonkeyPatch) -> None:
    signed = False

    async def fake_rpc(user_id: str, sql: str, *args: object) -> object:
        raise RuntimeError("E-Book access denied")

    async def fake_signed_url(*args: object, **kwargs: object) -> str:
        nonlocal signed
        signed = True
        return "https://example.test/signed"

    monkeypatch.setattr(EBooksService, "_rpc", fake_rpc)
    monkeypatch.setattr(StorageService, "create_signed_read_url", fake_signed_url)

    with pytest.raises(RuntimeError, match="E-Book access denied"):
        await EBooksService.access_url(str(uuid4()), uuid4(), "download")

    assert signed is False
