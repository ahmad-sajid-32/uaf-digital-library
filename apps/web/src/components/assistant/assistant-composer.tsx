// apps/web/src/components/assistant/assistant-composer.tsx
/**
 * Docked chat composer for the assistant workspace.
 *
 * Purpose:
 * - Replace the detached dashboard-style form with a chat-native composer dock.
 * - Keep the request surface limited to one query while preserving current
 *   submit and pending behavior.
 * - Attach the composer visually to the thread area instead of rendering it as
 *   a separate page widget.
 */

"use client";

import * as React from "react";
import { LoaderCircle, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AssistantComposer({
  composerQuery,
  isDraftConversation,
  submitPending,
  canSubmitQuery,
  minQueryLength,
  onComposerQueryChange,
  onSubmit,
}: {
  composerQuery: string;
  isDraftConversation: boolean;
  submitPending: boolean;
  canSubmitQuery: boolean;
  minQueryLength: number;
  onComposerQueryChange: (nextValue: string) => void;
  onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
}): React.JSX.Element {
  const trimmedLength = composerQuery.replace(/\s+/g, " ").trim().length;
  const showLengthHint = trimmedLength > 0 && trimmedLength < minQueryLength;

  return (
    <div className="shrink-0 border-t border-border/50 px-3 py-3 sm:px-5 sm:py-4">
      <div className="w-full">
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="rounded-3xl border border-border/55 bg-background px-3 py-3 sm:px-4">
            <div className="flex items-center gap-3">
              <Textarea
                className="max-h-64 overflow-y-auto resize-none rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                placeholder={
                  isDraftConversation
                    ? "Ask about an official policy, fee, admission requirement, or another university document topic..."
                    : "Ask a follow-up question for this conversation..."
                }
                rows={4}
                value={composerQuery}
                onChange={(event) => {
                  onComposerQueryChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                disabled={submitPending}
              />

              <Button
                type="submit"
                className="h-12 shrink-0 gap-2 rounded-2xl px-4"
                disabled={!canSubmitQuery}
              >
                {submitPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {submitPending ? "Generating..." : "Send"}
                </span>
              </Button>
            </div>
          </div>

          <p className="px-1 text-xs leading-5 text-muted-foreground">
            {showLengthHint
              ? `Enter at least ${minQueryLength} characters to send.`
              : "Press Enter to send. Use Shift+Enter for a new line."}
          </p>
        </form>
      </div>
    </div>
  );
}
