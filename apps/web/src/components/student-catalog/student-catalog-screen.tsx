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
import { cn } from "@/lib/utils";

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
              The currently shown catalog data may be stale. Retry to fetch the
              latest public rows.
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
        "w-full rounded-3xl border px-4 py-4 text-left transition-all duration-200",
        "hover:border-primary/35 hover:bg-primary/5",
        props.selected
          ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/10"
          : "border-border/70 bg-background/80",
      )}
      aria-pressed={props.selected}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-black tracking-tight text-foreground">
            {props.item.title}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {props.item.author}
          </p>
        </div>

        <BookStatusBadge status={props.item.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full">
          {getBookCategoryLabel(props.item.category)}
        </Badge>
        {props.selected ? (
          <Badge variant="outline" className="rounded-full border-primary/30">
            Selected
          </Badge>
        ) : null}
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
  selectedBookId: string | null;
  statusOptions: readonly BookStatus[];
  categoryOptions: readonly BookCategory[];
  onSelect: (bookId: string) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: BookStatus | "all") => void;
  onCategoryChange: (value: BookCategory | "all") => void;
  onResetFilters: () => void;
  onLoadMore: () => void | Promise<void>;
}): React.JSX.Element {
  const emptyTitle = props.isEmpty
    ? "No public catalog rows are available yet."
    : "No loaded books match the current filters.";
  const emptyMessage = props.isEmpty
    ? "When catalog records are available, they will appear here for student discovery."
    : props.hasMore
      ? "The search and filters only inspect rows already loaded into this screen. Change the filters or load more rows."
      : "Change the search text, category filter, or status filter to find matching rows.";

  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-2xl font-black tracking-tight">
                Student Catalog
              </CardTitle>
              <Badge variant="secondary" className="rounded-full">
                {props.filteredCount} shown
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {props.totalLoadedItems} loaded
              </Badge>
            </div>
            <CardDescription className="max-w-2xl px-0 text-sm leading-6">
              Browse the currently loaded public catalog rows, then inspect one
              selected book in detail. Search and filters apply only to rows that
              are already loaded here.
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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)]">
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={props.searchTerm}
                onChange={(event) => {
                  props.onSearchChange(event.target.value);
                }}
                placeholder="Search the loaded rows by title, author, category, or status"
                className="h-11 rounded-xl border-border/70 bg-background pl-9"
                aria-label="Search the loaded catalog rows"
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              This filter does not search the whole backend catalog. Use Load More
              to widen what the current screen can inspect.
            </p>
          </div>

          <Select
            value={props.statusFilter}
            onValueChange={(value) => {
              props.onStatusChange(value as BookStatus | "all");
            }}
          >
            <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background">
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
            <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background">
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
      </CardHeader>

      <CardContent className="space-y-4 px-3 py-3 sm:px-4">
        {props.loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-3xl" />
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
          <div className="grid gap-3">
            {props.items.map((item) => (
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/75 px-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {props.hasMore
                ? "More catalog rows are available."
                : "All currently reachable rows are already loaded."}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {props.hasMore
                ? "Load more when you need a wider discovery set. The current filters only inspect rows already loaded here."
                : "This screen stops loading more rows once the cursor sequence is exhausted."}
            </p>
          </div>

          <Button
            type="button"
            className="gap-2 rounded-xl"
            onClick={() => {
              void props.onLoadMore();
            }}
            disabled={!props.hasMore || props.loadingMore}
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
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentCatalogScreen(): React.JSX.Element {
  const catalog = useStudentCatalog();
  const studentBorrows = useStudentBorrows();
  const studentQueue = useStudentQueue();
  const borrowBook = studentBorrows.borrowAction.submit;
  const clearBorrowError = studentBorrows.borrowAction.clearError;
  const clearQueueError = studentQueue.joinAction.clearError;

  React.useEffect(() => {
    clearBorrowError();
    clearQueueError();
  }, [catalog.selectedBookId, clearBorrowError, clearQueueError]);

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
          await Promise.allSettled([catalog.selectedBookQueue.retry()]);
        },
      });
    },
    [catalog.selectedBookQueue, studentQueue.joinAction],
  );

  return (
    <PageContainer
      eyebrow="Student Discovery"
      title="Catalog"
      description="Browse the public catalog, inspect one selected book, borrow from the correct selected-book context, and read queue pressure without copying staff inventory behavior."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {catalog.totalLoadedItems} loaded
          </Badge>
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

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)]">
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
                  selectedBookId={catalog.selectedBookId}
                  statusOptions={catalog.statusOptions}
                  categoryOptions={catalog.categoryOptions}
                  onSelect={catalog.selectBook}
                  onSearchChange={catalog.setSearchTerm}
                  onStatusChange={catalog.setStatusFilter}
                  onCategoryChange={catalog.setCategoryFilter}
                  onResetFilters={catalog.resetFilters}
                  onLoadMore={catalog.loadMore}
                />
              </ScrollReveal>

              <ScrollReveal direction="up" delayMs={80}>
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
