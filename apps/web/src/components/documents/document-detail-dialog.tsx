/**
 * Staff document detail dialog with action controls.
 *
 * Purpose:
 * - Render the full document metadata contract inside a dialog before action.
 * - Provide truthful loading, retry, not-found, and permission-denied states.
 * - Expose preview/download, finalize or retry, and delete confirmation from
 *   the detail surface while keeping backend truth in the shared module hooks.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  CircleOff,
  Download,
  FileDigit,
  FileSearch,
  LoaderCircle,
  Lock,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDocumentDetail,
  useDocumentReadUrl,
  useFinalizeDocument,
} from "@/hooks/useDocuments";
import type { DocumentDetailItem } from "@/lib/api/documents";

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

function formatFileSize(value: number | null): string {
  if (value === null || value <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function openSignedUrl(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadSignedUrl(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
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
      <Skeleton className="h-56 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
    </div>
  );
}

function DetailMetaField(props: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  const isPrimitiveValue =
    typeof props.value === "string" || typeof props.value === "number";
  const displayTitle = isPrimitiveValue ? String(props.value) : undefined;

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {props.label}
      </p>
      <div className="mt-1 min-w-0 text-sm font-semibold text-foreground">
        {isPrimitiveValue ? (
          <p className="truncate" title={displayTitle}>
            {displayTitle}
          </p>
        ) : (
          <div className="min-w-0 overflow-hidden text-ellipsis">
            {props.value}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailActionButton(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  variant?: "default" | "outline";
  destructive?: boolean;
  className?: string;
  onClick: () => void;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Button
      type="button"
      variant={props.variant ?? "outline"}
      className={
        props.destructive
          ? `h-11 justify-start rounded-xl border-destructive/20 bg-destructive/8 text-destructive hover:border-destructive/35 hover:bg-destructive/14 hover:text-destructive ${props.className ?? ""}`
          : `h-11 justify-start rounded-xl ${props.className ?? ""}`
      }
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {props.loading ? props.loadingLabel : props.label}
    </Button>
  );
}

function DocumentDetailContent(props: {
  item: DocumentDetailItem;
  refreshing: boolean;
  readUrlPending: boolean;
  activeReadAction: "preview" | "download" | null;
  finalizePending: boolean;
  readUrlError: string | null;
  finalizeError: string | null;
  onPreview: (item: DocumentDetailItem) => void | Promise<void>;
  onDownload: (item: DocumentDetailItem) => void | Promise<void>;
  onFinalize: (item: DocumentDetailItem) => void | Promise<void>;
  onDeleteRequested: (item: DocumentDetailItem) => void;
}): React.JSX.Element {
  const addedByName = props.item.uploaded_by_name?.trim() || "Staff member";

  return (
    <div className="grid gap-4 ">
      <div className="space-y-4">
        <Card className="overflow-hidden border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
          <CardContent className="px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-display text-2xl font-black tracking-tight text-foreground">
                      {props.item.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <DocumentStatusBadge
                        status={props.item.processing_status}
                        isUploadStale={props.item.is_upload_stale}
                      />
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailMetaField label="Added By" value={addedByName} />
                  <DetailMetaField
                    label="Addeed on"
                    value={formatDateTime(props.item.created_at)}
                  />
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground sm:min-w-72">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <FileDigit className="h-4 w-4 text-primary" />
                  {props.item.original_filename}
                </div>
                <p>Size: {formatFileSize(props.item.file_size_bytes)}</p>
                <p>Status note: {props.item.lifecycle_note}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/95 py-0 shadow-none">
          <CardHeader className="px-5 py-3">
            <CardTitle className="text-base font-black tracking-tight">
              Document Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <DetailMetaField label="Title" value={props.item.title} />
            <DetailMetaField
              label="File Name"
              value={props.item.original_filename}
            />
            <DetailMetaField
              label="Category"
              value={props.item.document_type ?? "Not set"}
            />
            <DetailMetaField
              label="Who Can Use It"
              value={props.item.audience_scope ?? "Not set"}
            />
            <DetailMetaField
              label="Department"
              value={props.item.department ?? "Not set"}
            />
            <DetailMetaField label="Added By" value={addedByName} />
            <DetailMetaField
              label="Problem Note"
              value={props.item.indexing_error ?? "No issues recorded"}
            />
          </CardContent>
        </Card>

        {props.readUrlError || props.finalizeError ? (
          <p className="text-sm font-medium text-destructive">
            {props.readUrlError ?? props.finalizeError}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card className="border-border/60 bg-card/95 py-0 shadow-none">
          <CardHeader className="px-5 py-3">
            <CardTitle className="text-base font-black tracking-tight">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 lg:flex flex-row items-center gap-4 justify-between">
            <p className="text-sm leading-6 text-muted-foreground">
              Open the file, save a fresh processed version, or remove it from
              the document library from one place.
            </p>

            <div className="flex flex-col md:flex-row gap-2">
              <DetailActionButton
                icon={Sparkles}
                label="Preview"
                loadingLabel="Opening Preview..."
                loading={
                  props.readUrlPending && props.activeReadAction === "preview"
                }
                disabled={props.readUrlPending}
                className="border-sky-500/25 bg-sky-500/10 text-sky-700 hover:border-sky-500/40 hover:bg-sky-500/15 hover:text-sky-700 dark:text-sky-300"
                onClick={() => {
                  void props.onPreview(props.item);
                }}
              />
              <DetailActionButton
                icon={Download}
                label="Download"
                loadingLabel="Preparing Download..."
                loading={
                  props.readUrlPending && props.activeReadAction === "download"
                }
                disabled={props.readUrlPending}
                className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-300"
                onClick={() => {
                  void props.onDownload(props.item);
                }}
              />

              <DetailActionButton
                icon={Trash2}
                label="Delete"
                loadingLabel="Deleting..."
                loading={false}
                disabled={props.finalizePending}
                destructive
                onClick={() => {
                  props.onDeleteRequested(props.item);
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DocumentDetailDialog(props: {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteRequested?: (item: DocumentDetailItem) => void;
}): React.JSX.Element {
  const { item, loading, error, errorStatus, hasData, refreshing, retry } =
    useDocumentDetail(props.documentId, {
      autoLoad: props.open,
    });
  const {
    pending: readUrlPending,
    error: readUrlError,
    clearError: clearReadUrlError,
    fetchReadUrl,
  } = useDocumentReadUrl();
  const {
    destructivePending: finalizePending,
    error: finalizeError,
    clearError: clearFinalizeError,
    finalize,
  } = useFinalizeDocument();
  const [activeReadAction, setActiveReadAction] = React.useState<
    "preview" | "download" | null
  >(null);

  const openPreview = React.useCallback(
    async (detailItem: DocumentDetailItem) => {
      clearReadUrlError();
      setActiveReadAction("preview");

      try {
        const readData = await fetchReadUrl(detailItem.id, "inline");

        if (readData) {
          openSignedUrl(readData.signed_read_url);
        }
      } finally {
        setActiveReadAction((current) =>
          current === "preview" ? null : current,
        );
      }
    },
    [clearReadUrlError, fetchReadUrl],
  );

  const openDownload = React.useCallback(
    async (detailItem: DocumentDetailItem) => {
      clearReadUrlError();
      setActiveReadAction("download");

      try {
        const readData = await fetchReadUrl(detailItem.id, "attachment");

        if (readData) {
          downloadSignedUrl(readData.signed_read_url);
        }
      } finally {
        setActiveReadAction((current) =>
          current === "download" ? null : current,
        );
      }
    },
    [clearReadUrlError, fetchReadUrl],
  );

  const handleFinalize = React.useCallback(
    async (detailItem: DocumentDetailItem) => {
      clearFinalizeError();
      await finalize(detailItem.id);
    },
    [clearFinalizeError, finalize],
  );

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          clearReadUrlError();
          clearFinalizeError();
          setActiveReadAction(null);
        }

        props.onOpenChange(open);
      }}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl lg:min-w-4xl xl:min-w-6xl overflow-y-auto rounded-3xl border-border/70 p-0">
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-8">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              Document Detail
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Review the full document record before opening it, finishing
              setup again, or removing it from the library.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loading && !hasData ? <DetailLoadingState /> : null}

          {!loading && !hasData && errorStatus === 404 ? (
            <DetailStateCard
              icon={CircleOff}
              eyebrow="Not Found"
              title="This document record is no longer available."
              message={error ?? "The requested document could not be found."}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {!loading && !hasData && errorStatus === 403 ? (
            <DetailStateCard
              icon={Lock}
              eyebrow="Permission Denied"
              title="This document detail cannot be opened."
              message={
                error ??
                "Your current account cannot access this document record."
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
              title="Unable to load this document right now."
              message={error}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {item ? (
            <DocumentDetailContent
              item={item}
              refreshing={refreshing}
              readUrlPending={readUrlPending}
              activeReadAction={activeReadAction}
              finalizePending={finalizePending}
              readUrlError={readUrlError}
              finalizeError={finalizeError}
              onPreview={openPreview}
              onDownload={openDownload}
              onFinalize={handleFinalize}
              onDeleteRequested={(detailItem) => {
                props.onDeleteRequested?.(detailItem);
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
