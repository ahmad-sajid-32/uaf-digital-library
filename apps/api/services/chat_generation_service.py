# apps/api/services/chat_generation_service.py
"""
Grounded chat generation service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Call the Bytez OpenAI-compatible chat completions API.
- Send only grounded prompts built from retrieved official document chunks.
- Validate the provider response shape and return answer text only.
"""

from typing import List

import httpx

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

BYTEZ_CHAT_COMPLETIONS_URL = "https://api.bytez.com/models/v2/openai/v1/chat/completions"

GROUNDING_SYSTEM_PROMPT = (
    "You are answering only from official university documents.\n"
    "Use only the provided context.\n"
    'If the context is insufficient, say exactly: "Information not found in official documents."\n'
    "Do not fabricate rules, dates, names, fees, deadlines, or procedures.\n"
    "Keep the answer concise and direct.\n"
    "Do not mention the model, retrieval system, or internal mechanics."
)


class ChatGenerationService:
    """
    Bytez chat generation adapter with strict grounding controls.
    """

    @staticmethod
    async def generate_answer(
        query: str,
        context_block: str,
    ) -> str:
        """
        Generate a grounded answer from retrieved official context only.
        """

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    BYTEZ_CHAT_COMPLETIONS_URL,
                    headers={
                        "Authorization": f"Bearer {settings.bytez_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.bytez_chat_model,
                        "temperature": settings.bytez_chat_temperature,
                        "max_tokens": settings.bytez_chat_max_tokens,
                        "messages": [
                            {"role": "system", "content": GROUNDING_SYSTEM_PROMPT},
                            {
                                "role": "user",
                                "content": (
                                    f"Question:\n{query}\n\n"
                                    f"Official Context:\n{context_block}"
                                ),
                            },
                        ],
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            logger.error(
                "AI: generation provider call failed",
                extra={
                    "model": settings.bytez_chat_model,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Generation failed") from exc

        answer = ChatGenerationService._extract_answer_text(payload)

        if not answer:
            raise RuntimeError("Generation failed")

        return answer.strip()

    @staticmethod
    def _extract_answer_text(payload: dict) -> str:
        choices = payload.get("choices")

        if isinstance(choices, list) and choices:
            message = choices[0].get("message") or {}
            content = message.get("content")

            if isinstance(content, str):
                return content

            if isinstance(content, list):
                text_parts: List[str] = []
                for item in content:
                    if isinstance(item, dict) and item.get("type") in {"text", "output_text"}:
                        text_value = item.get("text")
                        if isinstance(text_value, str):
                            text_parts.append(text_value)
                return "".join(text_parts)

        return ""
