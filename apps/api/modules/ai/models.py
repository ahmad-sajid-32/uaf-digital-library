"""
Internal assistant routing and execution models.

Purpose:
- Define stable internal types for intent routing and task execution.
- Keep public API payload compatibility while allowing pipeline refactors.
"""

from dataclasses import dataclass
from typing import Any, Literal, Optional


AssistantIntent = Literal[
    "greeting",
    "assistant_help",
    "general_question",
    "document_question",
    "document_follow_up_candidate",
    "document_follow_up",
    "app_navigation_help",
    "library_task_help",
    "clarification_needed",
    "unsupported",
]


AssistantExecutionMode = Literal[
    "static_response",
    "general_generation",
    "rag_generation",
    "app_help_response",
    "clarification_response",
]


@dataclass(frozen=True)
class RetrievalProfile:
    name: str
    top_k: int
    similarity_threshold: float
    document_type: Optional[str] = None
    audience_scope: Optional[str] = None
    department: Optional[str] = None


@dataclass(frozen=True)
class AssistantRoutingDecision:
    intent: AssistantIntent
    execution_mode: AssistantExecutionMode
    confidence: float
    reason: str
    use_history: bool
    history_window: int
    standalone_query: str
    retrieval_query: Optional[str]
    requires_citations: bool
    requires_official_sources: bool


@dataclass(frozen=True)
class ConversationContextDecision:
    use_history: bool
    selected_messages: list[dict[str, Any]]
    reason: str
    standalone_query: str


@dataclass(frozen=True)
class AssistantTask:
    query: str
    intent: AssistantIntent
    execution_mode: AssistantExecutionMode
    retrieval_query: Optional[str]
    generation_query: str
    retrieval_profile: Optional[RetrievalProfile]
    history_block: Optional[str]
    fallback_policy: str
    requires_citations: bool
    requires_official_sources: bool
    intent_profile: str
