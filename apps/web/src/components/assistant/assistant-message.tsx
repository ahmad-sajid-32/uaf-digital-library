// apps/web/src/components/assistant/assistant-message.tsx
/**
 * Message rendering for the assistant thread.
 *
 * Purpose:
 * - Replace the old badge-heavy card treatment with cleaner chat hierarchy.
 * - Keep assistant citations visually attached to supported official-document answers.
 * - Preserve distinct user and assistant visual rhythm without turning every
 *   turn into a dashboard widget.
 * - Avoid showing document-grounding fallback UI for general or clarification
 *   responses.
 */

"use client";

import * as React from "react";
import { BotMessageSquare, LoaderCircle } from "lucide-react";

import type { AssistantMessageItem } from "@/lib/api/assistant";

const STRICT_DOCUMENT_FALLBACK_ANSWER =
  "Information not found in official documents.";

const GENERATION_TEMPORARY_FAILURE_ANSWER =
  "I found relevant official documents, but I can't generate an answer right now. Please try again.";

function formatTimestamp(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function isRagMessage(message: AssistantMessageItem): boolean {
  return String(message.intent_profile ?? "").startsWith("rag:");
}

function resolveDocumentFallbackNotice(
  message: AssistantMessageItem,
): string | null {
  if (message.role !== "assistant") {
    return null;
  }

  if (!Boolean(message.fallback_used)) {
    return null;
  }

  if (!isRagMessage(message)) {
    return null;
  }

  const content = message.content.trim();

  if (content === GENERATION_TEMPORARY_FAILURE_ANSWER) {
    return "Relevant official documents were found, but the assistant could not generate the final answer for this turn.";
  }

  if (content === STRICT_DOCUMENT_FALLBACK_ANSWER) {
    return "No matching official document content was found for this question.";
  }

  return "This answer used the official-document fallback for this turn.";
}

export function AssistantMessage({
  message,
}: {
  message: AssistantMessageItem;
}): React.JSX.Element {
  const isUser = message.role === "user";
  const documentFallbackNotice = resolveDocumentFallbackNotice(message);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-2xl space-y-2">
          <div className="rounded-3xl bg-primary px-4 py-3 text-primary-foreground shadow-sm sm:px-5 sm:py-4">
            <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[0.95rem]">
              {message.content}
            </p>
          </div>
          <p className="px-1 text-right text-xs text-muted-foreground">
            {formatTimestamp(message.created_at)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-4xl space-y-2.5">
        <div className="rounded-3xl border border-border/50 bg-muted/28 px-4 py-3 shadow-sm sm:px-5 sm:py-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <BotMessageSquare className="h-3.5 w-3.5 text-primary" />
            <span>Assistant</span>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground sm:text-[0.95rem]">
            {message.content}
          </p>

          {documentFallbackNotice ? (
            <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-3 py-3 text-sm leading-6 text-amber-950 dark:text-amber-100">
              {documentFallbackNotice}
            </div>
          ) : null}
        </div>

        {/* {renderCitations ? (
          <AssistantCitations citations={message.citations} />
        ) : null} */}

        <p className="px-1 text-xs text-muted-foreground">
          {formatTimestamp(message.created_at)}
        </p>
      </div>
    </div>
  );
}

export function AssistantPendingTurn({
  query,
}: {
  query: string;
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="max-w-2xl rounded-3xl bg-primary px-4 py-3 text-primary-foreground shadow-sm sm:px-5 sm:py-4">
          <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[0.95rem]">
            {query}
          </p>
        </div>
      </div>

      <div className="flex justify-start">
        <div className="max-w-4xl rounded-3xl border border-border/50 bg-muted/28 px-4 py-3 shadow-sm sm:px-5 sm:py-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <BotMessageSquare className="h-3.5 w-3.5 text-primary" />
            <span>Assistant</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Preparing your answer...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
