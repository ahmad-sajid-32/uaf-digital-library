// apps/web/src/components/circulation/circulation-detail-dialog.tsx
/**
 * Staff circulation loan detail dialog.
 *
 * Purpose:
 * - Render the selected-loan detail contract inside a dialog before staff
 *   actions.
 * - Provide truthful loading, retry, not-found, permission-denied, and queue
 *   visibility states.
 * - Keep staff return, renew, and due-date adjustment bound to the selected
 *   transaction instead of inventing frontend-only state transitions.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  AlertCircle,
  BookCopy,
  CalendarClock,
  CircleOff,
  LoaderCircle,
  Lock,
  RefreshCw,
  RotateCw,
  Undo2,
  UserRound,
} from "lucide-react";

import {
  CirculationFineStatusBadge,
  CirculationLoanStateBadge,
  CirculationQueueBadge,
  CirculationRoleBadge,
} from "@/components/circulation/circulation-badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getBookStatusLabel } from "@/lib/books";
import { type StaffCirculationLoanDetailItem } from "@/lib/circulation";
import {
  useCirculationBookQueueStatus,
  useStaffCirculationLoanDetail,
} from "@/hooks/useCirculation";

interface CirculationDetailDialogProps {
  transactionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnRequested?: (loan: StaffCirculationLoanDetailItem) => void;
  onRenewRequested?: (loan: StaffCirculationLoanDetailItem) => void;
  onAdjustDueDateRequested?: (loan: StaffCirculationLoanDetailItem) => void;
}

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
    return "Not available";
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

function DetailMetaField(props: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {props.label}
      </p>
      <div className="mt-1 text-sm font-semibold text-foreground">
        {props.value}
      </div>
    </div>
  );
}

function DetailStateCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Card className="border-border/60 bg-muted/35 py-0 shadow-none">
      <CardContent className="px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {props.eyebrow}
        </p>
        <p className="mt-2 text-xl font-black text-foreground">{props.title}</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {props.message}
        </p>
        {props.actionLabel && props.onAction ? (
          <Button
            type="button"
            variant="outline"
            className="mt-5 gap-2 rounded-xl"
            onClick={() => {
              void props.onAction?.();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {props.actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QueueVisibilityCard(props: {
  bookId: string;
  open: boolean;
}): React.JSX.Element {
  const { item, loading, error, refreshing, retry } = useCirculationBookQueueStatus(
    props.bookId,
    {
      autoLoad: props.open,
    },
  );

  return (
    <Card className="border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-black tracking-tight">
            Queue Visibility
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={loading || refreshing}
            onClick={() => {
              void retry();
            }}
          >
            {loading || refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        {loading && !item ? (
          <>
            <Skeleton className="h-18 rounded-2xl" />
            <Skeleton className="h-18 rounded-2xl" />
          </>
        ) : error && !item ? (
          <div className="sm:col-span-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : item ? (
          <>
            <DetailMetaField label="Book State" value={getBookStatusLabel(item.book_status)} />
            <DetailMetaField label="Waiting Readers" value={item.waiting_count} />
            <DetailMetaField label="Hold Notified" value={item.has_notified ? "Yes" : "No"} />
            <DetailMetaField label="Hold Expires" value={formatDateTime(item.hold_expires_at)} />
          </>
        ) : (
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            Queue visibility is not available for this book right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}

function LoanDetailContent(props: {
  item: StaffCirculationLoanDetailItem;
  refreshing: boolean;
  open: boolean;
  onReturnRequested?: (loan: StaffCirculationLoanDetailItem) => void;
  onRenewRequested?: (loan: StaffCirculationLoanDetailItem) => void;
  onAdjustDueDateRequested?: (loan: StaffCirculationLoanDetailItem) => void;
}): React.JSX.Element {
  const pathname = usePathname();
  const isAdminShell = pathname.startsWith("/admin/");

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
        <CardContent className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BookCopy className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-black tracking-tight text-foreground">
                    {props.item.book_title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    borrowed by {props.item.user_full_name}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CirculationLoanStateBadge
                      returned={props.item.return_date !== null}
                      overdue={props.item.is_overdue}
                      bookStatus={props.item.book_status}
                    />
                    <CirculationQueueBadge
                      waitingCount={props.item.waiting_count}
                      queueStatus={props.item.queue_status}
                    />
                    {props.refreshing ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300"
                      >
                        <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Refreshing
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground sm:min-w-72">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <UserRound className="h-4 w-4 text-primary" />
                <CirculationRoleBadge role={props.item.user_role} />
              </div>
              <p>{props.item.user_email ?? "Email not available"}</p>
              <p>
                {props.item.roll_number
                  ? `Roll no. ${props.item.roll_number}`
                  : props.item.employee_code
                    ? `Employee code ${props.item.employee_code}`
                    : "No institution code recorded"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardHeader className="px-5 py-5">
          <CardTitle className="text-base font-black tracking-tight">
            Loan Context
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailMetaField label="Transaction ID" value={props.item.transaction_id} />
          <DetailMetaField label="Book Author" value={props.item.book_author} />
          <DetailMetaField label="Book Category" value={props.item.book_category} />
          <DetailMetaField label="Issue Date" value={formatDateTime(props.item.issue_date)} />
          <DetailMetaField label="Due Date" value={formatDateTime(props.item.due_date)} />
          <DetailMetaField label="Return Date" value={formatDateTime(props.item.return_date)} />
          <DetailMetaField label="Renewal Count" value={props.item.renewal_count} />
          <DetailMetaField label="Fine Amount" value={formatMoney(props.item.fine_amount)} />
          <DetailMetaField
            label="Fine Status"
            value={
              props.item.fine_status
                ? (
                    <CirculationFineStatusBadge
                      fineStatus={props.item.fine_status}
                      fineAmount={props.item.fine_amount}
                      showAmountWhenPending={false}
                    />
                  )
                : "No fine recorded"
            }
          />
          <DetailMetaField label="Waiting Count" value={props.item.waiting_count} />
          <DetailMetaField
            label="Hold Expires"
            value={formatDateTime(props.item.hold_expires_at)}
          />
          <DetailMetaField label="Book Status" value={getBookStatusLabel(props.item.book_status)} />
        </CardContent>
      </Card>

      <QueueVisibilityCard bookId={props.item.book_id} open={props.open} />

      <DialogFooter className="border-t border-border/60 pt-5">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {isAdminShell ? (
              <Button asChild type="button" variant="outline" className="rounded-xl">
                <Link href={`/admin/users?search=${encodeURIComponent(props.item.user_email ?? props.item.user_full_name)}`}>
                  User Directory
                </Link>
              </Button>
            ) : null}
            <Button asChild type="button" variant="outline" className="rounded-xl">
              <Link href={`${isAdminShell ? "/admin" : "/librarian"}/fines?search=${encodeURIComponent(props.item.transaction_id)}`}>
                Fine Records
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-xl border-sky-500/25 bg-sky-500/8 text-sky-700 hover:border-sky-500/35 hover:bg-sky-500/12 hover:text-sky-700 dark:text-sky-300"
              disabled={!props.item.can_adjust_due_date}
              onClick={() => {
                props.onAdjustDueDateRequested?.(props.item);
              }}
            >
              <CalendarClock className="h-4 w-4" />
              Adjust Due Date
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-xl border-emerald-500/25 bg-emerald-500/8 text-emerald-700 hover:border-emerald-500/35 hover:bg-emerald-500/12 hover:text-emerald-700 dark:text-emerald-300"
              disabled={!props.item.can_renew}
              onClick={() => {
                props.onRenewRequested?.(props.item);
              }}
            >
              <RotateCw className="h-4 w-4" />
              Renew
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-xl"
              disabled={!props.item.can_return}
              onClick={() => {
                props.onReturnRequested?.(props.item);
              }}
            >
              <Undo2 className="h-4 w-4" />
              Return
            </Button>
          </div>
        </div>
      </DialogFooter>
    </div>
  );
}

export function CirculationDetailDialog({
  transactionId,
  open,
  onOpenChange,
  onReturnRequested,
  onRenewRequested,
  onAdjustDueDateRequested,
}: CirculationDetailDialogProps): React.JSX.Element {
  const { item, loading, error, errorStatus, hasData, refreshing, retry } =
    useStaffCirculationLoanDetail(transactionId, {
      autoLoad: open,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl overflow-y-auto rounded-3xl border-border/70 p-0 lg:min-w-4xl">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Loan Detail
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Review borrower identity, book context, due-date state, fine
              state, and queue linkage before taking a staff circulation action.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loading && !hasData ? <DetailLoadingState /> : null}

          {!loading && !hasData && errorStatus === 404 ? (
            <DetailStateCard
              icon={CircleOff}
              eyebrow="Not Found"
              title="This loan record is no longer available."
              message={error ?? "The requested loan could not be found."}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {!loading && !hasData && errorStatus === 403 ? (
            <DetailStateCard
              icon={Lock}
              eyebrow="Permission Denied"
              title="This loan detail cannot be opened."
              message={
                error ?? "Your current account cannot access this circulation record."
              }
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {!loading &&
          !hasData &&
          errorStatus !== 403 &&
          errorStatus !== 404 &&
          error ? (
            <DetailStateCard
              icon={AlertCircle}
              eyebrow="Retry Required"
              title="Unable to load this loan right now."
              message={error}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {item ? (
            <LoanDetailContent
              item={item}
              refreshing={refreshing}
              open={open}
              onReturnRequested={onReturnRequested}
              onRenewRequested={onRenewRequested}
              onAdjustDueDateRequested={onAdjustDueDateRequested}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
