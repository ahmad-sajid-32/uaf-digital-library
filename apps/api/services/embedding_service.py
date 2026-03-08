# apps/api/services/embedding_service.py
"""
Bytez embedding client for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Send chunk batches to Bytez embeddings API.
- Keep the embedding provider isolated behind a small, swappable client.
- Validate response shape and embedding dimensions before persistence.
"""

import time
from typing import List
from urllib.parse import quote

import httpx

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

EMBEDDING_BATCH_SIZE = 16


class EmbeddingService:
    """
    Async embedding client with deterministic batching and validation.
    """

    @staticmethod
    async def embed_texts(
        texts: List[str],
        document_id: str,
    ) -> List[List[float]]:
        """
        Generate embeddings for normalized chunk text.
        """

        if not settings.bytez_api_key.strip():
            raise RuntimeError("Indexing failure: Bytez API key is missing")

        embeddings: List[List[float]] = []

        async with httpx.AsyncClient(timeout=120) as client:
            for batch_start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
                batch = texts[batch_start : batch_start + EMBEDDING_BATCH_SIZE]
                started_at = time.perf_counter()

                try:
                    batch_embeddings = []
                    for text in batch:
                        response = await client.post(
                            EmbeddingService._build_model_run_url(),
                            headers={
                                "Authorization": settings.bytez_api_key,
                                "Content-Type": "application/json",
                            },
                            json={
                                "text": text,
                                "params": {
                                    "dimensions": settings.document_embedding_dimensions
                                },
                            },
                        )
                        response.raise_for_status()
                        payload = response.json()
                        batch_embeddings.append(
                            EmbeddingService._parse_single_embedding(payload)
                        )
                except Exception as exc:
                    logger.error(
                        "DOCUMENTS: embedding batch failed",
                        extra={
                            "document_id": document_id,
                            "batch_size": len(batch),
                            "model": settings.bytez_embedding_model,
                            "error": str(exc),
                        },
                    )
                    raise RuntimeError("Indexing failure: embedding generation failed") from exc

                latency_ms = int((time.perf_counter() - started_at) * 1000)

                for embedding in batch_embeddings:
                    if len(embedding) != settings.document_embedding_dimensions:
                        raise RuntimeError("Indexing failure: embedding dimension mismatch")

                logger.info(
                    "DOCUMENTS: embedding batch completed",
                    extra={
                        "document_id": document_id,
                        "batch_size": len(batch),
                        "model": settings.bytez_embedding_model,
                        "latency_ms": latency_ms,
                    },
                )

                embeddings.extend(batch_embeddings)

        return embeddings

    @staticmethod
    def _build_model_run_url() -> str:
        model_id = quote(settings.bytez_embedding_model, safe="")
        return f"https://api.bytez.com/models/v2/{model_id}"

    @staticmethod
    def _parse_single_embedding(payload: dict) -> List[float]:
        if payload.get("error"):
            raise RuntimeError(str(payload["error"]))

        output = payload.get("output")

        if isinstance(output, list) and output and isinstance(output[0], (int, float)):
            return [float(value) for value in output]

        if isinstance(output, list) and output and isinstance(output[0], list):
            first_embedding = output[0]
            if first_embedding and isinstance(first_embedding[0], (int, float)):
                return [float(value) for value in first_embedding]

        raise RuntimeError("Indexing failure: invalid embedding response")
