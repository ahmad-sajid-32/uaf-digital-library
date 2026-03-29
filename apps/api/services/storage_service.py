# apps/api/services/storage_service.py
"""
Supabase private storage service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Create signed upload URLs for the official university-documents bucket.
- Download uploaded objects for backend-controlled indexing.
- Verify object existence before indexing.
- Delete storage objects during document lifecycle cleanup.

Integration Notes:
- Uses Supabase Storage HTTP APIs with the service-role key.
- This service owns storage transport only. It does not mutate document metadata.
"""

from typing import Any, Dict, Optional
from urllib.parse import quote

import httpx

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)


class StorageService:
    """
    Thin async wrapper around Supabase Storage HTTP APIs.
    """

    @staticmethod
    def _headers() -> Dict[str, str]:
        return {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }

    @staticmethod
    def _base_url() -> str:
        return f"{settings.supabase_project_url.rstrip('/')}/storage/v1"

    @staticmethod
    def _encode_object_path(object_path: str) -> str:
        return "/".join(quote(segment, safe="") for segment in object_path.split("/"))

    @classmethod
    def _resolve_signed_storage_url(cls, value: str) -> str:
        """
        Normalize Supabase signed storage URLs into absolute URLs.

        Supabase may return:
        - a fully qualified URL
        - a path starting with `/storage/v1/...`
        - a path starting with `/object/...`
        """

        normalized = value.strip()

        if normalized.startswith("http"):
            return normalized

        if normalized.startswith("/storage/v1/"):
            return f"{settings.supabase_project_url.rstrip('/')}{normalized}"

        if normalized.startswith("/object/"):
            return f"{cls._base_url()}{normalized}"

        return f"{cls._base_url()}/{normalized.lstrip('/')}"

    @classmethod
    async def create_signed_upload_url(
        cls,
        bucket_name: str,
        object_path: str,
    ) -> Dict[str, Optional[str]]:
        """
        Create a signed upload URL for a private bucket object path.
        """

        encoded_path = cls._encode_object_path(object_path)
        endpoint = (
            f"{cls._base_url()}/object/upload/sign/"
            f"{quote(bucket_name, safe='')}/{encoded_path}"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                endpoint,
                headers=cls._headers(),
                json={"upsert": False},
            )

        if response.is_error:
            logger.error(
                "DOCUMENTS: signed upload url request failed",
                extra={
                    "bucket_name": bucket_name,
                    "storage_object_path": object_path,
                    "status_code": response.status_code,
                    "error": response.text,
                },
            )
            raise RuntimeError("Storage request failed")

        payload = response.json()
        token = payload.get("token")
        signed_upload_url = (
            payload.get("signedURL")
            or payload.get("signedUrl")
            or payload.get("url")
        )

        if signed_upload_url:
            signed_upload_url = cls._resolve_signed_storage_url(signed_upload_url)

        if not signed_upload_url and token:
            signed_upload_url = (
                f"{cls._base_url()}/object/upload/sign/"
                f"{quote(bucket_name, safe='')}/{encoded_path}?token={quote(token, safe='')}"
            )

        if not signed_upload_url:
            raise RuntimeError("Storage request failed")

        return {
            "signed_upload_url": signed_upload_url,
            "token": token,
        }

    @classmethod
    async def create_signed_read_url(
        cls,
        bucket_name: str,
        object_path: str,
        *,
        expires_in_seconds: int,
        download_filename: str | None = None,
    ) -> str:
        """
        Create a short-lived signed read URL for a private bucket object path.
        """

        encoded_path = cls._encode_object_path(object_path)
        endpoint = (
            f"{cls._base_url()}/object/sign/"
            f"{quote(bucket_name, safe='')}/{encoded_path}"
        )

        payload: Dict[str, Any] = {"expiresIn": expires_in_seconds}

        if download_filename:
            payload["download"] = download_filename

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                endpoint,
                headers=cls._headers(),
                json=payload,
            )

        if response.is_error:
            logger.error(
                "DOCUMENTS: signed read url request failed",
                extra={
                    "bucket_name": bucket_name,
                    "storage_object_path": object_path,
                    "status_code": response.status_code,
                    "error": response.text,
                },
            )
            raise RuntimeError("Storage request failed")

        body = response.json()
        signed_read_url = (
            body.get("signedURL")
            or body.get("signedUrl")
            or body.get("url")
        )

        if signed_read_url:
            signed_read_url = cls._resolve_signed_storage_url(signed_read_url)

        if not signed_read_url:
            raise RuntimeError("Storage request failed")

        return signed_read_url

    @classmethod
    async def download_object(cls, bucket_name: str, object_path: str) -> bytes:
        """
        Download an object from private storage for backend indexing.
        """

        encoded_path = cls._encode_object_path(object_path)
        endpoint = (
            f"{cls._base_url()}/object/"
            f"{quote(bucket_name, safe='')}/{encoded_path}"
        )

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.get(endpoint, headers=cls._headers())

        if response.status_code == 404:
            raise RuntimeError("Storage object missing")

        if response.is_error:
            logger.error(
                "DOCUMENTS: storage download failed",
                extra={
                    "bucket_name": bucket_name,
                    "storage_object_path": object_path,
                    "status_code": response.status_code,
                    "error": response.text,
                },
            )
            raise RuntimeError("Storage request failed")

        return response.content

    @classmethod
    async def object_exists(cls, bucket_name: str, object_path: str) -> bool:
        """
        Check whether a storage object exists.
        """

        object_info = await cls.get_object_info(bucket_name, object_path)
        return object_info is not None

    @classmethod
    async def get_object_info(
        cls,
        bucket_name: str,
        object_path: str,
    ) -> Dict[str, Any] | None:
        """
        Retrieve storage object metadata for policy enforcement and validation.
        """

        encoded_path = cls._encode_object_path(object_path)
        endpoint = (
            f"{cls._base_url()}/object/info/"
            f"{quote(bucket_name, safe='')}/{encoded_path}"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(endpoint, headers=cls._headers())

        if response.status_code == 404:
            return None

        if response.is_error:
            logger.error(
                "DOCUMENTS: storage info failed",
                extra={
                    "bucket_name": bucket_name,
                    "storage_object_path": object_path,
                    "status_code": response.status_code,
                    "error": response.text,
                },
            )
            raise RuntimeError("Storage request failed")

        return response.json()

    @classmethod
    async def delete_object(cls, bucket_name: str, object_path: str) -> bool:
        """
        Delete a storage object if present.
        """

        encoded_path = cls._encode_object_path(object_path)
        endpoint = (
            f"{cls._base_url()}/object/"
            f"{quote(bucket_name, safe='')}/{encoded_path}"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(endpoint, headers=cls._headers())

        if response.status_code == 404:
            logger.warning(
                "DOCUMENTS: storage object already missing during delete",
                extra={
                    "bucket_name": bucket_name,
                    "storage_object_path": object_path,
                },
            )
            return False

        if response.is_error:
            logger.error(
                "DOCUMENTS: storage delete failed",
                extra={
                    "bucket_name": bucket_name,
                    "storage_object_path": object_path,
                    "status_code": response.status_code,
                    "error": response.text,
                },
            )
            raise RuntimeError("Storage request failed")

        return True
