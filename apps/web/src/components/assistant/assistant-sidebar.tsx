// apps/web/src/components/assistant/assistant-sidebar.tsx
/**
 * Conversation history surface for the admin assistant workspace.
 *
 * Purpose:
 * - Provide desktop collapse behavior and mobile-friendly conversation history.
 * - Keep new-chat, refresh, rename, and delete actions in the history surface.
 * - Replace the old card-based history widget with a real chat history panel.
 */

"use client";

import * as React from "react";
import {
  ChevronLeft,
  MessageSquareDashed,
  PanelLeft,
  Plus,
  RefreshCw,
} from "lucide-react";

import { AssistantConversationItemRow } from "@/components/assistant/assistant-conversation-item";
import { Button } from "@/components/ui/button";
import type { AssistantConversationItem } from "@/lib/api/assistant";
import { cn } from "@/lib/utils";

type AsyncStatus = "idle" | "loading" | "success" | "error";

function AssistantSidebarLoadingState({
  collapsed,
}: {
  collapsed: boolean;
}): React.JSX.Element {
  if (collapsed) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`assistant-sidebar-rail-skeleton-${index + 1}`}
            className="h-11 rounded-2xl border border-border/60 bg-background/65"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`assistant-sidebar-skeleton-${index + 1}`}
          className="h-22 rounded-2xl border border-border/60 bg-background/65"
        />
      ))}
    </div>
  );
}

export function AssistantSidebar({
  conversations,
  conversationsStatus,
  conversationsError,
  conversationsRefreshing,
  activeConversationId,
  submitPending,
  collapsed = false,
  mobile = false,
  onNewConversation,
  onRefresh,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onToggleCollapse,
}: {
  conversations: AssistantConversationItem[];
  conversationsStatus: AsyncStatus;
  conversationsError: string | null;
  conversationsRefreshing: boolean;
  activeConversationId: string | null;
  submitPending: boolean;
  collapsed?: boolean;
  mobile?: boolean;
  onNewConversation: () => void;
  onRefresh: () => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversation: AssistantConversationItem) => void;
  onDeleteConversation: (conversation: AssistantConversationItem) => void;
  onToggleCollapse?: () => void;
}): React.JSX.Element {
  if (collapsed && !mobile) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center gap-3 px-3 py-3">
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-2xl"
            onClick={onToggleCollapse}
            aria-label="Expand conversation history"
            title="Expand conversation history"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-11 w-11 rounded-2xl"
            onClick={onNewConversation}
            disabled={submitPending}
            aria-label="Start a new conversation"
            title="Start a new conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-2xl"
            onClick={onRefresh}
            disabled={conversationsRefreshing}
            aria-label="Refresh conversations"
            title="Refresh conversations"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                conversationsRefreshing && "animate-spin",
              )}
            />
          </Button>
        </div>

        <div className="min-h-0 w-full flex-1 overflow-y-auto pt-1">
          {conversationsStatus === "loading" ? (
            <AssistantSidebarLoadingState collapsed />
          ) : null}

          {conversationsStatus === "error" ? (
            <div className="grid gap-2">
              <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-2 py-3 text-center text-xs leading-5 text-destructive">
                {conversationsError || "Unable to load history."}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-full rounded-2xl"
                onClick={onRefresh}
                aria-label="Retry loading conversations"
                title="Retry loading conversations"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          ) : null}

          {conversationsStatus === "success" ? (
            <div className="grid gap-2">
              {conversations.map((conversation) => (
                <AssistantConversationItemRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={activeConversationId === conversation.id}
                  collapsed
                  onSelect={onSelectConversation}
                  onRename={onRenameConversation}
                  onDelete={onDeleteConversation}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="shrink-0 border-b border-border/50 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              Admin Assistant
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              Conversation history
            </h2>
          </div>

          {!mobile && onToggleCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-2xl"
              onClick={onToggleCollapse}
              aria-label="Collapse conversation history"
              title="Collapse conversation history"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            className="flex-1 gap-2 rounded-2xl"
            onClick={onNewConversation}
            disabled={submitPending}
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-2xl"
            onClick={onRefresh}
            disabled={conversationsRefreshing}
            aria-label="Refresh conversations"
            title="Refresh conversations"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                conversationsRefreshing && "animate-spin",
              )}
            />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto ">
        {conversationsStatus === "loading" ? (
          <AssistantSidebarLoadingState collapsed={false} />
        ) : null}

        {conversationsStatus === "error" ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/7 px-4 py-5">
            <p className="text-sm font-semibold text-destructive">
              Unable to load conversations.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {conversationsError}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 gap-2 rounded-2xl"
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : null}

        {conversationsStatus === "success" && conversations.length === 0 ? (
          <div className="flex min-h-full items-center justify-center px-2 py-8">
            <div className="max-w-xs text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-primary/20 bg-primary/6 text-primary">
                <MessageSquareDashed className="h-6 w-6" />
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">
                No conversations yet
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with one clear question. The assistant will store the
                conversation after the first grounded turn completes.
              </p>
            </div>
          </div>
        ) : null}

        {conversationsStatus === "success" && conversations.length > 0 ? (
          <div className="grid gap-1.5">
            {conversations.map((conversation) => (
              <AssistantConversationItemRow
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversationId === conversation.id}
                onSelect={onSelectConversation}
                onRename={onRenameConversation}
                onDelete={onDeleteConversation}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
