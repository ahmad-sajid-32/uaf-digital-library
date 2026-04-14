// apps/web/src/components/student-catalog/student-book-detail-panel.tsx
/**
 * Selected-book detail panel for the student catalog module.
 *
 * Purpose:
 * - Render the selected-book public detail surface separately from the catalog
 *   list so the real borrow lifecycle and later queue workflow have one clear
 *   ownership point.
 * - Keep queue visibility, action-entry placement, and partial-failure handling
 *   tied to one selected-book context instead of scattering actions across the
 *   discovery list.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { BookStatusBadge } from "@/components/books/book-status-badge";
import { StudentBorrowActionDialog } from "@/components/student-borrows/student-borrow-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBookCategoryLabel,
  type BookQueueStatusItem,
  type PublicBookDetailItem,
  type PublicCatalogBookListItem,
} from "@/lib/books";

function formatMoney(value: number | string): string {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not active";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function getBorrowingDurationLabel(
  overrideBorrowDurationDays: number | null | undefined,
): string {
  if (!overrideBorrowDurationDays) {
    return "Standard borrowing duration";
  }

  return `${overrideBorrowDurationDays} day custom borrowing duration`;
}

function getActionRecommendation(item: PublicBookDetailItem | null): {
  eyebrow: string;
  description: string;
} {
  if (!item) {
    return {
      eyebrow: "Choose A Book",
      description:
        "Select a book first. Borrow and queue entry stay attached to the selected-book context so every later circulation action starts from one real book.",
    };
  }

  if (item.status === "available") {
    return {
      eyebrow: "Borrow Entry",
      description:
        "This selected-book panel now owns the real borrow action. Queue join stays here too, but it should only be used when this selected book is not currently available.",
    };
  }

  if (item.status === "borrowed" || item.status === "reserved") {
    return {
      eyebrow: "Borrow Or Queue Branch",
      description:
        "This book is not immediately available right now. Borrow attempts and queue joins both stay here and must rely on backend truth for the final outcome.",
    };
  }

  return {
    eyebrow: "Availability Restricted",
    description:
      "This book is not in a normal borrowing state right now. The action entry stays here, but the backend still decides whether borrow or queue requests are allowed.",
  };
}

function DetailLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Skeleton className="h-24 rounded-3xl" />
      <Skeleton className="h-24 rounded-3xl" />
      <Skeleton className="h-24 rounded-3xl" />
      <Skeleton className="h-24 rounded-3xl" />
    </div>
  );
}

function QueueLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Skeleton className="h-18 rounded-2xl" />
      <Skeleton className="h-18 rounded-2xl" />
      <Skeleton className="h-18 rounded-2xl" />
      <Skeleton className="h-18 rounded-2xl" />
    </div>
  );
}

function DetailFailureState(props: {
  message: string;
  onRetry: () => void | Promise<void>;
  onClearSelection: () => void;
}): React.JSX.Element {
  return (
    <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="space-y-4 px-5 py-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-destructive">
              Detail Retry Required
            </p>
            <p className="text-base font-bold text-foreground">
              The selected book detail could not be loaded.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {props.message}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void props.onRetry();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl"
            onClick={props.onClearSelection}
          >
            Clear Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueFailureState(props: {
  message: string;
  requiresAuth: boolean;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Card className="rounded-3xl border-border/70 bg-muted/35 py-0 shadow-none">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start gap-3">
          {props.requiresAuth ? (
            <ShieldAlert className="mt-0.5 h-5 w-5 text-primary" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          )}
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Queue Visibility Unavailable
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {props.requiresAuth
                ? "Queue visibility requires a valid signed-in session for this selected book."
                : props.message}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={() => {
            void props.onRetry();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry Queue
        </Button>
      </CardContent>
    </Card>
  );
}

function QueueSummaryCard(props: {
  queue: BookQueueStatusItem;
}): React.JSX.Element {
  const queuePressureLabel =
    props.queue.waiting_count > 0
      ? `${props.queue.waiting_count} student${props.queue.waiting_count === 1 ? "" : "s"} waiting`
      : "No current queue pressure";

  return (
    <Card className="rounded-3xl border-border/70 bg-muted/30 py-0 shadow-none">
      <CardHeader className="gap-2 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg font-black tracking-tight">
            Queue Summary
          </CardTitle>
          <BookStatusBadge status={props.queue.book_status} />
        </div>
        <CardDescription className="px-0 text-sm leading-6">
          This queue state belongs only to the currently selected book. It is
          not the same thing as the later `My Queue` module.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Waiting Count
          </p>
          <p className="mt-2 text-xl font-black text-foreground">
            {props.queue.waiting_count}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {queuePressureLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Notification State
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {props.queue.has_notified ? "Hold notice sent" : "No active hold notice"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Notified at {formatDateTime(props.queue.notified_at)}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Hold Expiry
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {formatDateTime(props.queue.hold_expires_at)}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            If a hold is active, the database still owns its expiry behavior.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Current Book State
          </p>
          <p className="mt-2">
            <BookStatusBadge status={props.queue.book_status} />
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Queue pressure and current book state are shown together so later
            borrow and queue entry decisions stay tied to one selected record.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StudentBookDetailPanelProps {
  selectedListItem: PublicCatalogBookListItem | null;
  selectedBook: {
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    item: PublicBookDetailItem | null;
    retry: () => void | Promise<void>;
  };
  selectedBookQueue: {
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    requiresAuth: boolean;
    item: BookQueueStatusItem | null;
    retry: () => void | Promise<void>;
  };
  borrowAction: {
    pending: boolean;
    error: string | null;
    clearError: () => void;
    submit: (bookId: string) => Promise<boolean>;
  };
  queueAction: {
    pending: boolean;
    error: string | null;
    clearError: () => void;
    submit: (bookId: string) => Promise<boolean>;
  };
  onClearSelection: () => void;
}

export function StudentBookDetailPanel({
  selectedListItem,
  selectedBook,
  selectedBookQueue,
  borrowAction,
  queueAction,
  onClearSelection,
}: StudentBookDetailPanelProps): React.JSX.Element {
  const [borrowDialogOpen, setBorrowDialogOpen] = React.useState(false);
  const detailItem = selectedBook.item;
  const displayTitle = detailItem?.title ?? selectedListItem?.title ?? "Selected Book";
  const displayAuthor =
    detailItem?.author ?? selectedListItem?.author ?? "Choose a book to inspect its detail.";
  const recommendation = getActionRecommendation(detailItem);
  const clearBorrowError = borrowAction.clearError;
  const clearQueueError = queueAction.clearError;
  const canJoinQueue =
    detailItem?.status === "borrowed" || detailItem?.status === "reserved";

  React.useEffect(() => {
    clearBorrowError();
    clearQueueError();
    setBorrowDialogOpen(false);
  }, [clearBorrowError, clearQueueError, detailItem?.id, selectedListItem?.id]);

  if (!selectedListItem && !detailItem) {
    return (
      <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
        <CardHeader className="gap-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Selected Book
          </p>
          <CardTitle className="text-2xl font-black tracking-tight">
            Pick one catalog row to inspect it properly.
          </CardTitle>
          <CardDescription className="px-0 text-sm leading-6">
            Discovery lives in the list. Borrow and queue entry stay in this
            detail panel so every real student circulation workflow starts from
            the correct book.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/30 px-5 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              No Selection Yet
            </p>
            <p className="mt-3 text-lg font-black text-foreground">
              Choose a book from the catalog list.
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Once you select a book, this panel will show public detail,
              authenticated queue pressure, the live borrow action, and the
              correct queue-entry point for unavailable books.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
        <CardHeader className="gap-3 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Selected Book
                </p>
                {detailItem ? (
                  <>
                    <BookStatusBadge status={detailItem.status} />
                    <Badge variant="secondary" className="rounded-full">
                      {getBookCategoryLabel(detailItem.category)}
                    </Badge>
                  </>
                ) : null}
              </div>
              <CardTitle className="text-2xl font-black tracking-tight">
                {displayTitle}
              </CardTitle>
              <CardDescription className="px-0 text-sm leading-6">
                {displayAuthor}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedBook.refreshing ? (
                <Badge variant="outline" className="gap-2 rounded-full">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Refreshing detail
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={onClearSelection}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-5 pb-5">
          {selectedBook.error && detailItem ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              The last loaded detail is still visible, but refresh failed:
              {" "}
              {selectedBook.error}
            </div>
          ) : null}

          {selectedBook.loading && !detailItem ? (
            <DetailLoadingState />
          ) : null}

          {!selectedBook.loading && !detailItem && selectedBook.error ? (
            <DetailFailureState
              message={selectedBook.error}
              onRetry={selectedBook.retry}
              onClearSelection={onClearSelection}
            />
          ) : null}

          {detailItem ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/70 bg-background/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Replacement Cost
                </p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {formatMoney(detailItem.replacement_cost)}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This is the configured replacement value for this record.
                </p>
              </div>

              <div className="rounded-3xl border border-border/70 bg-background/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Fine Per Day
                </p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {formatMoney(detailItem.fine_per_day_rate)}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Fine calculation still stays database-owned.
                </p>
              </div>

              <div className="rounded-3xl border border-border/70 bg-background/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Borrowing Duration
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {getBorrowingDurationLabel(
                    detailItem.override_borrow_duration_days,
                  )}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Custom duration appears only when this record overrides the
                  standard rule.
                </p>
              </div>

              <div className="rounded-3xl border border-border/70 bg-background/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Catalog Record
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Added {formatDateTime(detailItem.created_at)}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Public-safe detail stays separate from staff inventory
                  management data.
                </p>
              </div>
            </div>
          ) : null}

          <Separator />

          {selectedBookQueue.error && selectedBookQueue.item ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              The last loaded queue summary is still visible, but refresh failed:
              {" "}
              {selectedBookQueue.error}
            </div>
          ) : null}

          {selectedBookQueue.loading && !selectedBookQueue.item ? (
            <QueueLoadingState />
          ) : null}

          {!selectedBookQueue.loading
          && !selectedBookQueue.item
          && selectedBookQueue.error ? (
            <QueueFailureState
              message={selectedBookQueue.error}
              requiresAuth={selectedBookQueue.requiresAuth}
              onRetry={selectedBookQueue.retry}
            />
          ) : null}

          {selectedBookQueue.item ? (
            <QueueSummaryCard queue={selectedBookQueue.item} />
          ) : null}

          {selectedBookQueue.refreshing && selectedBookQueue.item ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Refreshing queue visibility for the selected book.
            </div>
          ) : null}

          <Card className="rounded-3xl border-border/70 bg-muted/30 py-0 shadow-none">
            <CardHeader className="gap-2 px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {recommendation.eyebrow}
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  Borrow live
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  Queue live
                </Badge>
              </div>
              <CardTitle className="text-lg font-black tracking-tight">
                Action Entry
              </CardTitle>
              <CardDescription className="px-0 text-sm leading-6">
                {recommendation.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
              {queueAction.error ? (
                <div className="sm:col-span-2 xl:col-span-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {queueAction.error}
                </div>
              ) : null}
              <Button
                type="button"
                className="justify-between rounded-2xl"
                disabled={!detailItem || borrowAction.pending}
                title={
                  detailItem
                    ? "Borrow uses the real backend route from this selected-book context."
                    : "Select a book first."
                }
                onClick={() => {
                  if (!detailItem) {
                    return;
                  }

                  clearBorrowError();
                  setBorrowDialogOpen(true);
                }}
              >
                {borrowAction.pending ? (
                  <>
                    Borrowing...
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Borrow
                    <ArrowRight className="h-4 w-4" />
                  </>
                  )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-between rounded-2xl"
                disabled={!detailItem || !canJoinQueue || queueAction.pending}
                title={
                  !detailItem
                    ? "Select a book first."
                    : canJoinQueue
                      ? "Join the backend-owned waiting queue for this selected book."
                      : "Queue join only applies when this selected book is not currently available."
                }
                onClick={() => {
                  if (!detailItem || !canJoinQueue) {
                    return;
                  }

                  clearQueueError();
                  void queueAction.submit(detailItem.id);
                }}
              >
                {queueAction.pending ? (
                  <>
                    Joining...
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Join Queue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <Button
                asChild
                variant="outline"
                className="justify-between rounded-2xl"
              >
                <Link href="/student/borrows">
                  View My Borrows
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="justify-between rounded-2xl"
              >
                <Link href="/student/queue">
                  View My Queue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <div className="rounded-3xl border border-dashed border-border/70 bg-background/65 px-4 py-4">
            <div className="flex items-start gap-3">
              <BookOpenText className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Why actions stay here
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Discovery starts in the catalog list, but borrowing and queue
                  entry must stay attached to one selected book. That keeps the
                  student lifecycle tied to the real book context instead of
                  detached shortcut buttons.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {detailItem ? (
        <StudentBorrowActionDialog
          action="borrow"
          open={borrowDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              clearBorrowError();
            }

            setBorrowDialogOpen(open);
          }}
          bookTitle={detailItem.title}
          supportingText={`Current status: ${detailItem.status.replace(/_/g, " ")}. Borrow success or conflict still comes from the backend, not from frontend guesses.`}
          pending={borrowAction.pending}
          error={borrowAction.error}
          onConfirm={() => borrowAction.submit(detailItem.id)}
        />
      ) : null}
    </div>
  );
}
