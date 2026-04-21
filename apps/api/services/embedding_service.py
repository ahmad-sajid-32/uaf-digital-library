# apps/api/services/embedding_service.py
"""
Local embedding client for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Generate embeddings locally using a Hugging Face / SentenceTransformers model.
- Keep the embedding provider isolated behind a small, swappable client.
- Validate embedding dimensions before persistence.
"""

import time
from typing import List, Optional

from sentence_transformers import SentenceTransformer

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

EMBEDDING_BATCH_SIZE = 16
_embedding_model: Optional[SentenceTransformer] = None


class EmbeddingService:
    """
    Async-friendly local embedding client with deterministic batching and validation.
    """

    @staticmethod
    def _get_model() -> SentenceTransformer:
        global _embedding_model

        if _embedding_model is None:
            model_name = settings.bytez_embedding_model.strip() or "BAAI/bge-small-en-v1.5"
            logger.info(
                "DOCUMENTS: loading local embedding model",
                extra={
                    "model": model_name,
                },
            )
            _embedding_model = SentenceTransformer(model_name)

        return _embedding_model

    @staticmethod
    async def embed_texts(
        texts: List[str],
        document_id: str,
    ) -> List[List[float]]:
        """
        Generate embeddings locally for normalized chunk text.
        """

        if not texts:
            return []

        model = EmbeddingService._get_model()
        embeddings: List[List[float]] = []

        for batch_start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[batch_start : batch_start + EMBEDDING_BATCH_SIZE]
            started_at = time.perf_counter()

            try:
                batch_embeddings = model.encode(
                    batch,
                    batch_size=len(batch),
                    normalize_embeddings=True,
                    convert_to_numpy=True,
                    show_progress_bar=False,
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

            batch_vectors: List[List[float]] = []
            for embedding in batch_embeddings:
                vector = [float(value) for value in embedding.tolist()]

                if len(vector) != settings.document_embedding_dimensions:
                    raise RuntimeError("Indexing failure: embedding dimension mismatch")

                batch_vectors.append(vector)

            logger.info(
                "DOCUMENTS: embedding batch completed",
                extra={
                    "document_id": document_id,
                    "batch_size": len(batch),
                    "model": settings.bytez_embedding_model,
                    "latency_ms": latency_ms,
                },
            )

            embeddings.extend(batch_vectors)

        return embeddings
