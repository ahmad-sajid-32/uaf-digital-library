"use client";

import Link from "next/link";
import * as React from "react";
import { AlertCircle, LibraryBig, LoaderCircle, RefreshCw } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { StudentQueueCancelDialog } from "@/components/student-queue/student-queue-cancel-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationControl } from "@/components/ui/pagination-control";
import { RowsControl } from "@/components/ui/rows-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  canCancelStudentQueueEntry,
  formatStudentQueueDateTime,
  getStudentQueueStatusPresentation,
  type StudentQueueItem,
} from "@/lib/student-queue";
import { useStudentQueue } from "@/hooks/useStudentQueue";

type StudentQueueDialogState = StudentQueueItem | null;
const QUEUE_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

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
            Unable to load your waiting list.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The current list may be out of date. Retry to load the latest
              waiting-list information.
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

function StudentQueueTable(props: {
  loading: boolean;
  items: StudentQueueItem[];
  totalItems: number;
  actionableCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  mutationLocked: boolean;
  cancelPendingBookId: string | null;
  onCancelRequested: (item: StudentQueueItem) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}): React.JSX.Element {
  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="space-y-3 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-black tracking-tight">
              Queue Entries
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6">
              Track waiting-list progress, hold notifications, and cancel active
              queue entries.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {props.totalItems} shown
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {props.actionableCount} cancelable
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-2 py-2">
        {props.loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border border-border/70">
              <Table>
                <TableHeader className="bg-muted/45">
                  <TableRow className="hover:bg-muted/45">
                    <TableHead className="w-20">Sr#</TableHead>
                    <TableHead className="min-w-86">Book</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                    <TableHead className="w-28">Position</TableHead>
                    <TableHead className="w-44">Notified At</TableHead>
                    <TableHead className="w-44">Hold Expires</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.items.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;
                    const statusPresentation = getStudentQueueStatusPresentation(
                      item.status,
                    );
                    const canCancel = canCancelStudentQueueEntry(item.status);
                    const isPendingCancel = props.cancelPendingBookId === item.book_id;

                    return (
                      <TableRow key={`${item.book_id}-${item.status}-${item.position}`}>
                        <TableCell className="font-semibold text-muted-foreground">
                          {serialNumber.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {item.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {statusPresentation.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full border",
                              statusPresentation.toneClassName,
                            )}
                          >
                            {statusPresentation.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          #{item.position}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatStudentQueueDateTime(item.notified_at)}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatStudentQueueDateTime(item.hold_expires_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {canCancel ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="rounded-xl"
                                disabled={props.mutationLocked}
                                onClick={() => {
                                  props.onCancelRequested(item);
                                }}
                              >
                                {isPendingCancel ? "Cancelling..." : "Cancel"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No action
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <RowsControl
                value={props.pageSize}
                options={QUEUE_PAGE_SIZE_OPTIONS}
                onValueChange={props.onPageSizeChange}
              />
              <PaginationControl
                page={props.page}
                totalPages={props.totalPages}
                onPageChange={props.onPageChange}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function StudentQueueScreen(): React.JSX.Element {
  const queue = useStudentQueue({
    autoLoad: true,
  });
  const [dialogState, setDialogState] = React.useState<StudentQueueDialogState>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);

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
  const totalPages = Math.max(1, Math.ceil(queue.items.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedItems = React.useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return queue.items.slice(startIndex, startIndex + pageSize);
  }, [queue.items, page, pageSize]);

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
      description="Track your waiting list, see pickup-ready books, and cancel entries that are still active."
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
                      Your waiting list is currently empty.
                    </p>
                    <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
                      Join a waiting list from the book detail page when a book
                      is unavailable. Your entries will appear here.
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
              <StudentQueueTable
                loading={queue.loading}
                items={pagedItems}
                totalItems={queue.items.length}
                actionableCount={actionableCount}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                mutationLocked={queue.hasPendingMutation}
                cancelPendingBookId={queue.cancelAction.pendingBookId}
                onCancelRequested={(targetItem) => {
                  queue.cancelAction.clearError();
                  setDialogState(targetItem);
                }}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
              />
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
              : `Status: ${dialogState.status.replace(/_/g, " ")}`
          }
          pending={queue.cancelAction.pendingBookId === dialogState.book_id}
          error={queue.cancelAction.error}
          onConfirm={() => queue.cancelAction.submit(dialogState.book_id)}
        />
      ) : null}
    </PageContainer>
  );
}
