"""
Pydantic schemas for the AI assistant module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Validate assistant conversation requests.
- Provide normalized response envelopes for persisted conversations and messages.
- Expose explicit OpenAPI request and response examples for the shared assistant.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EmptyData(BaseModel):
    """
    Empty response payload for successful mutations with no body content.
    """


class AssistantAskRequest(BaseModel):
    """
    Query-only request body for assistant turn creation.
    """

    query: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        example="Hi",
    )


class AssistantRenameConversationRequest(BaseModel):
    """
    Request body for conversation title updates.
    """

    title: str = Field(
        ...,
        min_length=1,
        max_length=160,
        example="Semester Freeze Questions",
    )


class AssistantCitationItem(BaseModel):
    """
    Persisted citation metadata for one assistant message source reference.
    """

    document_id: Optional[UUID] = Field(
        default=None,
        example="550e8400-e29b-41d4-a716-446655440000",
    )
    document_title: str = Field(..., example="Semester Rules 2026")
    original_filename: str = Field(..., example="semester-rules.pdf")
    chunk_id: Optional[UUID] = Field(
        default=None,
        example="660e8400-e29b-41d4-a716-446655440000",
    )
    chunk_index: int = Field(..., example=3)
    section_label: Optional[str] = Field(
        default=None,
        example="Semester Freeze Policy",
    )
    page_number: Optional[int] = Field(default=None, example=7)
    similarity_score: float = Field(..., example=0.84)
    rank: int = Field(..., example=1)


class AssistantMessageItem(BaseModel):
    """
    Persisted assistant conversation message row with nested citations.
    """

    id: UUID = Field(..., example="770e8400-e29b-41d4-a716-446655440000")
    role: Literal["user", "assistant"] = Field(..., example="assistant")
    content: str = Field(
        ...,
        example="Students may apply for semester freeze before the midterm examination period, subject to the rules in the official semester policy.",
    )
    intent_profile: Optional[str] = Field(
        default=None,
        example="policy_lookup",
    )
    fallback_used: Optional[bool] = Field(default=None, example=False)
    retrieved_chunks_count: Optional[int] = Field(default=None, example=2)
    created_at: datetime = Field(..., example="2026-04-05T12:30:00Z")
    citations: list[AssistantCitationItem] = Field(default_factory=list)


class AssistantConversationItem(BaseModel):
    """
    Sidebar-safe conversation summary.
    """

    id: UUID = Field(..., example="880e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Semester Freeze Questions")
    created_at: datetime = Field(..., example="2026-04-05T12:29:00Z")
    updated_at: datetime = Field(..., example="2026-04-05T12:30:00Z")
    last_message_at: datetime = Field(..., example="2026-04-05T12:30:00Z")
    last_message_preview: Optional[str] = Field(
        default=None,
        example="Students may apply for semester freeze before the midterm examination period...",
    )


class AssistantConversationListData(BaseModel):
    """
    Conversation-history payload for the sidebar.
    """

    items: list[AssistantConversationItem]


class AssistantConversationData(BaseModel):
    """
    Single-conversation metadata payload.
    """

    conversation: AssistantConversationItem


class AssistantConversationMessagesData(BaseModel):
    """
    Full-thread payload for one conversation.
    """

    conversation_id: UUID = Field(..., example="880e8400-e29b-41d4-a716-446655440000")
    items: list[AssistantMessageItem]


class AssistantTurnData(BaseModel):
    """
    Completed assistant turn payload returned after generation finishes.
    """

    conversation: AssistantConversationItem
    user_message: AssistantMessageItem
    assistant_message: AssistantMessageItem


class AssistantConversationListResponse(BaseModel):
    """
    Normalized 200 response for conversation list reads.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Assistant conversations retrieved successfully")
    data: AssistantConversationListData
    timestamp_ms: int = Field(..., example=1775385000000)


class AssistantConversationResponse(BaseModel):
    """
    Normalized 200 response for single-conversation reads and rename mutations.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Assistant conversation retrieved successfully")
    data: AssistantConversationData
    timestamp_ms: int = Field(..., example=1775385000000)


class AssistantConversationMessagesResponse(BaseModel):
    """
    Normalized 200 response for conversation message history reads.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Assistant messages retrieved successfully")
    data: AssistantConversationMessagesData
    timestamp_ms: int = Field(..., example=1775385000000)


class AssistantTurnResponse(BaseModel):
    """
    Normalized 200 response for completed assistant generation turns.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Assistant turn completed successfully")
    data: AssistantTurnData
    timestamp_ms: int = Field(..., example=1775385000000)


class AssistantDeleteConversationResponse(BaseModel):
    """
    Normalized 200 response for conversation deletion.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Assistant conversation deleted successfully")
    data: EmptyData
    timestamp_ms: int = Field(..., example=1775385000000)


ASSISTANT_CREATE_CONVERSATION_REQUEST_EXAMPLE = {
    "query": "Hi",
}

ASSISTANT_CREATE_CONVERSATION_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Assistant turn completed successfully",
    "data": {
        "conversation": {
            "id": "880e8400-e29b-41d4-a716-446655440000",
            "title": "Semester Freeze Questions",
            "created_at": "2026-04-05T12:29:00Z",
            "updated_at": "2026-04-05T12:30:00Z",
            "last_message_at": "2026-04-05T12:30:00Z",
            "last_message_preview": "Students may apply for semester freeze before the midterm examination period...",
        },
        "user_message": {
            "id": "770e8400-e29b-41d4-a716-446655440001",
            "role": "user",
            "content": "What is the semester freeze policy?",
            "intent_profile": None,
            "fallback_used": None,
            "retrieved_chunks_count": None,
            "created_at": "2026-04-05T12:29:58Z",
            "citations": [],
        },
        "assistant_message": {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "role": "assistant",
            "content": "Students may apply for semester freeze before the midterm examination period, subject to the rules in the official semester policy.",
            "intent_profile": "policy_lookup",
            "fallback_used": False,
            "retrieved_chunks_count": 2,
            "created_at": "2026-04-05T12:30:00Z",
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
                    "rank": 1,
                }
            ],
        },
    },
    "timestamp_ms": 1775385000000,
}

ASSISTANT_LIST_CONVERSATIONS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Assistant conversations retrieved successfully",
    "data": {
        "items": [
            {
                "id": "880e8400-e29b-41d4-a716-446655440000",
                "title": "Semester Freeze Questions",
                "created_at": "2026-04-05T12:29:00Z",
                "updated_at": "2026-04-05T12:30:00Z",
                "last_message_at": "2026-04-05T12:30:00Z",
                "last_message_preview": "Students may apply for semester freeze before the midterm examination period...",
            }
        ],
    },
    "timestamp_ms": 1775385000000,
}

ASSISTANT_GET_MESSAGES_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Assistant messages retrieved successfully",
    "data": {
        "conversation_id": "880e8400-e29b-41d4-a716-446655440000",
        "items": [
            {
                "id": "770e8400-e29b-41d4-a716-446655440001",
                "role": "user",
                "content": "What is the semester freeze policy?",
                "intent_profile": None,
                "fallback_used": None,
                "retrieved_chunks_count": None,
                "created_at": "2026-04-05T12:29:58Z",
                "citations": [],
            },
            {
                "id": "770e8400-e29b-41d4-a716-446655440002",
                "role": "assistant",
                "content": "Students may apply for semester freeze before the midterm examination period, subject to the rules in the official semester policy.",
                "intent_profile": "policy_lookup",
                "fallback_used": False,
                "retrieved_chunks_count": 2,
                "created_at": "2026-04-05T12:30:00Z",
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
                        "rank": 1,
                    }
                ],
            },
        ],
    },
    "timestamp_ms": 1775385000000,
}

ASSISTANT_RENAME_CONVERSATION_REQUEST_EXAMPLE = {
    "title": "Semester Freeze Questions",
}
