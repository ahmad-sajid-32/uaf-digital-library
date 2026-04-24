# apps/api/modules/ai/models.py
"""
Internal assistant routing and execution models.

Purpose:
- Define stable internal types for assistant routing and task execution.
- Keep public API payload compatibility while allowing backend pipeline refactors.
- Provide typed boundaries for query quality, intent routing, history selection,
  retrieval profile selection, execution, and response validation.

Integration notes:
- These models are internal to the assistant backend.
- They must not change the public `/api/ai/*` request or response contracts.
- `AssistantService` still persists the existing generated-turn shape.
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


AssistantFallbackPolicy = Literal[
    "none",
    "general_fallback",
    "strict_document_fallback",
]


AssistantResponseKind = Literal[
    "normal",
    "strict_document_fallback",
    "generation_temporary_failure",
    "general_fallback",
]


@dataclass(frozen=True)
class QueryQualityDecision:
    """
    Pre-intent quality decision for one user query.

    This model sits before intent detection. It prevents typo-heavy, empty,
    vague, or incomplete input from being incorrectly routed into RAG or
    follow-up handling.

    Attributes:
        normalized_query: Cleaned query text used by later assistant layers.
        is_valid: Whether the query is usable for normal routing.
        needs_clarification: Whether the assistant should ask for a clearer
            question instead of routing to generation or retrieval.
        reason: Short internal explanation for the quality decision.
    """

    normalized_query: str
    is_valid: bool
    needs_clarification: bool
    reason: str


@dataclass(frozen=True)
class RetrievalProfile:
    """
    Retrieval tuning profile for document-grounded assistant tasks.

    Attributes:
        name: Stable profile name stored through `intent_profile` routing
            metadata.
        top_k: Number of final chunks to provide to grounded generation.
        similarity_threshold: Minimum retrieval threshold used by the document
            search layer.
        document_type: Optional document metadata filter.
        audience_scope: Optional audience metadata filter.
        department: Optional department metadata filter.
    """

    name: str
    top_k: int
    similarity_threshold: float
    document_type: Optional[str] = None
    audience_scope: Optional[str] = None
    department: Optional[str] = None


@dataclass(frozen=True)
class AssistantRoutingDecision:
    """
    Current-turn routing decision produced by intent detection.

    This decision must be based on the current normalized query only. It must
    not concatenate previous conversation messages before initial intent
    classification.

    Attributes:
        intent: Detected current-turn assistant intent.
        execution_mode: Initial execution mode selected for the turn.
        confidence: Deterministic confidence score between 0 and 1.
        reason: Short internal reason explaining the routing choice.
        use_history: Whether intent detection itself requests history. This is
            kept for compatibility, but final history use belongs to
            `ConversationContextDecision`.
        history_window: Requested history window size. Final selection belongs
            to the history selector.
        standalone_query: Current query as understood by the router.
        retrieval_query: Optional retrieval query for direct document questions.
        requires_citations: Whether this route expects source citations.
        requires_official_sources: Whether this route must use official
            university documents only.
    """

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
    """
    History relevance decision for one assistant turn.

    This model decides whether previous conversation content may influence the
    current query. It protects general/help/greeting turns from being polluted
    by earlier document-policy topics.

    Attributes:
        use_history: Whether selected history is allowed for this turn.
        selected_messages: Conversation messages selected for prompt context.
        reason: Short internal reason explaining why history was used or ignored.
        standalone_query: History-aware query used for approved follow-up
            retrieval. When history is ignored, this remains the current query.
    """

    use_history: bool
    selected_messages: list[dict[str, Any]]
    reason: str
    standalone_query: str


@dataclass(frozen=True)
class AssistantTask:
    """
    Executable assistant task produced after routing and history selection.

    This is the handoff object between planning and execution. It tells the
    executor whether to return a static response, generate a general answer,
    retrieve official document chunks, or return clarification.

    Attributes:
        query: Normalized current user query.
        intent: Final effective intent after history selection.
        execution_mode: Final execution mode.
        retrieval_query: Query used for document retrieval, if RAG is selected.
        generation_query: Query passed to the generation service.
        retrieval_profile: Retrieval tuning profile for RAG tasks.
        history_block: Optional selected conversation context for generation.
        fallback_policy: Fallback policy expected for the execution mode.
        requires_citations: Whether generated output requires citations.
        requires_official_sources: Whether output must be grounded in official
            university documents.
        intent_profile: Compatibility metadata persisted on assistant messages.
    """

    query: str
    intent: AssistantIntent
    execution_mode: AssistantExecutionMode
    retrieval_query: Optional[str]
    generation_query: str
    retrieval_profile: Optional[RetrievalProfile]
    history_block: Optional[str]
    fallback_policy: AssistantFallbackPolicy
    requires_citations: bool
    requires_official_sources: bool
    intent_profile: str