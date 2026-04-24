"""
Shared assistant constants.

Purpose:
- Keep fallback text and safety limits centralized for the assistant pipeline.
- Preserve compatibility with persisted conversation fields.
"""

FALLBACK_ANSWER = "Information not found in official documents."
GENERAL_FALLBACK_ANSWER = "Please ask a more specific question."
GENERATION_TEMPORARY_FAILURE_ANSWER = (
    "I found relevant official documents, but I can't generate an answer right now. Please try again."
)

MAX_CONTEXT_CHARS_PER_CHUNK = 1800
MAX_HISTORY_MESSAGES = 8
MAX_HISTORY_CHARS_PER_MESSAGE = 500
MAX_HISTORY_SELECTION_MESSAGES = 6
