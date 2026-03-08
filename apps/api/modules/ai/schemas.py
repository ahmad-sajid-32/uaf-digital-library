# apps/api/modules/ai/schemas.py
"""
Pydantic schemas for the AI Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Validate retrieval and grounded-answer requests.
- Provide normalized response envelopes for citation-ready retrieval results.
- Expose explicit OpenAPI request and response examples.
"""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RetrievalSearchRequest(BaseModel):
    """
    Request body for retrieval-only document search.
    """

    query: str = Field(
        ...,
        min_length=3,
        example="What is the semester freeze policy?",
    )
    top_k: Optional[int] = Field(
        default=None,
        ge=1,
        example=5,
    )
    similarity_threshold: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
        example=0.70,
    )
    document_type: Optional[str] = Field(default=None, example="policy")
    audience_scope: Optional[str] = Field(default=None, example="all_students")
    department: Optional[str] = Field(default=None, example="Registrar Office")


class RetrievalResultItem(BaseModel):
    """
    Citation-ready retrieval match row.
    """

    document_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    document_title: str = Field(..., example="Semester Rules 2026")
    original_filename: str = Field(..., example="semester-rules.pdf")
    document_type: Optional[str] = Field(default=None, example="policy")
    audience_scope: Optional[str] = Field(default=None, example="all_students")
    department: Optional[str] = Field(default=None, example="Registrar Office")
    chunk_id: UUID = Field(..., example="660e8400-e29b-41d4-a716-446655440000")
    chunk_index: int = Field(..., example=3)
    section_label: Optional[str] = Field(
        default=None,
        example="Semester Freeze Policy",
    )
    page_number: Optional[int] = Field(default=None, example=7)
    content: str = Field(
        ...,
        example="Students may apply for semester freeze before the midterm examination period...",
    )
    content_hash: Optional[str] = Field(
        default=None,
        example="a4d4a7d91e7851a3f2f57f3f7b8f9a4a1d8d2e8b88c6f1d2e9a0a8f4d3b1e0f9",
    )
    token_count: Optional[int] = Field(default=None, example=142)
    similarity_score: float = Field(..., example=0.84)


class RetrievalSearchData(BaseModel):
    """
    Retrieval payload returned inside the normalized success envelope.
    """

    query: str = Field(..., example="What is the semester freeze policy?")
    applied_top_k: int = Field(..., example=5)
    applied_similarity_threshold: float = Field(..., example=0.70)
    items: List[RetrievalResultItem]


class RetrievalSearchResponse(BaseModel):
    """
    Normalized 200 response for retrieval-only searches.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Document retrieval completed successfully")
    data: RetrievalSearchData
    timestamp_ms: int = Field(..., example=1741395600000)


class AIQueryRequest(BaseModel):
    """
    Request body for grounded answer generation.
    """

    query: str = Field(
        ...,
        min_length=3,
        example="What is the semester freeze policy?",
    )
    top_k: Optional[int] = Field(default=None, ge=1, example=5)
    similarity_threshold: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
        example=0.70,
    )
    document_type: Optional[str] = Field(default=None, example="policy")
    audience_scope: Optional[str] = Field(default=None, example="all_students")
    department: Optional[str] = Field(default=None, example="Registrar Office")


class CitationItem(BaseModel):
    """
    Structured citation metadata derived from retrieval rows.
    """

    document_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    document_title: str = Field(..., example="Semester Rules 2026")
    original_filename: str = Field(..., example="semester-rules.pdf")
    chunk_id: UUID = Field(..., example="660e8400-e29b-41d4-a716-446655440000")
    chunk_index: int = Field(..., example=3)
    section_label: Optional[str] = Field(
        default=None,
        example="Semester Freeze Policy",
    )
    page_number: Optional[int] = Field(default=None, example=7)
    similarity_score: float = Field(..., example=0.84)


class AIQueryData(BaseModel):
    """
    Grounded answer payload returned inside the normalized success envelope.
    """

    query: str = Field(..., example="What is the semester freeze policy?")
    answer: str = Field(
        ...,
        example="Students may apply for semester freeze before the midterm examination period, subject to the conditions stated in the semester rules.",
    )
    fallback_used: bool = Field(..., example=False)
    applied_top_k: int = Field(..., example=5)
    applied_similarity_threshold: float = Field(..., example=0.70)
    citations: list[CitationItem]
    retrieved_chunks_count: int = Field(..., example=2)


class AIQueryResponse(BaseModel):
    """
    Normalized 200 response for grounded answer generation.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Grounded answer generated successfully")
    data: AIQueryData
    timestamp_ms: int = Field(..., example=1741400000000)


RETRIEVAL_SEARCH_REQUEST_EXAMPLE = {
    "query": "What is the semester freeze policy?",
    "top_k": 5,
    "similarity_threshold": 0.70,
    "document_type": "policy",
    "audience_scope": "all_students",
    "department": "Registrar Office",
}

RETRIEVAL_SEARCH_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Document retrieval completed successfully",
    "data": {
        "query": "What is the semester freeze policy?",
        "applied_top_k": 5,
        "applied_similarity_threshold": 0.70,
        "items": [
            {
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "document_title": "Semester Rules 2026",
                "original_filename": "semester-rules.pdf",
                "document_type": "policy",
                "audience_scope": "all_students",
                "department": "Registrar Office",
                "chunk_id": "660e8400-e29b-41d4-a716-446655440000",
                "chunk_index": 3,
                "section_label": "Semester Freeze Policy",
                "page_number": 7,
                "content": "Students may apply for semester freeze before the midterm examination period...",
                "content_hash": "a4d4a7d91e7851a3f2f57f3f7b8f9a4a1d8d2e8b88c6f1d2e9a0a8f4d3b1e0f9",
                "token_count": 142,
                "similarity_score": 0.84,
            }
        ],
    },
    "timestamp_ms": 1741395600000,
}

AI_QUERY_REQUEST_EXAMPLE = {
    "query": "What is the semester freeze policy?",
    "top_k": 5,
    "similarity_threshold": 0.70,
    "document_type": "policy",
    "audience_scope": "all_students",
    "department": "Registrar Office",
}

AI_QUERY_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Grounded answer generated successfully",
    "data": {
        "query": "What is the semester freeze policy?",
        "answer": "Students may apply for semester freeze before the midterm examination period, subject to the conditions stated in the semester rules.",
        "fallback_used": False,
        "applied_top_k": 5,
        "applied_similarity_threshold": 0.70,
        "retrieved_chunks_count": 2,
        "citations": [
            {
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "document_title": "Semester Rules 2026",
                "original_filename": "semester-rules.pdf",
                "chunk_id": "660e8400-e29b-41d4-a716-446655440000",
                "chunk_index": 3,
                "section_label": "Semester Freeze Policy",
                "page_number": 7,
                "similarity_score": 0.84,
            }
        ],
    },
    "timestamp_ms": 1741400000000,
}

AI_QUERY_FALLBACK_EXAMPLE = {
    "status": 200,
    "message": "Grounded answer generated successfully",
    "data": {
        "query": "What is the Mars campus hostel fee?",
        "answer": "Information not found in official documents.",
        "fallback_used": True,
        "applied_top_k": 5,
        "applied_similarity_threshold": 0.70,
        "retrieved_chunks_count": 0,
        "citations": [],
    },
    "timestamp_ms": 1741400000000,
}
