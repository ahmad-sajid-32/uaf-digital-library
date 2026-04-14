"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, LibraryBig, LoaderCircle, RefreshCw } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { StudentBorrowActionDialog } from "@/components/student-borrows/student-borrow-action-dialog";
import { StudentBorrowAreaNav } from "@/components/student-borrows/student-borrow-area-nav";
import { StudentActiveBorrowCard } from "@/components/student-borrows/student-active-borrow-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentBorrows } from "@/hooks/useStudentBorrows";
import {
  formatStudentBorrowDateTime,
  getStudentBorrowDuePresentation,
  type StudentActiveBorrowItem,
} from "@/lib/student-borrows";

type StudentBorrowDialogState =
  | {
      action: "renew" | "return";
      item: StudentActiveBorrowItem;
    }
  | null;

function StudentBorrowsLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-72 rounded-3xl" />
      ))}
    </div>
  );
}

function StudentBorrowsFailureState(props: {
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
              Borrow Workspace Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load your active borrows.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The currently shown rows may be stale. Retry to fetch the latest
              active borrow state.
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

export function StudentBorrowsScreen(): React.JSX.Element {
  const borrows = useStudentBorrows({
    autoLoad: true,
  });
  const [dialogState, setDialogState] =
    React.useState<StudentBorrowDialogState>(null);

  React.useEffect(() => {
    if (!dialogState) {
      return;
    }

    const activeBookStillVisible = borrows.items.some(
      (item) => item.book_id === dialogState.item.book_id,
    );

    if (!activeBookStillVisible) {
      setDialogState(null);
    }
  }, [borrows.items, dialogState]);

  const overdueCount = borrows.items.filter(
    (item) => getStudentBorrowDuePresentation(item.due_date).state === "overdue",
  ).length;

  const closeDialog = React.useCallback((open: boolean) => {
    if (!open) {
      borrows.renewAction.clearError();
      borrows.returnAction.clearError();
      setDialogState(null);
    }
  }, [borrows.returnAction, borrows.renewAction]);

  return (
    <PageContainer
      eyebrow="Student Borrow Lifecycle"
      title="My Borrows"
      description="Manage the books you currently hold. Due dates, overdue state, renew outcomes, and return outcomes all stay tied to the real backend circulation contract."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {borrows.items.length} active
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {overdueCount} overdue
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void borrows.refresh();
            }}
            disabled={borrows.loading || borrows.refreshing}
          >
            {borrows.refreshing ? (
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
        <StudentBorrowAreaNav />

        {borrows.error && !borrows.hasData ? (
          <StudentBorrowsFailureState
            hasStaleData={false}
            message={borrows.error}
            onRetry={borrows.retry}
          />
        ) : null}

        {borrows.loading && !borrows.hasData ? (
          <StudentBorrowsLoadingState />
        ) : (
          <>
            {borrows.error && borrows.hasData ? (
              <StudentBorrowsFailureState
                hasStaleData={borrows.hasStaleData}
                message={borrows.error}
                onRetry={borrows.retry}
              />
            ) : null}

            {borrows.isEmpty ? (
              <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
                <CardContent className="space-y-5 px-6 py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LibraryBig className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                      No Active Borrows
                    </p>
                    <p className="text-2xl font-black tracking-tight text-foreground">
                      Your active borrow workspace is currently empty.
                    </p>
                    <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
                      Borrowing starts from the selected-book detail panel in the
                      catalog. Once you borrow a book successfully, it will show
                      up here for renew and return actions.
                    </p>
                  </div>
                  <Button asChild className="rounded-xl">
                    <Link href="/student/catalog">Back To Catalog</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {borrows.items.map((item) => (
                  <StudentActiveBorrowCard
                    key={item.transaction_id}
                    item={item}
                    mutationLocked={borrows.hasPendingMutation}
                    renewPending={borrows.renewAction.pendingBookId === item.book_id}
                    returnPending={borrows.returnAction.pendingBookId === item.book_id}
                    onRenewRequested={(targetItem) => {
                      borrows.returnAction.clearError();
                      borrows.renewAction.clearError();
                      setDialogState({
                        action: "renew",
                        item: targetItem,
                      });
                    }}
                    onReturnRequested={(targetItem) => {
                      borrows.renewAction.clearError();
                      borrows.returnAction.clearError();
                      setDialogState({
                        action: "return",
                        item: targetItem,
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {dialogState ? (
        <StudentBorrowActionDialog
          action={dialogState.action}
          open={dialogState !== null}
          onOpenChange={closeDialog}
          bookTitle={dialogState.item.title}
          supportingText={
            dialogState.action === "renew"
              ? `Current due date: ${formatStudentBorrowDateTime(dialogState.item.due_date)}`
              : "Returning removes this book from your active borrow workspace once the backend confirms the action."
          }
          pending={
            dialogState.action === "renew"
              ? borrows.renewAction.pendingBookId === dialogState.item.book_id
              : borrows.returnAction.pendingBookId === dialogState.item.book_id
          }
          error={
            dialogState.action === "renew"
              ? borrows.renewAction.error
              : borrows.returnAction.error
          }
          onConfirm={() =>
            dialogState.action === "renew"
              ? borrows.renewAction.submit(dialogState.item.book_id)
              : borrows.returnAction.submit(dialogState.item.book_id)
          }
        />
      ) : null}
    </PageContainer>
  );
}
