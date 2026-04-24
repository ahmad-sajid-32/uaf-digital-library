"use client";

import Link from "next/link";
import * as React from "react";
import { AlertCircle, History, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
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
import { useStudentBorrowHistory } from "@/hooks/useStudentBorrowHistory";
import {
  BOOK_CATEGORY_VALUES,
  BOOK_STATUS_VALUES,
  getBookCategoryLabel,
} from "@/lib/books";
import {
  formatStudentBorrowHistoryDateTime,
  type StudentBorrowHistoryItem,
} from "@/lib/student-borrow-history";

const HISTORY_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type BorrowHistoryStatusFilter = (typeof BOOK_STATUS_VALUES)[number] | "all";
type BorrowHistoryCategoryFilter =
  (typeof BOOK_CATEGORY_VALUES)[number] | "all";

function StudentBorrowHistoryLoadingState() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-80 rounded-3xl" />
      ))}
    </div>
  );
}

function StudentBorrowHistoryFailureState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Borrow History Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load your borrow history.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The current rows may be out of date. Retry to load your latest
              history records.
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

function StudentBorrowHistoryTable(props: {
  loading: boolean;
  items: StudentBorrowHistoryItem[];
  totalItems: number;
  hasAppliedFilters: boolean;
  searchTerm: string;
  statusFilter: BorrowHistoryStatusFilter;
  categoryFilter: BorrowHistoryCategoryFilter;
  page: number;
  pageSize: number;
  totalPages: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: BorrowHistoryStatusFilter) => void;
  onCategoryChange: (value: BorrowHistoryCategoryFilter) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="space-y-3 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-black tracking-tight">
              Borrow History Records
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6">
              Review your completed borrow records, due dates, return dates, and
              renewal usage.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {props.totalItems} shown
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Returned records
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
              aria-label="Search history records"
            />
          </div>

          <Select
            value={props.categoryFilter}
            onValueChange={(value) => {
              props.onCategoryChange(value as BorrowHistoryCategoryFilter);
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
              props.onStatusChange(value as BorrowHistoryStatusFilter);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Current book status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All current statuses</SelectItem>
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
              No history rows match your current filters.
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Change your search text, category, or status filter to see more
              history records.
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
                    <TableHead className="w-42">Issued</TableHead>
                    <TableHead className="w-42">Due Date</TableHead>
                    <TableHead className="w-42">Returned</TableHead>
                    <TableHead className="w-26 text-right">Renewals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.items.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;

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
                        <TableCell className="font-medium text-foreground">
                          {item.book_status.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatStudentBorrowHistoryDateTime(item.issue_date)}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatStudentBorrowHistoryDateTime(item.due_date)}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-emerald-700">
                          {formatStudentBorrowHistoryDateTime(item.return_date)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {item.renewal_count}
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
                options={HISTORY_PAGE_SIZE_OPTIONS}
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

export function StudentBorrowHistoryScreen() {
  const history = useStudentBorrowHistory({
    autoLoad: true,
  });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<BorrowHistoryStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    React.useState<BorrowHistoryCategoryFilter>("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);

  const filteredItems = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return history.items.filter((item) => {
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
  }, [history.items, searchTerm, categoryFilter, statusFilter]);

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

  return (
    <PageContainer
      eyebrow="Student Borrow History"
      title="Borrow History"
      description="Review completed borrowing records with filters, pagination, and renewal details."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {filteredItems.length} shown
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {history.items.length} total
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void history.refresh();
            }}
            disabled={history.loading || history.refreshing}
          >
            {history.refreshing ? (
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

        {history.error && !history.hasData ? (
          <StudentBorrowHistoryFailureState
            hasStaleData={false}
            message={history.error}
            onRetry={history.retry}
          />
        ) : null}

        {history.loading && !history.hasData ? (
          <StudentBorrowHistoryLoadingState />
        ) : (
          <>
            {history.error && history.hasData ? (
              <StudentBorrowHistoryFailureState
                hasStaleData={history.hasStaleData}
                message={history.error}
                onRetry={history.retry}
              />
            ) : null}

            {history.isEmpty ? (
              <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
                <CardContent className="space-y-5 px-6 py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <History className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                      No Borrow History
                    </p>
                    <p className="text-2xl font-black tracking-tight text-foreground">
                      Your completed borrow records are currently empty.
                    </p>
                    <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
                      Returned books will appear here after you complete your
                      first borrow and return cycle.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild className="rounded-xl">
                      <Link href="/student/borrows">Back To Active Borrows</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href="/student/catalog">Back To Catalog</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <StudentBorrowHistoryTable
                loading={history.loading}
                items={pagedItems}
                totalItems={filteredItems.length}
                hasAppliedFilters={hasAppliedFilters}
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                categoryFilter={categoryFilter}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
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
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
