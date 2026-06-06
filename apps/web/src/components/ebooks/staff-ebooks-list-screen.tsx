"use client";

import * as React from "react";
import {
  AlertCircle,
  Archive,
  BookOpen,
  Download,
  FileCheck2,
  FilterX,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { EBookAccessEventsDialog } from "@/components/ebooks/ebook-access-events-dialog";
import { EBookAccessScopeBadge } from "@/components/ebooks/ebook-access-scope-badge";
import { EBookCoverImage } from "@/components/ebooks/ebook-cover-image";
import { EBookCoverUploadField } from "@/components/ebooks/ebook-cover-upload-field";
import { EBookDetailDialog } from "@/components/ebooks/ebook-detail-dialog";
import { EBookEditDialog } from "@/components/ebooks/ebook-edit-dialog";
import { EBookStatusBadge } from "@/components/ebooks/ebook-status-badge";
import { EBookUploadDialog } from "@/components/ebooks/ebook-upload-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEBooks, type EBookPendingAction } from "@/hooks/useEBooks";
import { useAppAuth } from "@/hooks/useAppAuth";
import { labelToken, type EBook } from "@/lib/ebooks";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function ActionButton({
  label,
  icon: Icon,
  loading = false,
  disabled = false,
  destructive = false,
  title,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled || loading}
      className={
        destructive
          ? "size-9 rounded-xl border-destructive/20 bg-destructive/5 px-0 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:w-auto sm:px-3"
          : "size-9 rounded-xl px-0 sm:h-8 sm:w-auto sm:px-3"
      }
      aria-label={
        disabled
          ? `${label} E-Book action is not available`
          : `${label} E-Book action`
      }
      title={title ?? `${label} E-Book action`}
      onClick={onClick}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {loading ? `${label}...` : label}
      </span>
    </Button>
  );
}

function SelectFilter({
  value,
  placeholder,
  values,
  onChange,
}: {
  value: string;
  placeholder: string;
  values: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {values.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StaffEBooksListScreen() {
  const ebooks = useEBooks("staff");
  const { auth } = useAppAuth();
  const isAdmin = auth.status === "authenticated" && auth.role === "admin";
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [format, setFormat] = React.useState("all");
  const [scope, setScope] = React.useState("all");
  const [language, setLanguage] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [archiveTarget, setArchiveTarget] = React.useState<EBook | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<EBook | null>(null);

  const values = React.useCallback(
    (key: "category" | "language") =>
      Array.from(new Set(ebooks.items.map((item) => item[key]))).sort(),
    [ebooks.items],
  );
  const filtersApplied = Boolean(
    search.trim() ||
    status !== "all" ||
    category !== "all" ||
    format !== "all" ||
    scope !== "all" ||
    language !== "all",
  );
  const filtered = ebooks.items.filter((item) => {
    const matchesSearch =
      `${item.title} ${item.authors} ${item.isbn || ""} ${item.publisher || ""} ${item.category} ${item.language}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    return (
      matchesSearch &&
      (status === "all" || item.status === status) &&
      (category === "all" || item.category === category) &&
      (format === "all" || item.file?.file_format === format) &&
      (scope === "all" || item.access_scope === scope) &&
      (language === "all" || item.language === language)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const pendingFor = (action: EBookPendingAction, id: string) =>
    ebooks.isPending(action, id);
  const anyMutationPending = ebooks.pendingAction !== null;

  React.useEffect(() => {
    setPage(1);
  }, [search, status, category, format, scope, language, pageSize]);
  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
    setFormat("all");
    setScope("all");
    setLanguage("all");
    setPage(1);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    if (await ebooks.archive(archiveTarget.id)) setArchiveTarget(null);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (await ebooks.remove(deleteTarget.id)) setDeleteTarget(null);
  };

  return (
    <PageContainer
      title="E-Books"
      eyebrow="Digital Reading"
      description="Manage free private-file E-Books and review reader access activity."
      actions={<EBookUploadDialog onUpload={ebooks.upload} />}
    >
      <ScrollReveal>
        {ebooks.loading && ebooks.items.length === 0 ? (
          <div className="grid gap-4">
            <Skeleton className="h-20 rounded-3xl" />
            <Skeleton className="h-120 rounded-3xl" />
          </div>
        ) : ebooks.error && ebooks.items.length === 0 ? (
          <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
            <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                    Retry Required
                  </p>
                </div>
                <p className="text-lg font-black">
                  Unable to load the E-Book directory.
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {ebooks.error}
                </p>
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => void ebooks.refresh()}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
            <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-display text-2xl font-black tracking-tight">
                      E-Book Directory
                    </CardTitle>
                    <Badge variant="outline" className="rounded-full">
                      {filtered.length} shown
                    </Badge>
                  </div>
                  <CardDescription className="px-0 text-sm leading-6">
                    Review files, publication state, access rules, covers, and
                    reader activity.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ebooks.loading ? (
                    <Badge variant="outline" className="gap-2 rounded-full">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      Refreshing
                    </Badge>
                  ) : null}
                  {filtersApplied ? (
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={resetFilters}
                    >
                      <FilterX className="h-4 w-4" />
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 rounded-xl border-border/70 bg-background pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by title, author, ISBN, publisher, category, or language"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SelectFilter
                    value={status}
                    placeholder="Status"
                    onChange={setStatus}
                    values={[
                      { value: "all", label: "All statuses" },
                      ...["draft", "published", "archived"].map((value) => ({
                        value,
                        label: labelToken(value),
                      })),
                    ]}
                  />
                  <SelectFilter
                    value={category}
                    placeholder="Category"
                    onChange={setCategory}
                    values={[
                      { value: "all", label: "All categories" },
                      ...values("category").map((value) => ({
                        value,
                        label: labelToken(value),
                      })),
                    ]}
                  />
                  <SelectFilter
                    value={format}
                    placeholder="Format"
                    onChange={setFormat}
                    values={[
                      { value: "all", label: "All formats" },
                      { value: "pdf", label: "PDF" },
                      { value: "epub", label: "EPUB" },
                    ]}
                  />
                  <SelectFilter
                    value={scope}
                    placeholder="Scope"
                    onChange={setScope}
                    values={[
                      { value: "all", label: "All access scopes" },
                      ...[
                        "all_authenticated",
                        "students_only",
                        "staff_only",
                      ].map((value) => ({ value, label: labelToken(value) })),
                    ]}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 px-0 py-0">
              {ebooks.error ? (
                <div className="mx-4 mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {ebooks.error}
                </div>
              ) : null}
              {visible.length === 0 ? (
                <div className="m-4 rounded-3xl border border-dashed border-border/70 bg-muted/35 px-5 py-12 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-4 text-lg font-black">
                    {ebooks.items.length === 0
                      ? "No E-Books exist yet."
                      : "No E-Books match the current filters."}
                  </p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {ebooks.items.length === 0
                      ? "Create the first E-Book to begin the digital reading directory."
                      : "Change or clear the search and filters to find another E-Book."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">E-Book</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Access</TableHead>
                        <TableHead className="min-w-[36rem] text-right pr-6">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="pl-6">
                            <div className="flex min-w-0 items-center gap-3">
                              <EBookCoverImage
                                ebook={item}
                                variant="thumbnail"
                              />
                              <div className="min-w-0 space-y-1">
                                <p className="truncate font-semibold">
                                  {item.title}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                  {item.authors}
                                </p>
                                <p className="text-xs font-medium text-muted-foreground">
                                  {labelToken(item.category)} | {item.language}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <EBookStatusBadge status={item.status} />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <p className="font-semibold">
                                {item.file?.file_format.toUpperCase() ||
                                  "No file"}
                              </p>
                              <p className="text-muted-foreground">
                                {item.file
                                  ? labelToken(item.file.file_status)
                                  : "Upload required"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <EBookAccessScopeBadge
                                scope={item.access_scope}
                              />
                              <p className="text-xs text-muted-foreground">
                                {item.allow_preview ? "Preview" : "No preview"}{" "}
                                |{" "}
                                {item.allow_download
                                  ? "Download"
                                  : "No download"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="pr-6">
                            <div className="flex  justify-end gap-2">
                              <EBookDetailDialog ebook={item} />
                              <EBookEditDialog
                                ebook={item}
                                onSave={(value) =>
                                  ebooks.update(item.id, value)
                                }
                              />
                              <EBookCoverUploadField
                                hasCover={Boolean(item.cover_image_url)}
                                onUpload={(file, alt) =>
                                  ebooks.setCover(item.id, file, alt)
                                }
                                onRemove={() => ebooks.clearCover(item.id)}
                              />
                              {item.file?.file_status !== "ready" ? (
                                <ActionButton
                                  label="Finalize"
                                  icon={FileCheck2}
                                  loading={pendingFor("finalize", item.id)}
                                  disabled={anyMutationPending}
                                  onClick={() => void ebooks.finalize(item.id)}
                                />
                              ) : null}
                              {item.status !== "published" &&
                              item.file?.file_status === "ready" ? (
                                <ActionButton
                                  label="Publish"
                                  icon={Send}
                                  loading={pendingFor("publish", item.id)}
                                  disabled={anyMutationPending}
                                  onClick={() => void ebooks.publish(item.id)}
                                />
                              ) : null}
                              {item.status === "published" ? (
                                <ActionButton
                                  label="Archive"
                                  icon={Archive}
                                  loading={pendingFor("archive", item.id)}
                                  disabled={anyMutationPending}
                                  onClick={() => setArchiveTarget(item)}
                                />
                              ) : null}
                              {item.file?.file_status === "ready" ? (
                                <>
                                  <ActionButton
                                    label="Preview"
                                    icon={BookOpen}
                                    loading={pendingFor("preview", item.id)}
                                    disabled={anyMutationPending}
                                    onClick={() =>
                                      void ebooks.access(item.id, "preview")
                                    }
                                  />
                                  <ActionButton
                                    label="Download"
                                    icon={Download}
                                    loading={pendingFor("download", item.id)}
                                    disabled={anyMutationPending}
                                    onClick={() =>
                                      void ebooks.access(item.id, "download")
                                    }
                                  />
                                </>
                              ) : null}
                              <EBookAccessEventsDialog ebookId={item.id} />
                              <ActionButton
                                label="Delete"
                                icon={Trash2}
                                destructive
                                loading={pendingFor("remove", item.id)}
                                disabled={
                                  anyMutationPending ||
                                  (!isAdmin && item.status !== "draft")
                                }
                                title={
                                  isAdmin || item.status === "draft"
                                    ? "Delete this E-Book"
                                    : "Only administrators can delete published or archived E-Books"
                                }
                                onClick={() => setDeleteTarget(item)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {visible.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-4">
                  <RowsControl
                    value={pageSize}
                    options={PAGE_SIZE_OPTIONS}
                    onValueChange={setPageSize}
                  />
                  <PaginationControl
                    page={currentPage}
                    totalPages={pageCount}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </ScrollReveal>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pendingFor("archive", archiveTarget?.id || ""))
            setArchiveTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl border-border/70 sm:max-w-3xl">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="font-display text-2xl font-black tracking-tight">
              Archive E-Book
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              Archiving removes this E-Book from student discovery and blocks
              new student access until it is published again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveTarget ? (
            <Card className="rounded-2xl border-border/70 bg-muted/35 py-0 shadow-none">
              <CardContent className="flex items-center gap-4 px-5 py-4">
                <EBookCoverImage ebook={archiveTarget} variant="compact" />
                <div>
                  <p className="font-semibold">{archiveTarget.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {archiveTarget.authors}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              disabled={Boolean(
                archiveTarget && pendingFor("archive", archiveTarget.id),
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={Boolean(
                archiveTarget && pendingFor("archive", archiveTarget.id),
              )}
              onClick={(event) => {
                event.preventDefault();
                void confirmArchive();
              }}
            >
              {archiveTarget && pendingFor("archive", archiveTarget.id) ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Confirm archive
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pendingFor("remove", deleteTarget?.id || ""))
            setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl border-border/70 sm:max-w-3xl">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="font-display text-2xl font-black tracking-tight">
              Delete E-Book
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              This permanently deletes the E-Book record, private file, and
              public cover. Deletion is blocked when access history exists and
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget ? (
            <Card className="rounded-2xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
              <CardContent className="flex items-center gap-4 px-5 py-4">
                <EBookCoverImage ebook={deleteTarget} variant="compact" />
                <div>
                  <p className="font-semibold">{deleteTarget.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {deleteTarget.authors}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              disabled={Boolean(
                deleteTarget && pendingFor("remove", deleteTarget.id),
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
              disabled={Boolean(
                deleteTarget && pendingFor("remove", deleteTarget.id),
              )}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteTarget && pendingFor("remove", deleteTarget.id) ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Confirm delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
