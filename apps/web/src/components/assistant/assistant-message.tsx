// apps/web/src/components/assistant/assistant-message.tsx
/**
 * Message rendering for the assistant thread.
 *
 * Purpose:
 * - Replace the old badge-heavy card treatment with cleaner chat hierarchy.
 * - Keep assistant citations visually attached to the assistant answer.
 * - Preserve distinct user and assistant visual rhythm without turning every
 *   turn into a dashboard widget.
 */

"use client";

import * as React from "react";
import { BotMessageSquare, LoaderCircle } from "lucide-react";

import { AssistantCitations } from "@/components/assistant/assistant-citations";
import type { AssistantMessageItem } from "@/lib/api/assistant";

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

export function AssistantMessage({
  message,
}: {
  message: AssistantMessageItem;
}): React.JSX.Element {
  const isUser = message.role === "user";

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
        </div>

        <AssistantCitations citations={message.citations} />

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
            <span>Generating grounded answer...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
