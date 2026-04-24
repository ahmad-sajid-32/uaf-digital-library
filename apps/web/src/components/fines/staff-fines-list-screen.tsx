// apps/web/src/components/fines/staff-fines-list-screen.tsx
/**
 * Staff fine-management list screen for the authenticated shell.
 *
 * Purpose:
 * - Render the first real fine-management list surface inside the protected
 *   shell.
 * - Keep the list truthful by loading the staff fine directory into a shared
 *   cache once, then deriving search, filters, and pagination locally from
 *   that cached dataset.
 * - Provide real settlement entry flows with confirmation and backend-sourced
 *   reconciliation instead of staging fake actions.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  BadgeX,
  CircleDollarSign,
  Eye,
  FilterX,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import { FineStatusBadge, StaffFineDetailDialog } from "@/components/fines";
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
import {
  DateRangePicker,
  type DateRangePickerValue,
} from "@/components/ui/date-range-picker";
import { PaginationControl } from "@/components/ui/pagination-control";
import { RowsControl } from "@/components/ui/rows-control";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  usePayFine,
  useStaffFinesList,
  useWaiveFine,
  type StaffFineStatusFilter,
} from "@/hooks/useFines";
import type { StaffFineDetailItem, StaffFineListItem } from "@/lib/api/fines";

const WAIVE_REASON_MAX_LENGTH = 300;

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
    return "Not resolved";
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

function shortenId(value: string): string {
  if (value.length <= 13) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function FineListLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16 rounded-3xl" />
      <Skeleton className="h-112 rounded-3xl" />
    </div>
  );
}

function FineListFailureState(props: {
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
            Unable to load the fine records.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              There was a problem while loading the fines data. Retry to fetch
              the latest fine data.
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
}): React.JSX.Element {
  const Icon = props.icon;
  const disabled = props.disabled ?? true;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      className="h-8 rounded-xl px-2 sm:h-9 sm:px-3"
      aria-label={
        disabled
          ? `${props.label} action is not enabled yet`
          : `${props.label} fine action`
      }
      title={
        disabled
          ? `${props.label} action is not enabled yet`
          : `${props.label} fine action`
      }
      onClick={props.onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only">{props.label}</span>
    </Button>
  );
}

function StaffFineTable(props: {
  loading: boolean;
  searchTerm: string;
  status: StaffFineStatusFilter;
  createdDateRange: DateRangePickerValue;
  hasAppliedFilters: boolean;
  serverTotalItems: number;
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  items: StaffFineListItem[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StaffFineStatusFilter) => void;
  onCreatedDateRangeChange: (value: DateRangePickerValue) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (fineId: string) => void;
  onPay: (item: StaffFineListItem) => void;
  onWaive: (item: StaffFineListItem) => void;
  payPendingFineId: string | null;
  waivePendingFineId: string | null;
}): React.JSX.Element {
  const isServerEmpty = props.serverTotalItems === 0;
  const emptyEyebrow = isServerEmpty ? "Directory Empty" : "Empty Result";
  const emptyTitle = isServerEmpty
    ? "No fine records exist yet."
    : "No fines match the current filters.";
  const emptyMessage = isServerEmpty
    ? "Once overdue or unresolved borrow activity produces fines, those records will appear here for staff review."
    : "Change the search text, status filter, or date range to find matching fine records.";

  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-section-title font-display font-black tracking-tight">
                Staff Fine Directory
              </CardTitle>
              <Badge variant="secondary" className="rounded-full">
                {props.totalItems} shown
              </Badge>
            </div>
            <CardDescription className="px-0 text-sm leading-6">
              Review fine records associated to the students & staff.
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

        <div className="grid grid-cols-1 items-end justify-between gap-3 lg:grid-cols-3 ">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={props.searchTerm}
              onChange={(event) => {
                props.onSearchChange(event.target.value);
              }}
              placeholder="Search borrower name, book title, or fine ID"
              className="h-10 rounded-xl border-border/70 bg-background pl-9"
              aria-label="Search fines"
            />
          </div>

          <Select
            value={props.status}
            onValueChange={(value) => {
              props.onStatusChange(value as StaffFineStatusFilter);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <DateRangePicker
            label="Created Date Range"
            value={props.createdDateRange}
            onChange={props.onCreatedDateRangeChange}
            placeholder="Filter by created date range"
          />
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
                    <TableHead className="w-32">Fine</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Book</TableHead>
                    <TableHead className="w-32">Amount</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-44">Created</TableHead>
                    <TableHead className="w-44 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.items.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;

                    return (
                      <TableRow key={item.fine_id}>
                        <TableCell className="font-semibold text-muted-foreground">
                          {serialNumber.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {shortenId(item.fine_id)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              TXN {shortenId(item.transaction_id)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {item.user_full_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="line-clamp-2 max-w-76 font-medium text-foreground">
                            {item.title}
                          </p>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {formatMoney(item.amount)}
                        </TableCell>
                        <TableCell>
                          <FineStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {formatDateTime(item.fine_created_at)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.resolved_at
                                ? `Resolved ${formatDateTime(item.resolved_at)}`
                                : "Not resolved yet"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <ActionEntryButton
                              label="View"
                              icon={Eye}
                              disabled={false}
                              onClick={() => {
                                props.onView(item.fine_id);
                              }}
                            />
                            <ActionEntryButton
                              label={
                                props.payPendingFineId === item.fine_id
                                  ? "Paying"
                                  : "Pay"
                              }
                              icon={CircleDollarSign}
                              disabled={
                                item.status !== "pending" ||
                                Boolean(props.payPendingFineId) ||
                                Boolean(props.waivePendingFineId)
                              }
                              onClick={() => {
                                props.onPay(item);
                              }}
                            />
                            <ActionEntryButton
                              label={
                                props.waivePendingFineId === item.fine_id
                                  ? "Waiving"
                                  : "Waive"
                              }
                              icon={BadgeX}
                              disabled={
                                item.status !== "pending" ||
                                Boolean(props.payPendingFineId) ||
                                Boolean(props.waivePendingFineId)
                              }
                              onClick={() => {
                                props.onWaive(item);
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

function SettlementContextSummary(props: {
  item: StaffFineListItem | StaffFineDetailItem;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Borrower
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {props.item.user_full_name}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Amount
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatMoney(props.item.amount)}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Book
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {props.item.title}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Fine ID
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {props.item.fine_id}
          </p>
        </div>
      </div>
    </div>
  );
}

export function StaffFinesListScreen(): React.JSX.Element {
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
    refresh,
    retry,
    setStatusFilter,
    setSearchTerm,
    setCreatedDateRange,
    setPage,
    setPageSize,
    resetFilters,
  } = useStaffFinesList({
    autoLoad: true,
  });
  const {
    destructivePending: payPending,
    error: payError,
    clearError: clearPayError,
    payFine,
  } = usePayFine();
  const {
    destructivePending: waivePending,
    error: waiveError,
    clearError: clearWaiveError,
    waiveFine,
  } = useWaiveFine();
  const [detailFineId, setDetailFineId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [payTarget, setPayTarget] = React.useState<
    StaffFineListItem | StaffFineDetailItem | null
  >(null);
  const [waiveTarget, setWaiveTarget] = React.useState<
    StaffFineListItem | StaffFineDetailItem | null
  >(null);
  const [waiveReason, setWaiveReason] = React.useState("");
  const waiveReasonLength = waiveReason.length;
  const waiveReasonTooLong = waiveReasonLength > WAIVE_REASON_MAX_LENGTH;

  const openPayDialog = React.useCallback(
    (item: StaffFineListItem | StaffFineDetailItem) => {
      clearPayError();
      clearWaiveError();
      setWaiveReason("");
      setWaiveTarget(null);
      setPayTarget(item);
    },
    [clearPayError, clearWaiveError],
  );

  const openWaiveDialog = React.useCallback(
    (item: StaffFineListItem | StaffFineDetailItem) => {
      clearWaiveError();
      clearPayError();
      setPayTarget(null);
      setWaiveReason("");
      setWaiveTarget(item);
    },
    [clearPayError, clearWaiveError],
  );

  const openDetailDialog = React.useCallback((fineId: string) => {
    setDetailFineId(fineId);
    setDetailOpen(true);
  }, []);

  const handlePayConfirm = React.useCallback(async () => {
    if (!payTarget) {
      return;
    }

    const succeeded = await payFine(payTarget.fine_id);

    if (succeeded) {
      clearPayError();
      setPayTarget(null);
    }
  }, [clearPayError, payFine, payTarget]);

  const handleWaiveConfirm = React.useCallback(async () => {
    if (!waiveTarget || waiveReasonTooLong) {
      return;
    }

    const normalizedReason = waiveReason.trim();
    const succeeded = await waiveFine(waiveTarget.fine_id, {
      reason: normalizedReason ? normalizedReason : null,
    });

    if (succeeded) {
      clearWaiveError();
      setWaiveReason("");
      setWaiveTarget(null);
    }
  }, [
    clearWaiveError,
    waiveFine,
    waiveReason,
    waiveReasonTooLong,
    waiveTarget,
  ]);

  const detailPayPending =
    payPending && detailFineId !== null && payTarget?.fine_id === detailFineId;
  const detailWaivePending =
    waivePending &&
    detailFineId !== null &&
    waiveTarget?.fine_id === detailFineId;
  const detailPayError =
    detailFineId !== null && payTarget?.fine_id === detailFineId
      ? payError
      : null;
  const detailWaiveError =
    detailFineId !== null && waiveTarget?.fine_id === detailFineId
      ? waiveError
      : null;

  return (
    <PageContainer
      eyebrow="Staff Fines"
      title="Fine Management"
      description="Review & Manage the fines "
      actions={
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
      }
    >
      <ScrollReveal direction="up" delayMs={90}>
        <div className="flex flex-1 flex-col gap-6">
          {error && !hasData ? (
            <FineListFailureState
              hasStaleData={false}
              message={error}
              onRetry={retry}
            />
          ) : null}

          {loading && !hasData ? (
            <FineListLoadingState />
          ) : (
            <>
              {error && hasData ? (
                <FineListFailureState
                  hasStaleData={hasStaleData}
                  message={error}
                  onRetry={retry}
                />
              ) : null}

              <StaffFineTable
                loading={status === "loading" && !hasData}
                searchTerm={filters.searchTerm}
                status={filters.status}
                createdDateRange={filters.createdDateRange}
                hasAppliedFilters={hasAppliedFilters}
                serverTotalItems={totalLoadedItems}
                totalItems={filteredCount}
                totalPages={totalPages}
                page={filters.page}
                pageSize={filters.pageSize}
                pageSizeOptions={pageSizeOptions}
                items={items}
                onSearchChange={setSearchTerm}
                onStatusChange={setStatusFilter}
                onCreatedDateRangeChange={setCreatedDateRange}
                onResetFilters={resetFilters}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onView={openDetailDialog}
                onPay={openPayDialog}
                onWaive={openWaiveDialog}
                payPendingFineId={
                  payPending && payTarget ? payTarget.fine_id : null
                }
                waivePendingFineId={
                  waivePending && waiveTarget ? waiveTarget.fine_id : null
                }
              />
            </>
          )}
        </div>
      </ScrollReveal>

      <StaffFineDetailDialog
        fineId={detailFineId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);

          if (!open) {
            setDetailFineId(null);
          }
        }}
        payPending={detailPayPending}
        waivePending={detailWaivePending}
        payError={detailPayError}
        waiveError={detailWaiveError}
        onPayRequested={openPayDialog}
        onWaiveRequested={openWaiveDialog}
      />

      <AlertDialog
        open={Boolean(payTarget)}
        onOpenChange={(open) => {
          if (!open) {
            clearPayError();
            setPayTarget(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-3xl border-border/70">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="font-display text-2xl font-black tracking-tight">
              Mark Fine as Paid
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6">
              Confirm this only after staff has verified that payment was
              actually received. This action resolves the pending fine.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {payTarget ? <SettlementContextSummary item={payTarget} /> : null}

          {payError ? (
            <p className="text-sm font-medium text-destructive">{payError}</p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              disabled={payPending}
              onClick={() => {
                clearPayError();
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={payPending}
              onClick={(event) => {
                event.preventDefault();
                void handlePayConfirm();
              }}
            >
              {payPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CircleDollarSign className="h-4 w-4" />
                  Confirm Payment
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(waiveTarget)}
        onOpenChange={(open) => {
          if (!open) {
            clearWaiveError();
            setWaiveReason("");
            setWaiveTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-[1.75rem] border-border/70">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Waive Fine
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Waiving resolves the pending fine without recording a payment. The
              reason is optional, but if staff has a justification it should be
              recorded here.
            </DialogDescription>
          </DialogHeader>

          {waiveTarget ? <SettlementContextSummary item={waiveTarget} /> : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="fine-waive-reason"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Waive Reason
              </label>
              <span
                className={
                  waiveReasonTooLong
                    ? "text-xs font-medium text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {waiveReasonLength}/{WAIVE_REASON_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="fine-waive-reason"
              value={waiveReason}
              onChange={(event) => {
                setWaiveReason(event.target.value);
              }}
              placeholder="Optional note about why this fine is being waived"
              maxLength={WAIVE_REASON_MAX_LENGTH}
              className="min-h-28 rounded-2xl border-border/70 bg-background"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Leave this blank if you do not know the reason.
            </p>
          </div>

          {waiveError ? (
            <p className="text-sm font-medium text-destructive">{waiveError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={waivePending}
              onClick={() => {
                clearWaiveError();
                setWaiveReason("");
                setWaiveTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={waivePending || waiveReasonTooLong}
              onClick={() => {
                void handleWaiveConfirm();
              }}
            >
              {waivePending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <BadgeX className="h-4 w-4" />
                  Confirm Waive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
