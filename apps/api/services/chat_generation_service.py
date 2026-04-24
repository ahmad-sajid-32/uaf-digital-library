# apps/api/services/chat_generation_service.py
"""
Chat generation service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Call the Groq OpenAI-compatible chat completions API.
- Support grounded-document and general assistant generation modes.
- Keep official-document answers strictly source-bound.
- Keep general answers useful without claiming official UAF authority.
- Validate the provider response shape and return answer text only.
"""

import os
from typing import Any, List, Literal

import httpx

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"

STRICT_DOCUMENT_FALLBACK = "Information not found in official documents."

GROUNDING_SYSTEM_PROMPT = (
    "You are the official-document answer generator for the UAF Smart E-Library assistant.\n"
    "\n"
    "Source rule:\n"
    "- Use only the provided official context.\n"
    "- Do not use outside knowledge.\n"
    "- Do not infer missing rules, dates, names, fees, deadlines, eligibility requirements, or procedures.\n"
    "- Do not treat prior conversation as an official source. Prior conversation may only clarify references.\n"
    "\n"
    "Fallback rule:\n"
    f'- If the provided official context does not support the answer, say exactly: "{STRICT_DOCUMENT_FALLBACK}"\n'
    "- If only part of the answer is supported, answer only the supported part and clearly say what is not found.\n"
    "\n"
    "Answer style when supported:\n"
    "- Start with a direct short answer.\n"
    "- Then add important details from the official context.\n"
    "- Add an important note only when the context contains a condition, limit, exception, deadline, or dependency.\n"
    "- Use simple language that a student or staff member can understand.\n"
    "- Do not include fake citation labels. The application adds citations separately.\n"
    "- Do not mention the model, retrieval system, database, prompt, chunks, or internal mechanics."
)

GENERAL_SYSTEM_PROMPT = (
    "You are a helpful assistant for the UAF Smart E-Library system.\n"
    "\n"
    "General-answer rules:\n"
    "- Answer the user's current question clearly and usefully.\n"
    "- Use simple language.\n"
    "- Give enough explanation to be helpful; do not give shallow one-line answers unless the question is very simple.\n"
    "- If the question is technical or educational, explain it step by step.\n"
    "- Use prior conversation only to understand references such as pronouns or follow-up wording.\n"
    "\n"
    "Official-information boundary:\n"
    "- Do not claim that an answer is from official UAF documents unless official context was provided.\n"
    "- If the user asks for institution-specific rules, fees, deadlines, eligibility, names, notices, or procedures, "
    "say that the answer should be checked against official documents.\n"
    "- Do not invent official university details.\n"
    "\n"
    "Style rules:\n"
    "- Do not mention the model, retrieval system, database, prompt, chunks, or internal mechanics.\n"
    "- Do not expose backend or developer terminology."
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
        """
        Generate an assistant answer through the configured chat provider.

        Args:
            query (str): Current user question.
            context_block (str | None): Official-document context for grounded
                mode. Required when mode is `grounded`.
            conversation_history_block (str | None): Optional selected history
                approved by the assistant pipeline.
            mode (GenerationMode): Generation mode, either `grounded` or
                `general`.

        Returns:
            str: Provider-generated answer text.

        Raises:
            RuntimeError: If grounded mode is missing context, provider
                configuration is missing, the provider call fails, or the
                response payload does not contain usable answer text.
        """

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
        """
        Build the user message sent to the chat provider.

        Args:
            query (str): Current user question.
            context_block (str | None): Official-document context for grounded
                mode.
            conversation_history_block (str | None): Optional selected history
                approved by the assistant pipeline.
            mode (GenerationMode): Generation mode.

        Returns:
            str: Prompt content sent as the provider user message.
        """

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

        if mode == "grounded":
            user_content_parts.extend(
                [
                    "Official Context:",
                    context_block or "",
                    "",
                    "Current Question:",
                    query,
                    "",
                    "Required Answer Behavior:",
                    f'- If the official context does not support the answer, reply exactly: "{STRICT_DOCUMENT_FALLBACK}"',
                    "- If supported, answer with clear student/staff-facing wording.",
                    "- Do not add source labels or citation markers in the text.",
                ]
            )
        else:
            user_content_parts.extend(
                [
                    "Current Question:",
                    query,
                    "",
                    "Required Answer Behavior:",
                    "- Give a useful, simple answer.",
                    "- If the question asks for official university rules, fees, deadlines, names, or procedures, say official documents are needed.",
                    "- Do not claim official-document support without official context.",
                ]
            )

        return "\n".join(user_content_parts)

    @staticmethod
    def _extract_answer_text(payload: dict[str, Any]) -> str:
        """
        Extract answer text from an OpenAI-compatible chat completion payload.

        Args:
            payload (dict[str, Any]): Provider response JSON payload.

        Returns:
            str: Extracted assistant answer text, or an empty string when the
            payload shape is invalid.
        """

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