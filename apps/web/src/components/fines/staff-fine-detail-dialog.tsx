// apps/web/src/components/fines/staff-fine-detail-dialog.tsx
/**
 * Staff fine detail dialog with pending-only settlement entry points.
 *
 * Purpose:
 * - Render the full fine detail contract inside a dialog before settlement.
 * - Provide truthful loading, retry, not-found, and permission-denied states.
 * - Expose pay and waive actions only for pending fines while leaving the
 *   actual mutation execution owned by the parent module screen.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  BadgeX,
  BookCopy,
  CircleDollarSign,
  CircleOff,
  Lock,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { FineStatusBadge } from "@/components/fines/fine-status-badge";
import { Button } from "@/components/ui/button";
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
import { useStaffFineDetail } from "@/hooks/useFines";
import type { StaffFineDetailItem } from "@/lib/api/fines";

interface StaffFineDetailDialogProps {
  fineId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payPending?: boolean;
  waivePending?: boolean;
  payError?: string | null;
  waiveError?: string | null;
  onPayRequested?: (item: StaffFineDetailItem) => void;
  onWaiveRequested?: (item: StaffFineDetailItem) => void;
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

function shortenId(value: string): string {
  if (value.length <= 13) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
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

function DetailLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-[1.75rem]" />
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-44 rounded-3xl" />
    </div>
  );
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

function FineDetailContent(props: {
  item: StaffFineDetailItem;
  refreshing: boolean;
  payPending: boolean;
  waivePending: boolean;
  payError: string | null;
  waiveError: string | null;
  onPayRequested?: (item: StaffFineDetailItem) => void;
  onWaiveRequested?: (item: StaffFineDetailItem) => void;
}): React.JSX.Element {
  const isPending = props.item.status === "pending";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
        <CardContent className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CircleDollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-black tracking-tight text-foreground">
                    {formatMoney(props.item.amount)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <FineStatusBadge status={props.item.status} />
                    {props.refreshing ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                        className="h-8 rounded-full px-3"
                      >
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Refreshing
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailMetaField
                  label="Fine ID"
                  value={shortenId(props.item.fine_id)}
                />
                <DetailMetaField
                  label="Transaction ID"
                  value={shortenId(props.item.transaction_id)}
                />
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground sm:min-w-72">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <UserRound className="h-4 w-4 text-primary" />
                {props.item.user_full_name}
              </div>
              <p>Name: {props.item.user_full_name}</p>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <BookCopy className="h-4 w-4 text-primary" />
                {props.item.title}
              </div>
              <p>Book Title: {props.item.title}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardHeader className="px-5 py-5">
          <CardTitle className="text-base font-black tracking-tight">
            Fine Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <DetailMetaField
            label="Fine Created"
            value={formatDateTime(props.item.fine_created_at)}
          />
          <DetailMetaField
            label="Issue Date"
            value={formatDateTime(props.item.issue_date)}
          />
          <DetailMetaField
            label="Due Date"
            value={formatDateTime(props.item.due_date)}
          />
          <DetailMetaField
            label="Return Date"
            value={formatDateTime(props.item.return_date)}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardHeader className="px-5 py-5">
          <CardTitle className="text-base font-black tracking-tight">
            Resolution Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <DetailMetaField
            label="Resolved At"
            value={formatDateTime(props.item.resolved_at)}
          />
          <DetailMetaField
            label="Resolved By"
            value={props.item.resolved_by_name ?? "Not resolved"}
          />
          <DetailMetaField
            label="Waive Reason"
            value={props.item.waive_reason ?? "No waive reason recorded"}
          />
        </CardContent>
      </Card>

      <DialogFooter className="border-t border-border/60 pt-5">
        {isPending ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm leading-6 text-muted-foreground">
                This fine is still pending. Use one of the settlement actions
                below to resolve it.
              </p>
              {props.payError || props.waiveError ? (
                <p className="text-sm font-medium text-destructive">
                  {props.payError ?? props.waiveError}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={props.payPending || props.waivePending}
                onClick={() => {
                  props.onPayRequested?.(props.item);
                }}
              >
                <CircleDollarSign
                  className={
                    props.payPending ? "h-4 w-4 animate-spin" : "h-4 w-4"
                  }
                />
                {props.payPending ? "Processing..." : "Mark Paid"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={props.payPending || props.waivePending}
                onClick={() => {
                  props.onWaiveRequested?.(props.item);
                }}
              >
                <BadgeX
                  className={
                    props.waivePending ? "h-4 w-4 animate-spin" : "h-4 w-4"
                  }
                />
                {props.waivePending ? "Processing..." : "Waive Fine"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="w-full text-sm leading-6 text-muted-foreground">
            This fine is resolved.
          </p>
        )}
      </DialogFooter>
    </div>
  );
}

export function StaffFineDetailDialog({
  fineId,
  open,
  onOpenChange,
  payPending = false,
  waivePending = false,
  payError = null,
  waiveError = null,
  onPayRequested,
  onWaiveRequested,
}: StaffFineDetailDialogProps): React.JSX.Element {
  const { item, loading, error, errorStatus, hasData, refreshing, retry } =
    useStaffFineDetail(fineId, {
      autoLoad: open,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[1.75rem] border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Fine Detail
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Review the complete fine record. Pending fines can be settled from
              this detail view if not resolved.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loading && !hasData ? <DetailLoadingState /> : null}

          {!loading && !hasData && errorStatus === 404 ? (
            <DetailStateCard
              icon={CircleOff}
              eyebrow="Not Found"
              title="This fine record is no longer available."
              message={error ?? "The requested fine could not be found."}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {!loading && !hasData && errorStatus === 403 ? (
            <DetailStateCard
              icon={Lock}
              eyebrow="Permission Denied"
              title="This fine detail cannot be opened."
              message={
                error ?? "Your current account cannot access this fine record."
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
              title="Unable to load this fine right now."
              message={error}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {item ? (
            <FineDetailContent
              item={item}
              refreshing={refreshing}
              payPending={payPending}
              waivePending={waivePending}
              payError={payError}
              waiveError={waiveError}
              onPayRequested={onPayRequested}
              onWaiveRequested={onWaiveRequested}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
