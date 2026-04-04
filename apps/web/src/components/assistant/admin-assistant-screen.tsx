// apps/web/src/components/assistant/admin-assistant-screen.tsx
/**
 * Admin assistant workspace for the authenticated shell.
 *
 * Purpose:
 * - Render the admin assistant as a chat-first workspace instead of a
 *   dashboard module.
 * - Keep the backend conversation contract unchanged while restructuring the
 *   frontend around history, thread, and docked composer responsibilities.
 * - Preserve rename/delete flows and assistant state ownership in useAssistant.
 */

"use client";

import * as React from "react";
import { LoaderCircle, SquarePen, Trash2 } from "lucide-react";

import { AssistantComposer } from "@/components/assistant/assistant-composer";
import { AssistantSidebar } from "@/components/assistant/assistant-sidebar";
import { AssistantThread } from "@/components/assistant/assistant-thread";
import { AssistantWorkspaceLayout } from "@/components/assistant/assistant-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAssistant } from "@/hooks/useAssistant";
import type { AssistantConversationItem } from "@/lib/api/assistant";

export function AdminAssistantScreen(): React.JSX.Element {
  const assistant = useAssistant();
  const [renameTarget, setRenameTarget] =
    React.useState<AssistantConversationItem | null>(null);
  const [renameTitle, setRenameTitle] = React.useState("");
  const [deleteTarget, setDeleteTarget] =
    React.useState<AssistantConversationItem | null>(null);
  const [isSidebarCollapsedDesktop, setIsSidebarCollapsedDesktop] =
    React.useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = React.useState(false);

  React.useEffect(() => {
    if (!renameTarget) {
      return;
    }

    setRenameTitle(renameTarget.title);
  }, [renameTarget]);

  const handleComposerSubmit = React.useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      void assistant.submitQuery();
    },
    [assistant],
  );

  const handleSelectConversation = React.useCallback(
    (conversationId: string) => {
      assistant.selectConversation(conversationId);
      setIsSidebarOpenMobile(false);
    },
    [assistant],
  );

  const handleNewConversation = React.useCallback(() => {
    assistant.startNewConversation();
    setIsSidebarOpenMobile(false);
  }, [assistant]);

  const desktopSidebar = (
    <AssistantSidebar
      conversations={assistant.conversations}
      conversationsStatus={assistant.conversationsStatus}
      conversationsError={assistant.conversationsError}
      conversationsRefreshing={assistant.conversationsRefreshing}
      activeConversationId={assistant.activeConversationId}
      submitPending={assistant.submitPending}
      collapsed={isSidebarCollapsedDesktop}
      onNewConversation={handleNewConversation}
      onRefresh={() => {
        void assistant.refreshConversations();
      }}
      onSelectConversation={handleSelectConversation}
      onRenameConversation={setRenameTarget}
      onDeleteConversation={setDeleteTarget}
      onToggleCollapse={() => {
        setIsSidebarCollapsedDesktop((current) => !current);
      }}
    />
  );

  const mobileSidebar = (
    <AssistantSidebar
      conversations={assistant.conversations}
      conversationsStatus={assistant.conversationsStatus}
      conversationsError={assistant.conversationsError}
      conversationsRefreshing={assistant.conversationsRefreshing}
      activeConversationId={assistant.activeConversationId}
      submitPending={assistant.submitPending}
      mobile
      onNewConversation={handleNewConversation}
      onRefresh={() => {
        void assistant.refreshConversations();
      }}
      onSelectConversation={handleSelectConversation}
      onRenameConversation={setRenameTarget}
      onDeleteConversation={setDeleteTarget}
    />
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <AssistantWorkspaceLayout
        isSidebarCollapsedDesktop={isSidebarCollapsedDesktop}
        isSidebarOpenMobile={isSidebarOpenMobile}
        onSidebarOpenMobileChange={setIsSidebarOpenMobile}
        desktopSidebar={desktopSidebar}
        mobileSidebar={mobileSidebar}
        main={(
          <AssistantThread
            activeConversation={assistant.activeConversation}
            hasConversations={assistant.hasConversations}
            isDraftConversation={assistant.isDraftConversation}
            messages={assistant.activeMessages}
            messagesStatus={assistant.activeMessagesStatus}
            messagesError={assistant.activeMessagesError}
            messagesRefreshing={assistant.activeMessagesRefreshing}
            pendingQuery={assistant.pendingQuery}
            onRetry={() => {
              void assistant.refreshActiveMessages();
            }}
            onOpenMobileSidebar={() => {
              setIsSidebarOpenMobile(true);
            }}
            composer={(
              <AssistantComposer
                composerQuery={assistant.composerQuery}
                isDraftConversation={assistant.isDraftConversation}
                submitPending={assistant.submitPending}
                canSubmitQuery={assistant.canSubmitQuery}
                onComposerQueryChange={assistant.setComposerQuery}
                onSubmit={handleComposerSubmit}
              />
            )}
          />
        )}
      />

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-3xl border-border/70">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Rename conversation
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Update the title used in the assistant history list.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <label
              htmlFor="assistant-rename-title"
              className="text-sm font-semibold text-foreground"
            >
              Title
            </label>
            <Input
              id="assistant-rename-title"
              value={renameTitle}
              onChange={(event) => {
                setRenameTitle(event.target.value);
              }}
              placeholder="Conversation title"
              disabled={renameTarget === null}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setRenameTarget(null);
              }}
              disabled={renameTarget === null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-xl"
              onClick={() => {
                if (!renameTarget) {
                  return;
                }

                void (async () => {
                  const renamed = await assistant.renameConversation(
                    renameTarget.id,
                    renameTitle,
                  );

                  if (renamed) {
                    setRenameTarget(null);
                  }
                })();
              }}
              disabled={
                renameTarget === null
                || assistant.renamePendingConversationId === renameTarget?.id
              }
            >
              {assistant.renamePendingConversationId === renameTarget?.id ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <SquarePen className="h-4 w-4" />
              )}
              {assistant.renamePendingConversationId === renameTarget?.id
                ? "Renaming..."
                : "Save Title"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl rounded-3xl border-border/70">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="font-display text-2xl font-black tracking-tight">
              Delete conversation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6">
              This permanently removes the stored messages and citations for{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.title}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              disabled={assistant.deletePendingConversationId === deleteTarget?.id}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="gap-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();

                if (!deleteTarget) {
                  return;
                }

                void (async () => {
                  const deleted = await assistant.deleteConversation(deleteTarget.id);

                  if (deleted) {
                    setDeleteTarget(null);
                  }
                })();
              }}
            >
              {assistant.deletePendingConversationId === deleteTarget?.id ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {assistant.deletePendingConversationId === deleteTarget?.id
                ? "Deleting..."
                : "Delete Conversation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
