// apps/web/src/components/student-catalog/student-catalog-screen.tsx
/**
 * Student catalog discovery screen.
 *
 * Purpose:
 * - Render the first real student-facing discovery surface inside the protected
 *   student shell.
 * - Keep catalog browsing, selected-book detail, and queue visibility truthful
 *   to the backend contract without copying staff inventory patterns.
 * - Keep the selected-book panel as the real borrow entry point while leaving
 *   queue ownership for the later student queue phase.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  FilterX,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import { BookCoverImage } from "@/components/books/book-cover-image";
import { BookStatusBadge } from "@/components/books/book-status-badge";
import { PageContainer } from "@/components/app-shell";
import { StudentBookDetailPanel } from "@/components/student-catalog/student-book-detail-panel";
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
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentBorrows } from "@/hooks/useStudentBorrows";
import { useStudentCatalog } from "@/hooks/useStudentCatalog";
import { useStudentQueue } from "@/hooks/useStudentQueue";
import {
  getBookCategoryLabel,
  type BookCategory,
  type BookStatus,
  type PublicCatalogBookListItem,
} from "@/lib/books";
import { canCancelStudentQueueEntry } from "@/lib/student-queue";
import { cn } from "@/lib/utils";

const CATALOG_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function normalizeBookId(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function CatalogLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16 rounded-3xl" />
      <Skeleton className="h-120 rounded-3xl" />
    </div>
  );
}

function CatalogFailureState(props: {
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
            Unable to load the student catalog.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The current catalog list may be out of date. Retry to load the
              latest books.
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

function CatalogRowButton(props: {
  item: PublicCatalogBookListItem;
  selected: boolean;
  onSelect: (bookId: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        props.onSelect(props.item.id);
      }}
      className={cn(
        "mx-auto w-full max-w-[17rem] rounded-3xl border p-3 text-left transition-all duration-200 sm:max-w-[18rem] xl:max-w-[17rem]",
        "hover:border-primary/35 hover:bg-primary/5",
        props.selected
          ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/10"
          : "border-border/70 bg-background/80",
      )}
      aria-pressed={props.selected}
    >
      <div className="relative">
        <BookCoverImage
          title={props.item.title}
          author={props.item.author}
          coverImageUrl={props.item.cover_image_url}
          coverImageAlt={props.item.cover_image_alt}
          variant="card"
          showTextFallback={false}
          className="w-full rounded-[1.5rem]"
        />

        <div className="absolute right-3 top-3 rounded-full bg-background/90 p-1 shadow-sm backdrop-blur">
          <BookStatusBadge status={props.item.status} />
        </div>
      </div>

      <div className="mt-3 min-w-0 space-y-3 px-1 pb-1">
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 text-base font-black leading-5 tracking-tight text-foreground">
            {props.item.title}
          </p>
          <p className="line-clamp-1 text-sm leading-5 text-muted-foreground">
            {props.item.author}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {getBookCategoryLabel(props.item.category)}
          </Badge>
          {props.selected ? (
            <Badge variant="outline" className="rounded-full border-primary/30">
              Selected
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function StudentCatalogListCard(props: {
  loading: boolean;
  refreshing: boolean;
  searchTerm: string;
  statusFilter: BookStatus | "all";
  categoryFilter: BookCategory | "all";
  hasAppliedFilters: boolean;
  totalLoadedItems: number;
  filteredCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  isEmpty: boolean;
  isFilterEmpty: boolean;
  items: PublicCatalogBookListItem[];
  pagedItems: PublicCatalogBookListItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  pageSizeOptions: readonly number[];
  selectedBookId: string | null;
  statusOptions: readonly BookStatus[];
  categoryOptions: readonly BookCategory[];
  onSelect: (bookId: string) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: BookStatus | "all") => void;
  onCategoryChange: (value: BookCategory | "all") => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onLoadMore: () => void | Promise<void>;
}): React.JSX.Element {
  const emptyTitle = props.isEmpty
    ? "No books are available yet."
    : "No books match the current filters.";
  const emptyMessage = props.isEmpty
    ? "Books will appear here when catalog records are added."
    : props.hasMore
      ? "Search and filters apply to books currently loaded on this page. Change filters or load more books."
      : "Change the search text, category filter, or status filter to find matching books.";

  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-2xl font-black tracking-tight">
                Student Catalog
              </CardTitle>
            </div>
            <CardDescription className="max-w-2xl px-0 text-sm leading-6">
              Browse cover cards, then open one selected book for full details.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {props.refreshing ? (
              <Badge variant="outline" className="gap-2 rounded-full">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Refreshing
              </Badge>
            ) : null}
            {props.hasAppliedFilters ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 rounded-xl"
                onClick={props.onResetFilters}
              >
                <FilterX className="h-4 w-4" />
                Clear Filters
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={props.searchTerm}
              onChange={(event) => {
                props.onSearchChange(event.target.value);
              }}
              placeholder="Search books by title, author, category, or status"
              className="h-11 w-full rounded-xl border-border/70 bg-background pl-9"
              aria-label="Search catalog books"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              value={props.statusFilter}
              onValueChange={(value) => {
                props.onStatusChange(value as BookStatus | "all");
              }}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {props.statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={props.categoryFilter}
              onValueChange={(value) => {
                props.onCategoryChange(value as BookCategory | "all");
              }}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background">
                <SelectValue placeholder="Category filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {props.categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {getBookCategoryLabel(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-3 py-3 sm:px-4">
        {props.loading ? (
          <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-64 w-full max-w-[17rem] rounded-3xl sm:h-72 sm:max-w-[18rem] xl:max-w-[17rem]"
              />
            ))}
          </div>
        ) : props.isEmpty || props.isFilterEmpty ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/35 px-5 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {props.isEmpty ? "Catalog Empty" : "No Matching Loaded Rows"}
            </p>
            <p className="mt-3 text-lg font-black text-foreground">
              {emptyTitle}
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.pagedItems.map((item) => (
              <CatalogRowButton
                key={item.id}
                item={item}
                selected={props.selectedBookId === item.id}
                onSelect={props.onSelect}
              />
            ))}
          </div>
        )}

        {props.loadMoreError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{props.loadMoreError}</span>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  void props.onLoadMore();
                }}
              >
                Retry Load More
              </Button>
            </div>
          </div>
        ) : null}

        {!props.loading && !props.isEmpty && !props.isFilterEmpty ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/75 px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <RowsControl
                value={props.pageSize}
                options={props.pageSizeOptions}
                onValueChange={props.onPageSizeChange}
                label="Rows"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PaginationControl
                page={props.page}
                totalPages={props.totalPages}
                onPageChange={props.onPageChange}
              />
              {props.hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={() => {
                    void props.onLoadMore();
                  }}
                  disabled={props.loadingMore}
                >
                  {props.loadingMore ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <LibraryBig className="h-4 w-4" />
                      Load More
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StudentCatalogScreen(): React.JSX.Element {
  const catalog = useStudentCatalog();
  const studentBorrows = useStudentBorrows({
    autoLoad: true,
  });
  const studentQueue = useStudentQueue({
    autoLoad: true,
  });
  const borrowBook = studentBorrows.borrowAction.submit;
  const clearBorrowError = studentBorrows.borrowAction.clearError;
  const clearQueueError = studentQueue.joinAction.clearError;
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);
  const [optimisticQueuedBookIds, setOptimisticQueuedBookIds] = React.useState<
    Set<string>
  >(() => new Set());

  React.useEffect(() => {
    clearBorrowError();
    clearQueueError();
  }, [catalog.selectedBookId, clearBorrowError, clearQueueError]);

  React.useEffect(() => {
    setPage(1);
  }, [catalog.searchTerm, catalog.statusFilter, catalog.categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(catalog.filteredCount / pageSize));

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedItems = React.useMemo(
    () => catalog.items.slice(startIndex, endIndex),
    [catalog.items, startIndex, endIndex],
  );
  const isSelectedBookAlreadyQueued = React.useMemo(() => {
    const normalizedSelectedBookId = normalizeBookId(catalog.selectedBookId);

    if (!normalizedSelectedBookId) {
      return false;
    }

    if (optimisticQueuedBookIds.has(normalizedSelectedBookId)) {
      return true;
    }

    return studentQueue.items.some((entry) => {
      const normalizedEntryBookId = normalizeBookId(entry.book_id);

      return (
        normalizedEntryBookId === normalizedSelectedBookId &&
        canCancelStudentQueueEntry(entry.status)
      );
    });
  }, [catalog.selectedBookId, optimisticQueuedBookIds, studentQueue.items]);

  const isSelectedBookReadyForPickup = React.useMemo(() => {
    const normalizedSelectedBookId = normalizeBookId(catalog.selectedBookId);

    if (!normalizedSelectedBookId) {
      return false;
    }

    return studentQueue.items.some((entry) => {
      const normalizedEntryBookId = normalizeBookId(entry.book_id);
      const normalizedEntryStatus = String(entry.status).trim().toLowerCase();

      return (
        normalizedEntryBookId === normalizedSelectedBookId &&
        normalizedEntryStatus === "notified"
      );
    });
  }, [catalog.selectedBookId, studentQueue.items]);

  const isSelectedBookAlreadyBorrowed = React.useMemo(() => {
    const normalizedSelectedBookId = normalizeBookId(catalog.selectedBookId);

    if (!normalizedSelectedBookId) {
      return false;
    }

    return studentBorrows.items.some((entry) => {
      const normalizedBorrowBookId = normalizeBookId(entry.book_id);

      return normalizedBorrowBookId === normalizedSelectedBookId;
    });
  }, [catalog.selectedBookId, studentBorrows.items]);

  React.useEffect(() => {
    if (studentQueue.status !== "success") {
      return;
    }

    setOptimisticQueuedBookIds((current) => {
      if (current.size === 0) {
        return current;
      }

      const activeIds = new Set(
        studentQueue.items
          .filter((entry) => canCancelStudentQueueEntry(entry.status))
          .map((entry) => normalizeBookId(entry.book_id)),
      );
      let changed = false;
      const next = new Set<string>();

      current.forEach((bookId) => {
        if (activeIds.has(bookId)) {
          next.add(bookId);
        } else {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [studentQueue.items, studentQueue.status]);

  const handleBorrowFromSelectedBook = React.useCallback(
    async (bookId: string) => {
      return borrowBook(bookId, {
        onSuccess: async () => {
          await Promise.allSettled([
            catalog.selectedBook.retry(),
            catalog.selectedBookQueue.retry(),
          ]);
        },
      });
    },
    [borrowBook, catalog.selectedBook, catalog.selectedBookQueue],
  );

  const handleJoinQueueFromSelectedBook = React.useCallback(
    async (bookId: string) => {
      return studentQueue.joinAction.submit(bookId, {
        onSuccess: async () => {
          const normalizedBookId = normalizeBookId(bookId);

          if (normalizedBookId) {
            setOptimisticQueuedBookIds((current) => {
              if (current.has(normalizedBookId)) {
                return current;
              }

              const next = new Set(current);
              next.add(normalizedBookId);
              return next;
            });
          }

          await Promise.allSettled([
            catalog.selectedBookQueue.retry(),
            studentQueue.refresh(),
          ]);
        },
      });
    },
    [catalog.selectedBookQueue, studentQueue],
  );

  return (
    <PageContainer
      eyebrow="Student Discovery"
      title="Catalog"
      description="Browse books, open details, borrow available books, and join the waiting list for unavailable books."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void catalog.refresh();
            }}
            disabled={catalog.loading || catalog.refreshing}
          >
            {catalog.refreshing ? (
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
        {catalog.error && !catalog.hasData ? (
          <CatalogFailureState
            hasStaleData={false}
            message={catalog.error}
            onRetry={catalog.retry}
          />
        ) : null}

        {catalog.loading && !catalog.hasData ? (
          <CatalogLoadingState />
        ) : (
          <>
            {catalog.error && catalog.hasData ? (
              <CatalogFailureState
                hasStaleData={catalog.hasStaleData}
                message={catalog.error}
                onRetry={catalog.retry}
              />
            ) : null}

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.46fr)]">
              <ScrollReveal direction="up" delayMs={40}>
                <StudentCatalogListCard
                  loading={catalog.loading}
                  refreshing={catalog.refreshing}
                  searchTerm={catalog.searchTerm}
                  statusFilter={catalog.statusFilter}
                  categoryFilter={catalog.categoryFilter}
                  hasAppliedFilters={catalog.hasAppliedFilters}
                  totalLoadedItems={catalog.totalLoadedItems}
                  filteredCount={catalog.filteredCount}
                  hasMore={catalog.hasMore}
                  loadingMore={catalog.loadingMore}
                  loadMoreError={catalog.loadMoreError}
                  isEmpty={catalog.isEmpty}
                  isFilterEmpty={catalog.isFilterEmpty}
                  items={catalog.items}
                  pagedItems={pagedItems}
                  page={page}
                  pageSize={pageSize}
                  totalPages={totalPages}
                  pageSizeOptions={CATALOG_PAGE_SIZE_OPTIONS}
                  selectedBookId={catalog.selectedBookId}
                  statusOptions={catalog.statusOptions}
                  categoryOptions={catalog.categoryOptions}
                  onSelect={catalog.selectBook}
                  onSearchChange={catalog.setSearchTerm}
                  onStatusChange={catalog.setStatusFilter}
                  onCategoryChange={catalog.setCategoryFilter}
                  onResetFilters={catalog.resetFilters}
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPage(1);
                  }}
                  onLoadMore={catalog.loadMore}
                />
              </ScrollReveal>

              <ScrollReveal
                direction="up"
                delayMs={80}
                className="2xl:sticky 2xl:top-6 2xl:self-start"
              >
                <StudentBookDetailPanel
                  selectedListItem={catalog.selectedListItem}
                  selectedBook={catalog.selectedBook}
                  selectedBookQueue={catalog.selectedBookQueue}
                  borrowAction={{
                    pending: studentBorrows.borrowAction.pending,
                    error: studentBorrows.borrowAction.error,
                    clearError: studentBorrows.borrowAction.clearError,
                    submit: handleBorrowFromSelectedBook,
                  }}
                  queueAction={{
                    pending: studentQueue.joinAction.pending,
                    error: studentQueue.joinAction.error,
                    clearError: studentQueue.joinAction.clearError,
                    submit: handleJoinQueueFromSelectedBook,
                  }}
                  isSelectedBookAlreadyQueued={isSelectedBookAlreadyQueued}
                  isSelectedBookAlreadyBorrowed={isSelectedBookAlreadyBorrowed}
                  isSelectedBookReadyForPickup={isSelectedBookReadyForPickup}
                  onClearSelection={catalog.clearSelectedBook}
                />
              </ScrollReveal>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
