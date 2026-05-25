// apps/web/src/components/books/book-detail-dialog.tsx
/**
 * Staff book detail dialog with on-demand queue visibility.
 *
 * Purpose:
 * - Render the full staff book detail contract inside a dialog before action.
 * - Provide truthful loading, retry, not-found, and permission-denied states.
 * - Expose queue visibility for the selected book without inventing bulk queue
 *   management inside inventory.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  CircleOff,
  LoaderCircle,
  Lock,
  RefreshCw,
  SquarePen,
  UserRound,
} from "lucide-react";

import { BookCoverImage } from "@/components/books/book-cover-image";
import { BookStatusBadge } from "@/components/books/book-status-badge";
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
import {
  formatBookCoverSize,
  getBookCategoryLabel,
  getBookCoverMimeTypeLabel,
  getBookStatusLabel,
  type StaffBookDetailItem,
} from "@/lib/books";
import { useBookDetail, useBookQueueStatus } from "@/hooks/useBooks";

interface BookDetailDialogProps {
  bookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequested?: () => void;
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
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-48 rounded-3xl" />
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

function QueueVisibilityCard(props: {
  bookId: string;
  open: boolean;
}): React.JSX.Element {
  const { item, loading, error, refreshing, retry } = useBookQueueStatus(
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
      <CardContent className="px-5 pb-5">
        {loading && !item ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : error && !item ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : item ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailMetaField
              label="Current Circulation State"
              value={getBookStatusLabel(item.book_status)}
            />
            <DetailMetaField
              label="Waiting Readers"
              value={item.waiting_count}
            />
            <DetailMetaField
              label="Hold Notified"
              value={item.has_notified ? "Yes" : "No"}
            />
            <DetailMetaField
              label="Notified At"
              value={formatDateTime(item.notified_at)}
            />
            <div className="sm:col-span-2">
              <DetailMetaField
                label="Hold Expires"
                value={formatDateTime(item.hold_expires_at)}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Queue visibility is not available for this book right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BookDetailContent(props: {
  item: StaffBookDetailItem;
  refreshing: boolean;
  open: boolean;
  onEditRequested?: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
        <CardContent className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
              <BookCoverImage
                title={props.item.title}
                author={props.item.author}
                coverImageUrl={props.item.cover_image_url}
                coverImageAlt={props.item.cover_image_alt}
                variant="compact"
                loading="eager"
                className="h-28 w-20 rounded-2xl sm:h-32 sm:w-24"
              />

              <div className="min-w-0 space-y-3">
                <div>
                  <p className="font-display text-2xl font-black tracking-tight text-foreground">
                    {props.item.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    by {props.item.author}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <BookStatusBadge status={props.item.status} />
                  {props.refreshing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      className="h-8 rounded-full px-3"
                    >
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Refreshing...
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground sm:min-w-72">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <UserRound className="h-4 w-4 text-primary" />
                {getBookCategoryLabel(props.item.category)}
              </div>
              <p>Added {formatDateTime(props.item.created_at)}</p>
              <p>
                Custom duration{" "}
                {props.item.override_borrow_duration_days !== null
                  ? `${props.item.override_borrow_duration_days} days`
                  : "not set"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardHeader className="px-5 py-5">
          <CardTitle className="text-base font-black tracking-tight">
            Cover Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
          <DetailMetaField
            label="Format"
            value={
              props.item.cover_image_mime_type
                ? getBookCoverMimeTypeLabel(props.item.cover_image_mime_type)
                : "Not available"
            }
          />
          <DetailMetaField
            label="File Size"
            value={formatBookCoverSize(props.item.cover_image_size_bytes)}
          />
          <DetailMetaField
            label="Cover Updated"
            value={formatDateTime(props.item.cover_image_updated_at)}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardHeader className="px-5 py-5">
          <CardTitle className="text-base font-black tracking-tight">
            Inventory Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <DetailMetaField
            label="Category"
            value={getBookCategoryLabel(props.item.category)}
          />
          <DetailMetaField
            label="Status"
            value={getBookStatusLabel(props.item.status)}
          />
          <DetailMetaField
            label="Replacement Cost"
            value={formatMoney(props.item.replacement_cost)}
          />
          <DetailMetaField
            label="Fine Per Day Rate"
            value={formatMoney(props.item.fine_per_day_rate)}
          />
          <div className="sm:col-span-2">
            <DetailMetaField
              label="Custom Borrow Duration"
              value={
                props.item.override_borrow_duration_days !== null
                  ? `${props.item.override_borrow_duration_days} days`
                  : "Uses the normal borrowing duration"
              }
            />
          </div>
        </CardContent>
      </Card>

      <QueueVisibilityCard bookId={props.item.id} open={props.open} />

      <DialogFooter className="border-t border-border/60 pt-5">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Queue visibility is shown only for this selected book so inventory
            stays separate from bulk circulation management.
          </p>
          {props.onEditRequested ? (
            <Button
              type="button"
              className="gap-2 self-start rounded-xl sm:self-auto"
              onClick={props.onEditRequested}
            >
              <SquarePen className="h-4 w-4" />
              Edit Book
            </Button>
          ) : null}
        </div>
      </DialogFooter>
    </div>
  );
}

export function BookDetailDialog({
  bookId,
  open,
  onOpenChange,
  onEditRequested,
}: BookDetailDialogProps): React.JSX.Element {
  const { item, loading, error, errorStatus, hasData, refreshing, retry } =
    useBookDetail(bookId, {
      autoLoad: open,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl lg:min-w-4xl  overflow-y-auto rounded-3xl border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Book Detail
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Review the full inventory record and the selected-book queue
              visibility before editing the catalog entry.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loading && !hasData ? <DetailLoadingState /> : null}

          {!loading && !hasData && errorStatus === 404 ? (
            <DetailStateCard
              icon={CircleOff}
              eyebrow="Not Found"
              title="This book record is no longer available."
              message={error ?? "The requested book could not be found."}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {!loading && !hasData && errorStatus === 403 ? (
            <DetailStateCard
              icon={Lock}
              eyebrow="Permission Denied"
              title="This book detail cannot be opened."
              message={error ?? "Your current account cannot access this book."}
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
              title="Unable to load this book right now."
              message={error}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {item ? (
            <BookDetailContent
              item={item}
              refreshing={refreshing}
              open={open}
              onEditRequested={onEditRequested}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
