# apps/api/services/chat_generation_service.py
"""
Chat generation service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Call the Groq OpenAI-compatible chat completions API.
- Support grounded-document and general assistant generation modes.
- Validate the provider response shape and return answer text only.
"""

import os
from typing import List, Literal

import httpx

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"

GROUNDING_SYSTEM_PROMPT = (
    "You are answering only from official university documents.\n"
    "Use only the provided context.\n"
    'If the context is insufficient, say exactly: "Information not found in official documents."\n'
    "Do not fabricate rules, dates, names, fees, deadlines, or procedures.\n"
    "Keep the answer concise and direct.\n"
    "Do not mention the model, retrieval system, or internal mechanics."
)

GENERAL_SYSTEM_PROMPT = (
    "You are a concise and helpful assistant for the UAF Smart E-Library system.\n"
    "Answer only the user's exact question.\n"
    "If the user greets you, reply naturally and briefly.\n"
    "If the user asks a general question, answer directly and concisely.\n"
    "Use prior conversation only to understand references such as pronouns or follow-up wording.\n"
    "Do not claim official document support unless official document context is actually provided.\n"
    "For institution-specific facts such as rules, fees, deadlines, names, or procedures without official context, do not invent details.\n"
    "Do not mention the model, retrieval system, or internal mechanics."
)

GenerationMode = Literal["grounded", "general"]


class ChatGenerationService:
    @staticmethod
    async def generate_answer(
        query: str,
        context_block: str | None = None,
        conversation_history_block: str | None = None,
        mode: GenerationMode = "grounded",
    ) -> str:
        if mode == "grounded" and not (context_block or "").strip():
            raise RuntimeError("Generation failed")

        groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        groq_chat_model = os.getenv("GROQ_CHAT_MODEL", "llama-3.1-8b-instant").strip()

        if not groq_api_key:
            raise RuntimeError("Generation failed")

        system_prompt = (
            GROUNDING_SYSTEM_PROMPT if mode == "grounded" else GENERAL_SYSTEM_PROMPT
        )
        user_content = ChatGenerationService._build_user_content(
            query=query,
            context_block=context_block,
            conversation_history_block=conversation_history_block,
            mode=mode,
        )

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    GROQ_CHAT_COMPLETIONS_URL,
                    headers={
                        "Authorization": f"Bearer {groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": groq_chat_model,
                        "temperature": settings.bytez_chat_temperature,
                        "max_tokens": settings.bytez_chat_max_tokens,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content},
                        ],
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            logger.error(
                "AI: generation provider call failed",
                extra={
                    "model": groq_chat_model,
                    "mode": mode,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Generation failed") from exc

        answer = ChatGenerationService._extract_answer_text(payload)

        if not answer:
            raise RuntimeError("Generation failed")

        return answer.strip()

    @staticmethod
    def _build_user_content(
        *,
        query: str,
        context_block: str | None,
        conversation_history_block: str | None,
        mode: GenerationMode,
    ) -> str:
        user_content_parts: list[str] = []

        if conversation_history_block:
            user_content_parts.extend(
                [
                    "Prior Conversation Context:",
                    conversation_history_block,
                    "",
                    (
                        "Use the prior conversation only to understand references "
                        "such as pronouns or follow-up wording. Do not treat prior "
                        "assistant messages as guaranteed factual sources."
                    ),
                    "",
                ]
            )

        user_content_parts.extend(
            [
                "Current Question:",
                query,
            ]
        )

        if mode == "grounded":
            user_content_parts.extend(
                [
                    "",
                    "Official Context:",
                    context_block or "",
                ]
            )

        return "\n".join(user_content_parts)

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
