// apps/web/src/components/assistant/assistant-conversation-item.tsx
/**
 * Conversation-history row for the admin assistant sidebar.
 *
 * Purpose:
 * - Present one conversation in either expanded row mode or collapsed rail
 *   mode.
 * - Keep rename/delete actions inside the history surface.
 * - Improve scannability over the previous dashboard-card list treatment.
 */

"use client";

import * as React from "react";
import { MoreHorizontal, SquarePen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssistantConversationItem } from "@/lib/api/assistant";
import { cn } from "@/lib/utils";

function formatRelativeTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const diffMs = parsed.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function getConversationMonogram(title: string): string {
  const normalized = title.trim();

  if (!normalized) {
    return "?";
  }

  return normalized.charAt(0).toUpperCase();
}

export function AssistantConversationItemRow({
  conversation,
  isActive,
  collapsed = false,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: AssistantConversationItem;
  isActive: boolean;
  collapsed?: boolean;
  onSelect: (conversationId: string) => void;
  onRename: (conversation: AssistantConversationItem) => void;
  onDelete: (conversation: AssistantConversationItem) => void;
}): React.JSX.Element {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const relativeTime = mounted
    ? formatRelativeTime(conversation.last_message_at)
    : "Recently updated";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          onSelect(conversation.id);
        }}
        className={cn(
          "flex w-full items-center justify-center rounded-2xl border px-0 py-0 transition-colors",
          isActive
            ? "border-primary/35 bg-primary/10 text-primary"
            : "border-border/60 bg-background/70 text-muted-foreground hover:border-primary/20 hover:bg-primary/6 hover:text-foreground",
        )}
        aria-label={conversation.title}
        title={conversation.title}
      >
        <span className="flex h-11 w-11 items-center justify-center text-sm font-bold">
          {getConversationMonogram(conversation.title)}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group/item border-l-3 transition-colors",
        isActive
          ? "border-primary bg-primary/6"
          : "border-transparent bg-transparent hover:border-primary/20 hover:bg-background/40",
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => {
            onSelect(conversation.id);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="truncate text-sm font-semibold text-foreground">
              {conversation.title}
            </p>
            <span
              className="shrink-0 text-[11px] font-medium text-muted-foreground"
              suppressHydrationWarning
            >
              {relativeTime}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {conversation.last_message_preview || "No preview available yet."}
          </p>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-1 h-8 w-8 rounded-xl opacity-100 transition-opacity md:opacity-0 md:group-hover/item:opacity-100 md:group-focus-within/item:opacity-100"
              aria-label="Conversation actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-2xl">
            <DropdownMenuItem
              className="gap-2 rounded-xl"
              onSelect={() => {
                onRename(conversation);
              }}
            >
              <SquarePen className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-xl text-destructive focus:text-destructive"
              onSelect={() => {
                onDelete(conversation);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
