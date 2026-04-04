// apps/web/src/components/assistant/assistant-thread.tsx
/**
 * Main conversation surface for the admin assistant workspace.
 *
 * Purpose:
 * - Keep the thread as the primary product surface instead of another card.
 * - Provide the lean topbar, continuous message stream, and thread states.
 * - Dock the composer beneath the thread while preserving message continuity.
 */

"use client";

import * as React from "react";
import {
  BotMessageSquare,
  MessageSquareText,
  PanelLeft,
  RefreshCw,
} from "lucide-react";

import {
  AssistantMessage,
  AssistantPendingTurn,
} from "@/components/assistant/assistant-message";
import { Button } from "@/components/ui/button";
import type {
  AssistantConversationItem,
  AssistantMessageItem,
} from "@/lib/api/assistant";

type AsyncStatus = "idle" | "loading" | "success" | "error";

function AssistantThreadLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`assistant-thread-skeleton-${index + 1}`}
          className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`rounded-3xl border border-border/50 bg-muted/25 ${
              index % 2 === 0
                ? "h-28 w-full max-w-3xl"
                : "h-24 w-full max-w-2xl"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

export function AssistantThread({
  activeConversation,
  hasConversations,
  isDraftConversation,
  messages,
  messagesStatus,
  messagesError,
  messagesRefreshing,
  pendingQuery,
  onRetry,
  onOpenMobileSidebar,
  composer,
}: {
  activeConversation: AssistantConversationItem | null;
  hasConversations: boolean;
  isDraftConversation: boolean;
  messages: AssistantMessageItem[];
  messagesStatus: AsyncStatus;
  messagesError: string | null;
  messagesRefreshing: boolean;
  pendingQuery: string | null;
  onRetry: () => void;
  onOpenMobileSidebar: () => void;
  composer: React.ReactNode;
}): React.JSX.Element {
  const threadBottomRef = React.useRef<HTMLDivElement | null>(null);
  const previousConversationIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const nextConversationId = activeConversation?.id ?? null;
    const behavior =
      previousConversationIdRef.current !== nextConversationId
        ? "auto"
        : "smooth";

    previousConversationIdRef.current = nextConversationId;
    threadBottomRef.current?.scrollIntoView({
      behavior,
      block: "end",
    });
  }, [activeConversation?.id, messages.length, pendingQuery]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/50 px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-10 w-10 rounded-2xl md:hidden"
            onClick={onOpenMobileSidebar}
            aria-label="Open conversation history"
          >
            <PanelLeft className="h-4.5 w-4.5" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground sm:text-lg">
              {activeConversation?.title ?? "New chat"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {isDraftConversation
                  ? hasConversations
                    ? "Start another conversation from official university documents."
                    : "Start your first conversation from official university documents."
                  : ""}
              </span>
              {messagesRefreshing ? (
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Refreshing thread
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <div className="w-full">
          {messagesStatus === "loading" ? (
            <AssistantThreadLoadingState />
          ) : null}

          {messagesStatus === "error" ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/6 px-5 py-6">
              <p className="text-sm font-semibold text-destructive">
                Unable to load this conversation.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {messagesError}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 gap-2 rounded-2xl"
                onClick={onRetry}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : null}

          {messagesStatus !== "loading" &&
          messagesStatus !== "error" &&
          messages.length === 0 &&
          !pendingQuery ? (
            <div className="flex min-h-full items-center justify-center py-10">
              <div className="w-full max-w-xl text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/6 text-primary">
                  {hasConversations && isDraftConversation ? (
                    <MessageSquareText className="h-7 w-7" />
                  ) : (
                    <BotMessageSquare className="h-7 w-7" />
                  )}
                </div>
                <p className="mt-5 text-xl font-semibold text-foreground">
                  {hasConversations && isDraftConversation
                    ? "Start another conversation"
                    : "Ask your first question"}
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Ask one clear question about an official university document.
                  The assistant will keep the conversation thread once the
                  grounded answer is completed.
                </p>
              </div>
            </div>
          ) : null}

          {messagesStatus !== "loading" && messagesStatus !== "error" ? (
            <div className="space-y-6">
              {messages.map((message) => (
                <AssistantMessage key={message.id} message={message} />
              ))}
              {pendingQuery ? (
                <AssistantPendingTurn query={pendingQuery} />
              ) : null}
              <div ref={threadBottomRef} />
            </div>
          ) : null}
        </div>
      </div>

      {composer}
    </div>
  );
}
