"use client";

import Link from "next/link";
import * as React from "react";
import { AlertCircle, LibraryBig, LoaderCircle, RefreshCw } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { StudentQueueCancelDialog } from "@/components/student-queue/student-queue-cancel-dialog";
import { StudentQueueCard } from "@/components/student-queue/student-queue-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canCancelStudentQueueEntry,
  formatStudentQueueDateTime,
  type StudentQueueItem,
} from "@/lib/student-queue";
import { useStudentQueue } from "@/hooks/useStudentQueue";

type StudentQueueDialogState = StudentQueueItem | null;

function StudentQueueLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-72 rounded-3xl" />
      ))}
    </div>
  );
}

function StudentQueueFailureState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Queue Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load your queue workspace.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The currently shown queue rows may be stale. Retry to fetch the
              latest queue state from the backend.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2 self-start rounded-xl sm:self-auto"
          onClick={() => {
            void props.onRetry();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function StudentQueueScreen(): React.JSX.Element {
  const queue = useStudentQueue({
    autoLoad: true,
  });
  const [dialogState, setDialogState] = React.useState<StudentQueueDialogState>(null);

  React.useEffect(() => {
    if (!dialogState) {
      return;
    }

    const queueEntryStillVisible = queue.items.some(
      (item) => item.book_id === dialogState.book_id && item.status === dialogState.status,
    );

    if (!queueEntryStillVisible) {
      setDialogState(null);
    }
  }, [queue.items, dialogState]);

  const actionableCount = queue.items.filter((item) =>
    canCancelStudentQueueEntry(item.status),
  ).length;

  const closeDialog = React.useCallback(
    (open: boolean) => {
      if (!open) {
        queue.cancelAction.clearError();
        setDialogState(null);
      }
    },
    [queue.cancelAction],
  );

  return (
    <PageContainer
      eyebrow="Student Queue"
      title="My Queue"
      description="Review your queue participation, see backend-owned queue states, and cancel only the entries that are still active. Queue join still starts from the selected-book detail flow."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {queue.items.length} entries
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {actionableCount} cancelable
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void queue.refresh();
            }}
            disabled={queue.loading || queue.refreshing}
          >
            {queue.refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-6">
        {queue.error && !queue.hasData ? (
          <StudentQueueFailureState
            hasStaleData={false}
            message={queue.error}
            onRetry={queue.retry}
          />
        ) : null}

        {queue.loading && !queue.hasData ? (
          <StudentQueueLoadingState />
        ) : (
          <>
            {queue.error && queue.hasData ? (
              <StudentQueueFailureState
                hasStaleData={queue.hasStaleData}
                message={queue.error}
                onRetry={queue.retry}
              />
            ) : null}

            {queue.isEmpty ? (
              <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
                <CardContent className="space-y-5 px-6 py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LibraryBig className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                      No Queue Entries
                    </p>
                    <p className="text-2xl font-black tracking-tight text-foreground">
                      Your queue workspace is currently empty.
                    </p>
                    <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
                      Queue join starts from the selected-book detail panel when
                      a book is unavailable. Once you join successfully, the
                      backend-owned queue entry will appear here.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild className="rounded-xl">
                      <Link href="/student/catalog">Back To Catalog</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href="/student/borrows">View My Borrows</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {queue.items.map((item) => (
                  <StudentQueueCard
                    key={`${item.book_id}-${item.status}-${item.position}`}
                    item={item}
                    mutationLocked={queue.hasPendingMutation}
                    cancelPending={queue.cancelAction.pendingBookId === item.book_id}
                    onCancelRequested={(targetItem) => {
                      queue.cancelAction.clearError();
                      setDialogState(targetItem);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {dialogState ? (
        <StudentQueueCancelDialog
          open={dialogState !== null}
          onOpenChange={closeDialog}
          bookTitle={dialogState.title}
          supportingText={
            dialogState.status === "notified"
              ? `Hold expiry: ${formatStudentQueueDateTime(dialogState.hold_expires_at)}`
              : `Queue status: ${dialogState.status.replace(/_/g, " ")}`
          }
          pending={queue.cancelAction.pendingBookId === dialogState.book_id}
          error={queue.cancelAction.error}
          onConfirm={() => queue.cancelAction.submit(dialogState.book_id)}
        />
      ) : null}
    </PageContainer>
  );
}
