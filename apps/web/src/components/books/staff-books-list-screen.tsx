// apps/web/src/components/books/staff-books-list-screen.tsx
/**
 * Staff book-inventory list screen for the authenticated shell.
 *
 * Purpose:
 * - Render the first real book-inventory management surface inside the
 *   protected shell.
 * - Keep the list truthful by loading the staff inventory directory into a
 *   shared cache once, then deriving search, status filtering, category
 *   filtering, and pagination locally from that cached dataset.
 * - Expose row-level view, edit, and delete actions while leaving queue
 *   visibility inside the selected-book detail surface.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  BookPlus,
  Eye,
  FilterX,
  LoaderCircle,
  RefreshCw,
  Search,
  SquarePen,
  Trash2,
} from "lucide-react";

import { BookCoverImage } from "@/components/books/book-cover-image";
import { BookCreateDialog } from "@/components/books/book-create-dialog";
import { BookDetailDialog } from "@/components/books/book-detail-dialog";
import { BookEditDialog } from "@/components/books/book-edit-dialog";
import { BookStatusBadge } from "@/components/books/book-status-badge";
import { PageContainer } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBookCategoryLabel,
  getBookStatusLabel,
  type BookCategory,
  type BookStatus,
  type StaffBookListItem,
} from "@/lib/books";
import { useBooksList, useDeleteBook } from "@/hooks/useBooks";

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

function formatDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function BookListLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16 rounded-3xl" />
      <Skeleton className="h-112 rounded-3xl" />
    </div>
  );
}

function BookListFailureState(props: {
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
            Unable to load the inventory directory.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              There was a problem while loading the books data. Retry to fetch
              the latest inventory directory.
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

function ActionEntryButton(props: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  loading?: boolean;
  className?: string;
}): React.JSX.Element {
  const Icon = props.icon;
  const disabled = props.disabled ?? true;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      className={`size-9 rounded-xl border px-0 sm:h-9 sm:w-auto sm:px-3 ${props.className ?? ""}`}
      aria-label={
        disabled
          ? `${props.label} action is not available`
          : `${props.label} book action`
      }
      title={props.title ?? `${props.label} book action`}
      onClick={props.onClick}
    >
      {props.loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{props.label}</span>
    </Button>
  );
}

function StaffBooksTable(props: {
  loading: boolean;
  searchTerm: string;
  status: BookStatus | "all";
  category: BookCategory | "all";
  hasAppliedFilters: boolean;
  serverTotalItems: number;
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  statusOptions: readonly BookStatus[];
  categoryOptions: readonly BookCategory[];
  items: StaffBookListItem[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: BookStatus | "all") => void;
  onCategoryChange: (value: BookCategory | "all") => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (item: StaffBookListItem) => void;
  onEdit: (item: StaffBookListItem) => void;
  onDelete: (item: StaffBookListItem) => void;
  deletePendingBookId: string | null;
}): React.JSX.Element {
  const isServerEmpty = props.serverTotalItems === 0;
  const emptyEyebrow = isServerEmpty ? "Directory Empty" : "Empty Result";
  const emptyTitle = isServerEmpty
    ? "No book records exist yet."
    : "No books match the current filters.";
  const emptyMessage = isServerEmpty
    ? "Once staff creates catalog records, they will appear here for inventory management."
    : "Change the search text, category filter, or status filter to find matching inventory records.";

  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-2xl font-black tracking-tight">
                Staff Catalog Directory
              </CardTitle>
              <Badge variant="secondary" className="rounded-full">
                {props.totalItems} shown
              </Badge>
            </div>
            <CardDescription className="px-0 text-sm leading-6">
              Review catalog records, borrowing rules, and row-level inventory
              actions from one restrained management table.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={props.searchTerm}
              onChange={(event) => {
                props.onSearchChange(event.target.value);
              }}
              placeholder="Search title or author"
              className="h-10 rounded-xl border-border/70 bg-background pl-9"
              aria-label="Search books"
            />
          </div>

          <Select
            value={props.status}
            onValueChange={(value) => {
              props.onStatusChange(value as BookStatus | "all");
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {props.statusOptions.map((statusValue) => (
                <SelectItem key={statusValue} value={statusValue}>
                  {getBookStatusLabel(statusValue)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={props.category}
            onValueChange={(value) => {
              props.onCategoryChange(value as BookCategory | "all");
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Category filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {props.categoryOptions.map((categoryValue) => (
                <SelectItem key={categoryValue} value={categoryValue}>
                  {getBookCategoryLabel(categoryValue)}
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
              {emptyEyebrow}
            </p>
            <p className="mt-3 text-lg font-black text-foreground">
              {emptyTitle}
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border border-border/70">
              <Table>
                <TableHeader className="bg-muted/45">
                  <TableRow className="hover:bg-muted/45">
                    <TableHead className="w-20">Sr#</TableHead>
                    <TableHead className="min-w-80">Book</TableHead>
                    <TableHead className="w-36">Category</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="min-w-72">Borrowing Rules</TableHead>
                    <TableHead className="min-w-74">Added</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.items.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-muted-foreground">
                          {serialNumber.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <BookCoverImage
                              title={item.title}
                              author={item.author}
                              coverImageUrl={item.cover_image_url}
                              coverImageAlt={item.cover_image_alt}
                              variant="thumbnail"
                            />
                            <div className="min-w-0 space-y-1">
                              <p className="truncate font-semibold text-foreground">
                                {item.title}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {item.author}
                              </p>
                              <p className="truncate text-xs font-medium text-muted-foreground">
                                {getBookCategoryLabel(item.category)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {getBookCategoryLabel(item.category)}
                        </TableCell>
                        <TableCell>
                          <BookStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-foreground">
                              Replacement {formatMoney(item.replacement_cost)}
                            </p>
                            <p className="text-muted-foreground">
                              Fine {formatMoney(item.fine_per_day_rate)} per day
                            </p>
                            <p className="text-muted-foreground">
                              {item.override_borrow_duration_days !== null
                                ? `Custom duration ${item.override_borrow_duration_days} days`
                                : "Normal borrowing duration"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatDateTime(item.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <ActionEntryButton
                              label="View"
                              icon={Eye}
                              disabled={false}
                              title="Open book detail"
                              onClick={() => {
                                props.onView(item);
                              }}
                            />
                            <ActionEntryButton
                              label="Edit"
                              icon={SquarePen}
                              disabled={false}
                              title="Open book edit"
                              onClick={() => {
                                props.onEdit(item);
                              }}
                            />
                            <ActionEntryButton
                              label="Delete"
                              icon={Trash2}
                              className="border-destructive/20 bg-destructive/8 text-destructive hover:border-destructive/35 hover:bg-destructive/14 hover:text-destructive"
                              loading={props.deletePendingBookId === item.id}
                              disabled={props.deletePendingBookId !== null}
                              title="Delete this catalog record"
                              onClick={() => {
                                props.onDelete(item);
                              }}
                            />
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
                options={props.pageSizeOptions}
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

export function StaffBooksListScreen(): React.JSX.Element {
  const {
    status,
    loading,
    refreshing,
    error,
    hasData,
    hasStaleData,
    totalLoadedItems,
    filteredCount,
    totalPages,
    items,
    filters,
    hasAppliedFilters,
    pageSizeOptions,
    statusOptions,
    categoryOptions,
    refresh,
    retry,
    setSearchTerm,
    setStatusFilter,
    setCategoryFilter,
    setPage,
    setPageSize,
    resetFilters,
  } = useBooksList({
    autoLoad: true,
  });
  const {
    destructivePending: deletePending,
    pendingBookId: deletePendingBookId,
    error: deleteError,
    clearError: clearDeleteError,
    deleteBook,
  } = useDeleteBook();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailBookId, setDetailBookId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [editBookId, setEditBookId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] =
    React.useState<StaffBookListItem | null>(null);

  const openDetailDialog = React.useCallback((item: StaffBookListItem) => {
    setDetailBookId(item.id);
    setDetailOpen(true);
  }, []);

  const openEditDialog = React.useCallback(
    (item: StaffBookListItem) => {
      clearDeleteError();
      setEditBookId(item.id);
      setEditOpen(true);
    },
    [clearDeleteError],
  );

  const openDeleteDialog = React.useCallback(
    (item: StaffBookListItem) => {
      clearDeleteError();
      setDeleteTarget(item);
    },
    [clearDeleteError],
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    const success = await deleteBook(deleteTarget.id);

    if (!success) {
      return;
    }

    if (detailBookId === deleteTarget.id) {
      setDetailOpen(false);
      setDetailBookId(null);
    }

    if (editBookId === deleteTarget.id) {
      setEditOpen(false);
      setEditBookId(null);
    }

    setDeleteTarget(null);
  }, [deleteBook, deleteTarget, detailBookId, editBookId]);

  return (
    <PageContainer
      eyebrow="Staff Catalog"
      title="Catalog"
      description="Manage the staff book inventory with truthful detail, edit, and delete flows."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void refresh();
            }}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>

          <Button
            type="button"
            className="gap-2 rounded-xl"
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            <BookPlus className="h-4 w-4" />
            Add Book
          </Button>
        </div>
      }
    >
      <ScrollReveal direction="up" delayMs={90}>
        <div className="flex flex-1 flex-col gap-6">
          {error && !hasData ? (
            <BookListFailureState
              hasStaleData={false}
              message={error}
              onRetry={retry}
            />
          ) : null}

          {loading && !hasData ? (
            <BookListLoadingState />
          ) : (
            <>
              {error && hasData ? (
                <BookListFailureState
                  hasStaleData={hasStaleData}
                  message={error}
                  onRetry={retry}
                />
              ) : null}

              {deleteError ? (
                <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
                  <CardContent className="flex items-start gap-3 px-5 py-4 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{deleteError}</p>
                  </CardContent>
                </Card>
              ) : null}

              <StaffBooksTable
                loading={status === "loading" && !hasData}
                searchTerm={filters.searchTerm}
                status={filters.status}
                category={filters.category}
                hasAppliedFilters={hasAppliedFilters}
                serverTotalItems={totalLoadedItems}
                totalItems={filteredCount}
                totalPages={totalPages}
                page={filters.page}
                pageSize={filters.pageSize}
                pageSizeOptions={pageSizeOptions}
                statusOptions={statusOptions}
                categoryOptions={categoryOptions}
                items={items}
                onSearchChange={setSearchTerm}
                onStatusChange={setStatusFilter}
                onCategoryChange={setCategoryFilter}
                onResetFilters={resetFilters}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onView={openDetailDialog}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
                deletePendingBookId={deletePending ? deletePendingBookId : null}
              />
            </>
          )}
        </div>
      </ScrollReveal>

      <BookCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={({ bookId }) => {
          setCreateOpen(false);
          setDetailBookId(bookId);
          setDetailOpen(true);
        }}
      />

      <BookDetailDialog
        bookId={detailBookId}
        open={detailOpen}
        onOpenChange={(nextOpen) => {
          setDetailOpen(nextOpen);

          if (!nextOpen) {
            setDetailBookId(null);
          }
        }}
        onEditRequested={() => {
          if (detailBookId) {
            setDetailOpen(false);
            setEditBookId(detailBookId);
            setEditOpen(true);
          }
        }}
      />

      <BookEditDialog
        bookId={editBookId}
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);

          if (!nextOpen) {
            setEditBookId(null);
          }
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            clearDeleteError();
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl rounded-3xl border-border/70">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="font-display text-2xl font-black tracking-tight">
              Delete Book
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6">
              Delete this only when staff intends to remove the catalog record
              completely. Active queue or borrowing history may block the
              deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteTarget ? (
            <Card className="rounded-2xl border-border/70 bg-muted/35 py-0 shadow-none">
              <CardContent className="px-5 py-4">
                <p className="font-semibold text-foreground">
                  {deleteTarget.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {deleteTarget.author}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The system will reject this action if the record still has
                  borrowing history or active queue state.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {deleteError ? (
            <p className="text-sm font-medium text-destructive">
              {deleteError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              disabled={deletePending}
              onClick={() => {
                clearDeleteError();
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl border border-destructive/20 bg-destructive/8 text-destructive hover:bg-destructive/14 hover:text-destructive"
              disabled={deletePending}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteConfirm();
              }}
            >
              {deletePending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Confirm Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
