# apps/api/services/document_ingestion_service.py
"""
Document ingestion orchestration service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Download uploaded files from private storage.
- Extract and normalize document text.
- Chunk content deterministically with citation-ready metadata.
- Generate embeddings through the Bytez client.
- Replace document chunks atomically and update processing state.
"""

import asyncio
import hashlib
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import asyncpg

from core.config import settings
from core.logging import get_logger
from services.embedding_service import EmbeddingService
from services.storage_service import StorageService
from services.text_extraction_service import (
    ExtractedPage,
    ExtractionResult,
    TextExtractionService,
)

logger = get_logger(__name__)


@dataclass(frozen=True)
class ChunkDraft:
    """
    Prepared chunk record before embedding persistence.
    """

    chunk_index: int
    content: str
    section_label: Optional[str]
    page_number: Optional[int]
    content_hash: str
    token_count: int


@dataclass(frozen=True)
class ChunkElement:
    """
    Intermediate paragraph-like unit used during chunk assembly.
    """

    text: str
    page_number: Optional[int]
    section_label: Optional[str]


class DocumentIngestionService:
    """
    Backend-controlled indexing pipeline for official university documents.
    """

    @staticmethod
    async def finalize_document(
        connection: asyncpg.Connection,
        document_row: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Finalize and index one uploaded document.
        """

        document_id = str(document_row["id"])
        bucket_name = document_row["bucket_name"]
        object_path = document_row["storage_object_path"]

        await DocumentIngestionService._mark_processing(connection, document_id)

        try:
            file_bytes = await StorageService.download_object(bucket_name, object_path)
            extraction = await asyncio.to_thread(
                TextExtractionService.extract_document,
                document_row["original_filename"],
                document_row["mime_type"],
                file_bytes,
            )

            chunks = DocumentIngestionService._build_chunks(extraction)

            if not chunks:
                raise RuntimeError("Indexing failure: no extractable text found")

            embeddings = await EmbeddingService.embed_texts(
                [chunk.content for chunk in chunks],
                document_id,
            )

            checksum_sha256 = hashlib.sha256(file_bytes).hexdigest()

            async with connection.transaction():
                await connection.execute(
                    """
                    update library.university_documents
                    set
                        checksum_sha256 = $2::text,
                        processing_status = 'processing',
                        indexing_error = null
                    where id = $1::uuid
                    """,
                    document_id,
                    checksum_sha256,
                )

                await connection.execute(
                    "delete from library.document_chunks where document_id = $1::uuid",
                    document_id,
                )

                for chunk, embedding in zip(chunks, embeddings, strict=True):
                    await connection.execute(
                        """
                        insert into library.document_chunks (
                            document_id,
                            content,
                            embedding,
                            chunk_index,
                            section_label,
                            page_number,
                            content_hash,
                            token_count
                        )
                        values (
                            $1::uuid,
                            $2::text,
                            $3::extensions.vector,
                            $4::integer,
                            $5::text,
                            $6::integer,
                            $7::text,
                            $8::integer
                        )
                        """,
                        document_id,
                        chunk.content,
                        DocumentIngestionService._vector_literal(embedding),
                        chunk.chunk_index,
                        chunk.section_label,
                        chunk.page_number,
                        chunk.content_hash,
                        chunk.token_count,
                    )

                await connection.execute(
                    """
                    update library.university_documents
                    set
                        processing_status = 'indexed',
                        indexing_error = null
                    where id = $1::uuid
                    """,
                    document_id,
                )

            logger.info(
                "DOCUMENTS: document indexed",
                extra={
                    "document_id": document_id,
                    "chunk_count": len(chunks),
                    "embedding_batch_count": (len(chunks) + 15) // 16,
                    "extraction_path": extraction.extraction_path,
                },
            )

            return {
                "document_id": document_id,
                "processing_status": "indexed",
                "chunk_count": len(chunks),
            }
        except RuntimeError as exc:
            await DocumentIngestionService._mark_failed(connection, document_id, str(exc))
            raise
        except Exception as exc:
            await DocumentIngestionService._mark_failed(
                connection,
                document_id,
                "Indexing failure",
            )
            logger.error(
                "DOCUMENTS: indexing pipeline crashed",
                extra={
                    "document_id": document_id,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Indexing failure") from exc

    @staticmethod
    async def _mark_processing(
        connection: asyncpg.Connection,
        document_id: str,
    ) -> None:
        await connection.execute(
            """
            update library.university_documents
            set
                processing_status = 'processing',
                indexing_error = null
            where id = $1::uuid
            """,
            document_id,
        )

    @staticmethod
    async def _mark_failed(
        connection: asyncpg.Connection,
        document_id: str,
        error_message: str,
    ) -> None:
        await connection.execute(
            """
            update library.university_documents
            set
                processing_status = 'failed',
                indexing_error = left($2::text, 1000)
            where id = $1::uuid
            """,
            document_id,
            error_message,
        )

    @staticmethod
    def _normalize_chunk_text(text: str) -> str:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @staticmethod
    def _build_chunks(extraction: ExtractionResult) -> List[ChunkDraft]:
        chunk_size = settings.document_chunk_size
        overlap = settings.document_chunk_overlap
        elements = DocumentIngestionService._extract_elements(extraction.pages)

        if not elements and extraction.full_text.strip():
            elements = [
                ChunkElement(
                    text=DocumentIngestionService._normalize_chunk_text(extraction.full_text),
                    page_number=None,
                    section_label=None,
                )
            ]

        chunks: List[ChunkDraft] = []
        current_parts: List[str] = []
        current_page_number: Optional[int] = None
        current_section_label: Optional[str] = None

        for element in elements:
            for segment in DocumentIngestionService._split_large_text(
                element.text,
                chunk_size,
                overlap,
            ):
                if not segment:
                    continue

                candidate_parts = current_parts + [segment]
                candidate_text = "\n\n".join(candidate_parts).strip()

                if current_parts and len(candidate_text) > chunk_size:
                    chunks.append(
                        DocumentIngestionService._finalize_chunk(
                            len(chunks),
                            "\n\n".join(current_parts),
                            current_section_label,
                            current_page_number,
                        )
                    )
                    overlap_text = current_parts[-1][-overlap:].strip() if overlap > 0 else ""
                    current_parts = [overlap_text] if overlap_text else []
                    current_page_number = element.page_number
                    current_section_label = element.section_label or current_section_label

                if not current_parts:
                    current_page_number = element.page_number
                    current_section_label = element.section_label or current_section_label

                if element.section_label:
                    current_section_label = element.section_label

                current_parts.append(segment)

        if current_parts:
            chunks.append(
                DocumentIngestionService._finalize_chunk(
                    len(chunks),
                    "\n\n".join(current_parts),
                    current_section_label,
                    current_page_number,
                )
            )

        logger.info(
            "DOCUMENTS: chunking completed",
            extra={"chunk_count": len(chunks)},
        )
        return chunks

    @staticmethod
    def _extract_elements(pages: List[ExtractedPage]) -> List[ChunkElement]:
        elements: List[ChunkElement] = []

        for page in pages:
            raw_parts = re.split(r"\n\s*\n", page.text)
            for part in raw_parts:
                normalized = DocumentIngestionService._normalize_chunk_text(part)
                if not normalized:
                    continue
                elements.append(
                    ChunkElement(
                        text=normalized,
                        page_number=page.page_number,
                        section_label=DocumentIngestionService._detect_section_label(
                            normalized
                        ),
                    )
                )

        return elements

    @staticmethod
    def _detect_section_label(text: str) -> Optional[str]:
        first_line = text.splitlines()[0].strip()

        if not first_line:
            return None

        if len(first_line) > 120:
            return None

        if first_line.endswith("."):
            return None

        alpha_chars = sum(char.isalpha() for char in first_line)
        if alpha_chars < 3:
            return None

        if first_line.isupper() or first_line.istitle():
            return first_line

        return None

    @staticmethod
    def _split_large_text(text: str, chunk_size: int, overlap: int) -> List[str]:
        normalized = DocumentIngestionService._normalize_chunk_text(text)

        if len(normalized) <= chunk_size:
            return [normalized]

        segments: List[str] = []
        start = 0
        step = max(chunk_size - overlap, 1)

        while start < len(normalized):
            end = min(start + chunk_size, len(normalized))
            segment = normalized[start:end].strip()
            if segment:
                segments.append(segment)
            if end >= len(normalized):
                break
            start += step

        return segments

    @staticmethod
    def _finalize_chunk(
        chunk_index: int,
        content: str,
        section_label: Optional[str],
        page_number: Optional[int],
    ) -> ChunkDraft:
        normalized = DocumentIngestionService._normalize_chunk_text(content)
        return ChunkDraft(
            chunk_index=chunk_index,
            content=normalized,
            section_label=section_label,
            page_number=page_number,
            content_hash=hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
            token_count=len(re.findall(r"\S+", normalized)),
        )

    @staticmethod
    def _vector_literal(embedding: List[float]) -> str:
        return "[" + ",".join(f"{value:.10f}" for value in embedding) + "]"
