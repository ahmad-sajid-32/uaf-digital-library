"use client";

// apps/web/src/hooks/useAssistant.ts
/**
 * Unified assistant hook/state boundary.
 *
 * Purpose:
 * - Keep the shared assistant module state in one hook file.
 * - Centralize conversation history loading, active-thread loading, query
 *   submission, and conversation rename/delete orchestration.
 * - Preserve the backend as the only source of persisted assistant memory.
 */

import * as React from "react";
import { toast } from "sonner";

import {
  appendAssistantMessage,
  createAssistantConversation,
  deleteAssistantConversation,
  getAssistantConversations,
  getAssistantMessages,
  isAssistantApiError,
  renameAssistantConversation,
  type AssistantConversationItem,
  type AssistantMessageItem,
} from "@/lib/api/assistant";
import { useAuthSessionActions } from "@/hooks/useAuthSessionActions";

type AsyncStatus = "idle" | "loading" | "success" | "error";
const MIN_ASSISTANT_QUERY_LENGTH = 1;

interface ConversationMessagesState {
  status: AsyncStatus;
  items: AssistantMessageItem[];
  error: string | null;
  errorStatus: number | null;
  fetchedAt: number | null;
  refreshing: boolean;
}

function getDefaultMessagesState(): ConversationMessagesState {
  return {
    status: "idle",
    items: [],
    error: null,
    errorStatus: null,
    fetchedAt: null,
    refreshing: false,
  };
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sortMessages(items: AssistantMessageItem[]): AssistantMessageItem[] {
  const seenMessageIds = new Set<string>();
  const uniqueItems: AssistantMessageItem[] = [];

  items.forEach((item) => {
    if (seenMessageIds.has(item.id)) {
      return;
    }

    seenMessageIds.add(item.id);
    uniqueItems.push(item);
  });

  return uniqueItems.sort((left, right) => {
    const leftTimestamp = Date.parse(left.created_at);
    const rightTimestamp = Date.parse(right.created_at);
    const leftHasTimestamp = Number.isFinite(leftTimestamp);
    const rightHasTimestamp = Number.isFinite(rightTimestamp);

    if (
      leftHasTimestamp &&
      rightHasTimestamp &&
      leftTimestamp !== rightTimestamp
    ) {
      return leftTimestamp - rightTimestamp;
    }

    if (leftHasTimestamp !== rightHasTimestamp) {
      return leftHasTimestamp ? -1 : 1;
    }

    const leftRoleRank = left.role === "user" ? 0 : 1;
    const rightRoleRank = right.role === "user" ? 0 : 1;

    if (leftRoleRank !== rightRoleRank) {
      return leftRoleRank - rightRoleRank;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortConversations(
  items: AssistantConversationItem[],
): AssistantConversationItem[] {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.last_message_at).getTime();
    const rightTime = new Date(right.last_message_at).getTime();

    if (leftTime === rightTime) {
      return left.id.localeCompare(right.id);
    }

    return rightTime - leftTime;
  });
}

function upsertConversation(
  items: AssistantConversationItem[],
  nextConversation: AssistantConversationItem,
): AssistantConversationItem[] {
  const withoutCurrent = items.filter(
    (item) => item.id !== nextConversation.id,
  );
  return sortConversations([nextConversation, ...withoutCurrent]);
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function isAbortError(error: unknown): boolean {
  return Boolean(error instanceof Error && error.name === "AbortError");
}

export function useAssistant() {
  const { recoverFromSessionFailure } = useAuthSessionActions();
  const initialSelectionResolvedRef = React.useRef(false);
  const [conversations, setConversations] = React.useState<
    AssistantConversationItem[]
  >([]);
  const [conversationsStatus, setConversationsStatus] =
    React.useState<AsyncStatus>("idle");
  const [conversationsError, setConversationsError] = React.useState<
    string | null
  >(null);
  const [conversationsErrorStatus, setConversationsErrorStatus] =
    React.useState<number | null>(null);
  const [conversationsRefreshing, setConversationsRefreshing] =
    React.useState(false);
  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(null);
  const [composerQuery, setComposerQuery] = React.useState("");
  const [messagesByConversation, setMessagesByConversation] = React.useState<
    Record<string, ConversationMessagesState>
  >({});
  const [submitPending, setSubmitPending] = React.useState(false);
  const [pendingQuery, setPendingQuery] = React.useState<string | null>(null);
  const [renamePendingConversationId, setRenamePendingConversationId] =
    React.useState<string | null>(null);
  const [deletePendingConversationId, setDeletePendingConversationId] =
    React.useState<string | null>(null);
  const conversationsRef = React.useRef(conversations);
  const conversationsStatusRef = React.useRef(conversationsStatus);
  const messagesByConversationRef = React.useRef(messagesByConversation);

  React.useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  React.useEffect(() => {
    conversationsStatusRef.current = conversationsStatus;
  }, [conversationsStatus]);

  React.useEffect(() => {
    messagesByConversationRef.current = messagesByConversation;
  }, [messagesByConversation]);

  const reportError = React.useCallback(
    async (
      error: unknown,
      options: {
        fallbackMessage: string;
        toastId: string;
        toastEnabled: boolean;
      },
    ): Promise<string | null> => {
      const recovered = await recoverFromSessionFailure(error, {
        toastId: `${options.toastId}-session`,
      });

      if (recovered) {
        return null;
      }

      const message = getErrorMessage(error, options.fallbackMessage);

      if (options.toastEnabled) {
        toast.error(message, {
          id: options.toastId,
        });
      }

      return message;
    },
    [recoverFromSessionFailure],
  );

  const loadConversations = React.useCallback(
    async (options: { force?: boolean; signal?: AbortSignal } = {}) => {
      if (conversationsStatusRef.current === "loading" && !options.force) {
        return;
      }

      const hasLoadedData = conversationsRef.current.length > 0;
      setConversationsStatus(hasLoadedData ? "success" : "loading");
      setConversationsRefreshing(hasLoadedData);
      setConversationsError(null);
      setConversationsErrorStatus(null);

      try {
        const response = await getAssistantConversations({
          signal: options.signal,
        });
        setConversations(sortConversations(response.data.items));
        setConversationsStatus("success");
        setConversationsRefreshing(false);
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return;
        }

        const message = await reportError(error, {
          fallbackMessage: "Unable to load assistant conversations right now.",
          toastId: "assistant-conversations-load-error",
          toastEnabled: false,
        });

        if (message === null) {
          return;
        }

        setConversationsStatus(hasLoadedData ? "success" : "error");
        setConversationsRefreshing(false);
        setConversationsError(message);
        setConversationsErrorStatus(
          isAssistantApiError(error) ? error.status : null,
        );
      }
    },
    [reportError],
  );

  const loadConversationMessages = React.useCallback(
    async (
      conversationId: string,
      options: { force?: boolean; signal?: AbortSignal } = {},
    ) => {
      const currentState =
        messagesByConversationRef.current[conversationId] ??
        getDefaultMessagesState();

      if (currentState.status === "loading" && !options.force) {
        return;
      }

      const hasLoadedData = currentState.items.length > 0;
      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: {
          ...currentState,
          status: hasLoadedData ? "success" : "loading",
          refreshing: hasLoadedData,
          error: null,
          errorStatus: null,
        },
      }));

      try {
        const response = await getAssistantMessages(conversationId, {
          signal: options.signal,
        });
        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: {
            status: "success",
            items: sortMessages(response.data.items),
            error: null,
            errorStatus: null,
            fetchedAt: Date.now(),
            refreshing: false,
          },
        }));
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return;
        }

        const message = await reportError(error, {
          fallbackMessage: "Unable to load that conversation right now.",
          toastId: `assistant-messages-${conversationId}-error`,
          toastEnabled: false,
        });

        if (message === null) {
          return;
        }

        if (isAssistantApiError(error) && error.status === 404) {
          setConversations((current) =>
            current.filter((item) => item.id !== conversationId),
          );
          setMessagesByConversation((current) => {
            const next = { ...current };
            delete next[conversationId];
            return next;
          });
          setActiveConversationId((current) =>
            current === conversationId ? null : current,
          );
          return;
        }

        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: {
            ...currentState,
            status: hasLoadedData ? "success" : "error",
            refreshing: false,
            error: message,
            errorStatus: isAssistantApiError(error) ? error.status : null,
          },
        }));
      }
    },
    [reportError],
  );

  React.useEffect(() => {
    const controller = new AbortController();

    void loadConversations({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadConversations]);

  React.useEffect(() => {
    if (
      initialSelectionResolvedRef.current ||
      conversationsStatus !== "success"
    ) {
      return;
    }

    initialSelectionResolvedRef.current = true;

    if (conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, conversationsStatus]);

  React.useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const currentState =
      messagesByConversationRef.current[activeConversationId] ??
      getDefaultMessagesState();

    if (currentState.status !== "idle" && currentState.error === null) {
      return;
    }

    const controller = new AbortController();
    void loadConversationMessages(activeConversationId, {
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [activeConversationId, loadConversationMessages]);

  const startNewConversation = React.useCallback(() => {
    setActiveConversationId(null);
    setComposerQuery("");
  }, []);

  const selectConversation = React.useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    setComposerQuery("");
  }, []);

  const refreshConversations = React.useCallback(async () => {
    await loadConversations({
      force: true,
    });
  }, [loadConversations]);

  const refreshActiveMessages = React.useCallback(async () => {
    if (!activeConversationId) {
      return;
    }

    await loadConversationMessages(activeConversationId, {
      force: true,
    });
  }, [activeConversationId, loadConversationMessages]);

  const submitQuery = React.useCallback(async (): Promise<boolean> => {
    const normalizedQuery = normalizeQuery(composerQuery);

    if (normalizedQuery.length < MIN_ASSISTANT_QUERY_LENGTH) {
      toast.error(
        `Enter at least ${MIN_ASSISTANT_QUERY_LENGTH} characters before sending.`,
        {
          id: "assistant-submit-validation-error",
        },
      );
      return false;
    }

    if (submitPending) {
      return false;
    }

    const conversationId = activeConversationId;
    setSubmitPending(true);
    setPendingQuery(normalizedQuery);
    setComposerQuery("");

    try {
      const response = conversationId
        ? await appendAssistantMessage(conversationId, {
            query: normalizedQuery,
          })
        : await createAssistantConversation({
            query: normalizedQuery,
          });
      const turn = response.data;

      setConversations((current) =>
        upsertConversation(current, turn.conversation),
      );
      setMessagesByConversation((current) => {
        const previousItems = conversationId
          ? (current[conversationId]?.items ?? [])
          : [];

        return {
          ...current,
          [turn.conversation.id]: {
            status: "success",
            items: sortMessages([
              ...previousItems,
              turn.user_message,
              turn.assistant_message,
            ]),
            error: null,
            errorStatus: null,
            fetchedAt: Date.now(),
            refreshing: false,
          },
        };
      });
      setActiveConversationId(turn.conversation.id);
      return true;
    } catch (error: unknown) {
      const message = await reportError(error, {
        fallbackMessage: "Unable to submit that assistant query right now.",
        toastId: "assistant-submit-error",
        toastEnabled: true,
      });

      if (message !== null) {
        setComposerQuery(normalizedQuery);
      }

      return false;
    } finally {
      setSubmitPending(false);
      setPendingQuery(null);
    }
  }, [activeConversationId, composerQuery, reportError, submitPending]);

  const renameConversation = React.useCallback(
    async (conversationId: string, title: string): Promise<boolean> => {
      const normalizedTitle = normalizeQuery(title);

      if (!normalizedTitle) {
        toast.error("Conversation title is required.", {
          id: `assistant-rename-${conversationId}-error`,
        });
        return false;
      }

      setRenamePendingConversationId(conversationId);

      try {
        const response = await renameAssistantConversation(conversationId, {
          title: normalizedTitle,
        });
        setConversations((current) =>
          current.map((item) =>
            item.id === conversationId ? response.data.conversation : item,
          ),
        );
        toast.success("Conversation renamed successfully.", {
          id: `assistant-rename-${conversationId}`,
        });
        return true;
      } catch (error: unknown) {
        await reportError(error, {
          fallbackMessage: "Unable to rename that conversation right now.",
          toastId: `assistant-rename-${conversationId}-error`,
          toastEnabled: true,
        });
        return false;
      } finally {
        setRenamePendingConversationId((current) =>
          current === conversationId ? null : current,
        );
      }
    },
    [reportError],
  );

  const deleteConversation = React.useCallback(
    async (conversationId: string): Promise<boolean> => {
      setDeletePendingConversationId(conversationId);

      try {
        await deleteAssistantConversation(conversationId);
        const nextConversations = conversationsRef.current.filter(
          (item) => item.id !== conversationId,
        );
        setConversations(nextConversations);
        setActiveConversationId((selectedId) =>
          selectedId === conversationId
            ? (nextConversations[0]?.id ?? null)
            : selectedId,
        );
        setMessagesByConversation((current) => {
          const next = { ...current };
          delete next[conversationId];
          return next;
        });
        toast.success("Conversation deleted successfully.", {
          id: `assistant-delete-${conversationId}`,
        });
        return true;
      } catch (error: unknown) {
        await reportError(error, {
          fallbackMessage: "Unable to delete that conversation right now.",
          toastId: `assistant-delete-${conversationId}-error`,
          toastEnabled: true,
        });
        return false;
      } finally {
        setDeletePendingConversationId((current) =>
          current === conversationId ? null : current,
        );
      }
    },
    [reportError],
  );

  const activeConversation = React.useMemo(
    () =>
      conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );
  const activeMessagesState = activeConversationId
    ? (messagesByConversation[activeConversationId] ??
      getDefaultMessagesState())
    : getDefaultMessagesState();
  const normalizedComposerQuery = normalizeQuery(composerQuery);

  return {
    conversations,
    conversationsStatus,
    conversationsError,
    conversationsErrorStatus,
    conversationsRefreshing,
    activeConversationId,
    activeConversation,
    activeMessages: activeMessagesState.items,
    activeMessagesStatus: activeMessagesState.status,
    activeMessagesError: activeMessagesState.error,
    activeMessagesErrorStatus: activeMessagesState.errorStatus,
    activeMessagesRefreshing: activeMessagesState.refreshing,
    composerQuery,
    setComposerQuery,
    submitPending,
    pendingQuery,
    renamePendingConversationId,
    deletePendingConversationId,
    hasConversations: conversations.length > 0,
    isDraftConversation: activeConversationId === null,
    canSubmitQuery:
      normalizedComposerQuery.length >= MIN_ASSISTANT_QUERY_LENGTH &&
      !submitPending,
    minQueryLength: MIN_ASSISTANT_QUERY_LENGTH,
    startNewConversation,
    selectConversation,
    submitQuery,
    renameConversation,
    deleteConversation,
    refreshConversations,
    refreshActiveMessages,
  };
}
