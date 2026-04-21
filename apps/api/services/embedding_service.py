# apps/api/services/embedding_service.py
"""
Compatibility embedding client for the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Keep existing document finalize/index code paths working without external embedding providers.
- Return deterministic placeholder vectors so upload/finalize flows do not fail.
- Retrieval no longer depends on embeddings; text search is handled in retrieval_service.py.
"""

from typing import List

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)


class EmbeddingService:
    """
    Compatibility embedding client.

    Important:
    - These vectors are placeholders only.
    - Retrieval does NOT use them anymore.
    - They exist only so legacy document indexing/finalize flows keep working.
    """

    @staticmethod
    async def embed_texts(
        texts: List[str],
        document_id: str,
    ) -> List[List[float]]:
        dimension = settings.document_embedding_dimensions
        vectors = [[0.0] * dimension for _ in texts]

        logger.info(
            "DOCUMENTS: compatibility embeddings generated",
            extra={
                "document_id": document_id,
                "count": len(texts),
                "dimension": dimension,
            },
        )

        return vectors
