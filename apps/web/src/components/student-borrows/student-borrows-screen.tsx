"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, LibraryBig, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { BookStatusBadge } from "@/components/books/book-status-badge";
import { PageContainer } from "@/components/app-shell";
import { StudentBorrowActionDialog } from "@/components/student-borrows/student-borrow-action-dialog";
import { StudentBorrowAreaNav } from "@/components/student-borrows/student-borrow-area-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationControl } from "@/components/ui/pagination-control";
import { RowsControl } from "@/components/ui/rows-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudentBorrows } from "@/hooks/useStudentBorrows";
import {
  BOOK_CATEGORY_VALUES,
  BOOK_STATUS_VALUES,
  getBookCategoryLabel,
  type BookCategory,
  type BookStatus,
} from "@/lib/books";
import {
  formatStudentBorrowDateTime,
  getStudentBorrowDuePresentation,
  type StudentActiveBorrowItem,
} from "@/lib/student-borrows";

const BORROWS_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type BorrowStatusFilter = BookStatus | "all";
type BorrowCategoryFilter = BookCategory | "all";

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
              Retry Required
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
              The current list may be out of date. Retry to load the latest
              borrowed books.
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

function StudentBorrowsTable(props: {
  loading: boolean;
  items: StudentActiveBorrowItem[];
  totalItems: number;
  hasAppliedFilters: boolean;
  searchTerm: string;
  statusFilter: BorrowStatusFilter;
  categoryFilter: BorrowCategoryFilter;
  page: number;
  pageSize: number;
  totalPages: number;
  mutationLocked: boolean;
  renewPendingBookId: string | null;
  returnPendingBookId: string | null;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: BorrowStatusFilter) => void;
  onCategoryChange: (value: BorrowCategoryFilter) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRenewRequested: (item: StudentActiveBorrowItem) => void;
  onReturnRequested: (item: StudentActiveBorrowItem) => void;
}): React.JSX.Element {
  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="space-y-3 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-black tracking-tight">
              Active Borrow Records
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6">
              Review due dates, renewal usage, and return or renew books from one
              table.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {props.totalItems} shown
            </Badge>
            {props.hasAppliedFilters ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={props.onResetFilters}
              >
                Clear Filters
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={props.searchTerm}
              onChange={(event) => {
                props.onSearchChange(event.target.value);
              }}
              placeholder="Search by title or author"
              className="h-10 rounded-xl border-border/70 bg-background pl-9"
              aria-label="Search active borrows"
            />
          </div>

          <Select
            value={props.categoryFilter}
            onValueChange={(value) => {
              props.onCategoryChange(value as BorrowCategoryFilter);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Category filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {BOOK_CATEGORY_VALUES.map((categoryValue) => (
                <SelectItem key={categoryValue} value={categoryValue}>
                  {getBookCategoryLabel(categoryValue)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={props.statusFilter}
            onValueChange={(value) => {
              props.onStatusChange(value as BorrowStatusFilter);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Book status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All book statuses</SelectItem>
              {BOOK_STATUS_VALUES.map((statusValue) => (
                <SelectItem key={statusValue} value={statusValue}>
                  {statusValue.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-2 py-2">
        {props.loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : props.totalItems === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/35 px-5 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              No Matching Records
            </p>
            <p className="mt-3 text-lg font-black text-foreground">
              No active borrows match your current filters.
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Change your search text, category, or status filter to see more
              active borrows.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border border-border/70">
              <Table>
                <TableHeader className="bg-muted/45">
                  <TableRow className="hover:bg-muted/45">
                    <TableHead className="w-20">Sr#</TableHead>
                    <TableHead className="min-w-86">Book</TableHead>
                    <TableHead className="w-36">Category</TableHead>
                    <TableHead className="w-32">Book Status</TableHead>
                    <TableHead className="w-34">Issued</TableHead>
                    <TableHead className="w-34">Due Date</TableHead>
                    <TableHead className="w-36">Due Status</TableHead>
                    <TableHead className="w-24 text-right">Renewals</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.items.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;
                    const duePresentation = getStudentBorrowDuePresentation(
                      item.due_date,
                    );

                    return (
                      <TableRow key={item.transaction_id}>
                        <TableCell className="font-semibold text-muted-foreground">
                          {serialNumber.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {item.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.author}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {getBookCategoryLabel(item.category)}
                        </TableCell>
                        <TableCell>
                          <BookStatusBadge status={item.book_status} />
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatStudentBorrowDateTime(item.issue_date)}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatStudentBorrowDateTime(item.due_date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              duePresentation.state === "overdue"
                                ? "rounded-full border-destructive/25 bg-destructive/10 text-destructive"
                                : duePresentation.state === "due_today"
                                  ? "rounded-full border-amber-500/25 bg-amber-500/10 text-amber-700"
                                  : "rounded-full border-primary/25 bg-primary/10 text-primary"
                            }
                          >
                            {duePresentation.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {item.renewal_count}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              disabled={props.mutationLocked}
                              onClick={() => {
                                props.onRenewRequested(item);
                              }}
                            >
                              {props.renewPendingBookId === item.book_id
                                ? "Renewing..."
                                : "Renew"}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="rounded-xl"
                              disabled={props.mutationLocked}
                              onClick={() => {
                                props.onReturnRequested(item);
                              }}
                            >
                              {props.returnPendingBookId === item.book_id
                                ? "Returning..."
                                : "Return"}
                            </Button>
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
                options={BORROWS_PAGE_SIZE_OPTIONS}
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

export function StudentBorrowsScreen(): React.JSX.Element {
  const borrows = useStudentBorrows({
    autoLoad: true,
  });
  const [dialogState, setDialogState] =
    React.useState<StudentBorrowDialogState>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<BorrowStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    React.useState<BorrowCategoryFilter>("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);

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

  const filteredItems = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return borrows.items.filter((item) => {
      const matchesSearch =
        normalizedSearch.length === 0
        || item.title.toLowerCase().includes(normalizedSearch)
        || item.author.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || item.book_status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [borrows.items, searchTerm, categoryFilter, statusFilter]);

  const hasAppliedFilters =
    searchTerm.trim().length > 0
    || statusFilter !== "all"
    || categoryFilter !== "all";

  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedItems = React.useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, page, pageSize]);

  const overdueCount = filteredItems.filter(
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
      eyebrow="Student Borrows"
      title="My Borrows"
      description="Manage your borrowed books, due dates, renewals, and returns."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {filteredItems.length} shown
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
                      You do not have any borrowed books right now.
                    </p>
                    <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
                      Borrow books from the catalog. They will appear here for
                      due-date tracking, renewals, and returns.
                    </p>
                  </div>
                  <Button asChild className="rounded-xl">
                    <Link href="/student/catalog">Back To Catalog</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <StudentBorrowsTable
                loading={borrows.loading}
                items={pagedItems}
                totalItems={filteredItems.length}
                hasAppliedFilters={hasAppliedFilters}
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                categoryFilter={categoryFilter}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                mutationLocked={borrows.hasPendingMutation}
                renewPendingBookId={borrows.renewAction.pendingBookId}
                returnPendingBookId={borrows.returnAction.pendingBookId}
                onSearchChange={setSearchTerm}
                onStatusChange={setStatusFilter}
                onCategoryChange={setCategoryFilter}
                onResetFilters={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setPage(1);
                }}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
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
              : "Returning will remove this book from your borrowed list."
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
