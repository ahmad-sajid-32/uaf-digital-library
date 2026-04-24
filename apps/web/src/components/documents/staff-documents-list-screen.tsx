/**
 * Staff document-management list screen for the authenticated shell.
 *
 * Purpose:
 * - Render the first real document-management list surface inside the protected
 *   shell.
 * - Keep the list truthful by loading the staff document directory into a
 *   shared cache once, then deriving search, status filtering, and pagination
 *   locally from that cached dataset.
 * - Expose only the row-level actions that are already safe to run directly
 *   from the list in this pass while leaving upload, full detail, and delete
 *   flows for their dedicated later passes.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  Eye,
  FilePlus2,
  FilterX,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { DocumentDetailDialog } from "@/components/documents/document-detail-dialog";
import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
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
  useDeleteDocument,
  useDocumentReadUrl,
  useDocumentsList,
  useFinalizeDocument,
  type DocumentStatusFilter,
} from "@/hooks/useDocuments";
import type {
  DocumentDetailItem,
  DocumentListItem,
} from "@/lib/api/documents";

type DeleteDialogTarget = Pick<
  DocumentListItem,
  "id" | "title" | "original_filename"
>;

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

function DocumentListLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16 rounded-3xl" />
      <Skeleton className="h-112 rounded-3xl" />
    </div>
  );
}

function DocumentListFailureState(props: {
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
            Unable to load the document records.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              There was a problem while loading the documents data. Retry to
              fetch the latest document directory.
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
          : `${props.label} document action`
      }
      title={props.title ?? `${props.label} document action`}
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

function StaffDocumentsTable(props: {
  loading: boolean;
  searchTerm: string;
  status: DocumentStatusFilter;
  hasAppliedFilters: boolean;
  serverTotalItems: number;
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  items: DocumentListItem[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: DocumentStatusFilter) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (item: DocumentListItem) => void;
  onPreview: (item: DocumentListItem) => void;
  onDownload: (item: DocumentListItem) => void;
  onFinalize: (item: DocumentListItem) => void;
  onDelete: (item: DocumentListItem) => void;
  previewPendingDocumentId: string | null;
  downloadPendingDocumentId: string | null;
  finalizePendingDocumentId: string | null;
  deletePendingDocumentId: string | null;
}): React.JSX.Element {
  const isServerEmpty = props.serverTotalItems === 0;
  const emptyEyebrow = isServerEmpty ? "Directory Empty" : "Empty Result";
  const emptyTitle = isServerEmpty
    ? "No document records exist yet."
    : "No documents match the current filters.";
  const emptyMessage = isServerEmpty
    ? "Once staff uploads official university documents, they will appear here for management and indexing review."
    : "Change the search text or status filter to find matching document records.";

  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-2xl font-black tracking-tight">
                Staff Document Directory
              </CardTitle>
              <Badge variant="secondary" className="rounded-full">
                {props.totalItems} shown
              </Badge>
            </div>
            <CardDescription className="px-0 text-sm leading-6">
              Review uploaded official documents, indexing status, and safe read
              access from one staff directory.
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

        <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={props.searchTerm}
              onChange={(event) => {
                props.onSearchChange(event.target.value);
              }}
              placeholder="Search title, filename, MIME type, or lifecycle note"
              className="h-10 rounded-xl border-border/70 bg-background pl-9"
              aria-label="Search documents"
            />
          </div>

          <Select
            value={props.status}
            onValueChange={(value) => {
              props.onStatusChange(value as DocumentStatusFilter);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="indexed">Indexed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
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
                    <TableHead className="min-w-86">Document</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="min-w-32">Size</TableHead>
                    <TableHead className="min-w-66">Created</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.items.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;
                    const canFinalize =
                      item.can_finalize || item.can_retry_finalize;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-muted-foreground">
                          {serialNumber.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.uploaded_by_name ?? "Staff member"}
                            </p>
                            <p className="text-xs leading-5 text-muted-foreground">
                              {item.lifecycle_note}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DocumentStatusBadge
                            status={item.processing_status}
                            isUploadStale={item.is_upload_stale}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatFileSize(item.file_size_bytes)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {formatDateTime(item.created_at)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <ActionEntryButton
                              label="View"
                              icon={Eye}
                              disabled={false}
                              className="border-primary/20 bg-primary/6 text-primary dark:text-primary-foreground hover:border-primary/35 hover:bg-primary/12 hover:text-primary"
                              title="Open document detail"
                              onClick={() => {
                                props.onView(item);
                              }}
                            />
                            <ActionEntryButton
                              label="Preview"
                              icon={Sparkles}
                              className="border-sky-500/25 bg-sky-500/10 text-sky-700 hover:border-sky-500/40 hover:bg-sky-500/15 hover:text-sky-700 dark:text-sky-300"
                              loading={
                                props.previewPendingDocumentId === item.id
                              }
                              disabled={
                                props.previewPendingDocumentId !== null ||
                                props.downloadPendingDocumentId !== null
                              }
                              title="Open a signed preview URL"
                              onClick={() => {
                                props.onPreview(item);
                              }}
                            />
                            {item.can_retry_finalize || item.can_finalize ? (
                              <ActionEntryButton
                                label={
                                  item.can_retry_finalize ? "Retry" : "Finalize"
                                }
                                icon={
                                  item.can_retry_finalize
                                    ? RotateCcw
                                    : FilePlus2
                                }
                                className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:border-amber-500/40 hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-300"
                                loading={
                                  props.finalizePendingDocumentId === item.id
                                }
                                disabled={
                                  !canFinalize ||
                                  props.finalizePendingDocumentId !== null
                                }
                                title={
                                  canFinalize
                                    ? item.can_retry_finalize
                                      ? "Retry failed indexing"
                                      : "Finalize uploaded document"
                                    : item.requires_reupload
                                      ? "Re-upload is required before finalize can run."
                                      : "Finalize is not valid for this document state."
                                }
                                onClick={() => {
                                  props.onFinalize(item);
                                }}
                              />
                            ) : null}
                            <ActionEntryButton
                              label="Delete"
                              icon={Trash2}
                              className="border-destructive/20 bg-destructive/8 text-destructive hover:border-destructive/35 hover:bg-destructive/14 hover:text-destructive"
                              loading={
                                props.deletePendingDocumentId === item.id
                              }
                              disabled={props.deletePendingDocumentId !== null}
                              title="Delete this document from the official directory"
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

function FinalizeContextSummary(props: {
  item: DocumentListItem;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Document
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {props.item.title}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Status
          </p>
          <div className="mt-1">
            <DocumentStatusBadge
              status={props.item.processing_status}
              isUploadStale={props.item.is_upload_stale}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            File
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {props.item.original_filename}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Lifecycle Note
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {props.item.lifecycle_note}
          </p>
        </div>
      </div>
    </div>
  );
}

export function StaffDocumentsListScreen(): React.JSX.Element {
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
    setSearchTerm,
    setStatusFilter,
    setPage,
    setPageSize,
    resetFilters,
  } = useDocumentsList({
    autoLoad: true,
  });
  const {
    destructivePending: finalizePending,
    pendingDocumentId: finalizePendingDocumentId,
    error: finalizeError,
    clearError: clearFinalizeError,
    finalize,
  } = useFinalizeDocument();
  const {
    destructivePending: deletePending,
    pendingDocumentId: deletePendingDocumentId,
    error: deleteError,
    clearError: clearDeleteError,
    deleteDocument,
  } = useDeleteDocument();
  const {
    pending: readUrlPending,
    pendingDocumentId: readUrlPendingDocumentId,
    error: readUrlError,
    clearError: clearReadUrlError,
    fetchReadUrl,
  } = useDocumentReadUrl();
  const [activeReadAction, setActiveReadAction] = React.useState<
    "preview" | "download" | null
  >(null);
  const [finalizeTarget, setFinalizeTarget] =
    React.useState<DocumentListItem | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [detailDocumentId, setDetailDocumentId] = React.useState<string | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] =
    React.useState<DeleteDialogTarget | null>(null);

  const openPreview = React.useCallback(
    async (item: DocumentListItem) => {
      clearReadUrlError();
      setActiveReadAction("preview");

      try {
        const readData = await fetchReadUrl(item.id, "inline");

        if (readData) {
          openSignedUrl(readData.signed_read_url);
        }
      } finally {
        setActiveReadAction(null);
      }
    },
    [clearReadUrlError, fetchReadUrl],
  );

  const openDownload = React.useCallback(
    async (item: DocumentListItem) => {
      clearReadUrlError();
      setActiveReadAction("download");

      try {
        const readData = await fetchReadUrl(item.id, "attachment");

        if (readData) {
          downloadSignedUrl(readData.signed_read_url);
        }
      } finally {
        setActiveReadAction(null);
      }
    },
    [clearReadUrlError, fetchReadUrl],
  );

  const openFinalizeDialog = React.useCallback(
    (item: DocumentListItem) => {
      clearFinalizeError();
      setFinalizeTarget(item);
    },
    [clearFinalizeError],
  );
  const openDeleteDialog = React.useCallback(
    (item: DeleteDialogTarget) => {
      clearDeleteError();
      setDeleteTarget(item);
    },
    [clearDeleteError],
  );
  const openDetailDialog = React.useCallback((item: DocumentListItem) => {
    setDetailDocumentId(item.id);
    setDetailOpen(true);
  }, []);

  const handleFinalizeConfirm = React.useCallback(async () => {
    if (!finalizeTarget) {
      return;
    }

    const succeeded = await finalize(finalizeTarget.id);

    if (succeeded) {
      clearFinalizeError();
      setFinalizeTarget(null);
    }
  }, [clearFinalizeError, finalize, finalizeTarget]);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    const succeeded = await deleteDocument(deleteTarget.id);

    if (succeeded) {
      clearDeleteError();
      setDeleteTarget(null);
    }
  }, [clearDeleteError, deleteDocument, deleteTarget]);

  const handleDetailDeleteRequested = React.useCallback(
    (item: DocumentDetailItem) => {
      clearDeleteError();
      setDeleteTarget({
        id: item.id,
        title: item.title,
        original_filename: item.original_filename,
      });
      setDetailOpen(false);
      setDetailDocumentId(null);
    },
    [clearDeleteError],
  );

  return (
    <PageContainer
      eyebrow="Staff Documents"
      title="Document Management"
      description="Review uploaded official documents, indexing progress, and safe preview or download access from the staff directory."
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
              setUploadDialogOpen(true);
            }}
          >
            <FilePlus2 className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      }
    >
      <ScrollReveal direction="up" delayMs={90}>
        <div className="flex flex-1 flex-col gap-6">
          {error && !hasData ? (
            <DocumentListFailureState
              hasStaleData={false}
              message={error}
              onRetry={retry}
            />
          ) : null}

          {loading && !hasData ? (
            <DocumentListLoadingState />
          ) : (
            <>
              {error && hasData ? (
                <DocumentListFailureState
                  hasStaleData={hasStaleData}
                  message={error}
                  onRetry={retry}
                />
              ) : null}

              {readUrlError ? (
                <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
                  <CardContent className="flex items-start gap-3 px-5 py-4 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{readUrlError}</p>
                  </CardContent>
                </Card>
              ) : null}

              {deleteError ? (
                <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
                  <CardContent className="flex items-start gap-3 px-5 py-4 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{deleteError}</p>
                  </CardContent>
                </Card>
              ) : null}

              <StaffDocumentsTable
                loading={status === "loading" && !hasData}
                searchTerm={filters.searchTerm}
                status={filters.status}
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
                onResetFilters={resetFilters}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onView={openDetailDialog}
                onPreview={openPreview}
                onDownload={openDownload}
                onFinalize={openFinalizeDialog}
                onDelete={openDeleteDialog}
                previewPendingDocumentId={
                  readUrlPending && activeReadAction === "preview"
                    ? readUrlPendingDocumentId
                    : null
                }
                downloadPendingDocumentId={
                  readUrlPending && activeReadAction === "download"
                    ? readUrlPendingDocumentId
                    : null
                }
                finalizePendingDocumentId={
                  finalizePending ? finalizePendingDocumentId : null
                }
                deletePendingDocumentId={
                  deletePending ? deletePendingDocumentId : null
                }
              />
            </>
          )}
        </div>
      </ScrollReveal>

      <AlertDialog
        open={Boolean(finalizeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            clearFinalizeError();
            setFinalizeTarget(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl rounded-3xl border-border/70">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="font-display text-2xl font-black tracking-tight">
              {finalizeTarget?.can_retry_finalize
                ? "Retry Document Processing"
                : "Finish Document Setup"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6">
              {finalizeTarget?.can_retry_finalize
                ? "Use this after the earlier issue has been fixed. The app will try to prepare the same file again."
                : "Use this after the file upload has finished. The app will check the file and prepare it for the library."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {finalizeTarget ? (
            <FinalizeContextSummary item={finalizeTarget} />
          ) : null}

          {finalizeError ? (
            <p className="text-sm font-medium text-destructive">
              {finalizeError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              disabled={finalizePending}
              onClick={() => {
                clearFinalizeError();
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-300"
              disabled={finalizePending}
              onClick={(event) => {
                event.preventDefault();
                void handleFinalizeConfirm();
              }}
            >
              {finalizePending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {finalizeTarget?.can_retry_finalize
                    ? "Retrying..."
                    : "Finishing Setup..."}
                </>
              ) : finalizeTarget?.can_retry_finalize ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Retry Processing
                </>
              ) : (
                <>
                  <FilePlus2 className="h-4 w-4" />
                  Finish Setup
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            clearDeleteError();
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl rounded-3xl border-border/70">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="font-display text-2xl font-black tracking-tight">
              Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6">
              Delete this only when staff intends to remove it from the official
              document library and the answer sources that rely on it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteTarget ? (
            <Card className="rounded-2xl border-border/70 bg-muted/35 py-0 shadow-none">
              <CardContent className="px-5 py-4">
                <p className="font-semibold text-foreground">
                  {deleteTarget.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {deleteTarget.original_filename}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  After deletion, this document should no longer be treated as
                  an official source for answers.
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

      <DocumentDetailDialog
        documentId={detailDocumentId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);

          if (!open) {
            setDetailDocumentId(null);
          }
        }}
        onDeleteRequested={handleDetailDeleteRequested}
      />
    </PageContainer>
  );
}
