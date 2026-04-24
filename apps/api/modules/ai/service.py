"""
Compatibility service wrapper for the assistant module.

Purpose:
- Preserve the existing public `AIService.generate_assistant_turn(...)` contract.
- Delegate internal execution to the layered assistant pipeline.
"""

from typing import Any, Optional

from modules.ai.pipeline import run_assistant_pipeline


class AIService:
    @staticmethod
    async def generate_assistant_turn(
        *,
        user_id: str,
        request_id: Optional[str],
        query: str,
        conversation_messages: Optional[list[dict[str, Any]]] = None,
    ) -> dict[str, Any]:
        return await run_assistant_pipeline(
            user_id=user_id,
            request_id=request_id,
            query=query,
            conversation_messages=conversation_messages or [],
        )
