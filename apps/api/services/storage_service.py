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

from typing import Dict, Optional
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

        if signed_upload_url and not signed_upload_url.startswith("http"):
            signed_upload_url = f"{settings.supabase_project_url.rstrip('/')}{signed_upload_url}"

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

        encoded_path = cls._encode_object_path(object_path)
        endpoint = (
            f"{cls._base_url()}/object/info/"
            f"{quote(bucket_name, safe='')}/{encoded_path}"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(endpoint, headers=cls._headers())

        if response.status_code == 404:
            return False

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

        return True

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
