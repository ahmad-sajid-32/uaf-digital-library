"use client";

import * as React from "react";
import {
  AlertCircle,
  BookOpen,
  FilterX,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { StudentEBookCard } from "@/components/student-ebooks/student-ebook-card";
import { StudentEBookDetailPanel } from "@/components/student-ebooks/student-ebook-detail-panel";
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
import { useEBooks } from "@/hooks/useEBooks";
import { labelToken } from "@/lib/ebooks";

const PAGE_SIZE_OPTIONS = [6, 12, 24] as const;

function FilterSelect({
  value,
  values,
  onChange,
}: {
  value: string;
  values: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background">
        <SelectValue />
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

export function StudentEBooksScreen() {
  const ebooks = useEBooks("student");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [format, setFormat] = React.useState("all");
  const [scope, setScope] = React.useState("all");
  const [language, setLanguage] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(6);

  const values = React.useCallback(
    (key: "category" | "language" | "access_scope") =>
      Array.from(new Set(ebooks.items.map((item) => item[key]))).sort(),
    [ebooks.items],
  );
  const filtersApplied = Boolean(
    search.trim() ||
    category !== "all" ||
    format !== "all" ||
    scope !== "all" ||
    language !== "all",
  );
  const filtered = ebooks.items.filter(
    (item) =>
      `${item.title} ${item.authors} ${item.category} ${item.language} ${item.file?.file_format || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (category === "all" || item.category === category) &&
      (format === "all" || item.file?.file_format === format) &&
      (scope === "all" || item.access_scope === scope) &&
      (language === "all" || item.language === language),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const selected =
    ebooks.items.find((item) => item.id === selectedId) ?? visible[0] ?? null;

  React.useEffect(() => {
    setPage(1);
  }, [search, category, format, scope, language, pageSize]);
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  React.useEffect(() => {
    if (selectedId && !filtered.some((item) => item.id === selectedId))
      setSelectedId(null);
  }, [filtered, selectedId]);

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setFormat("all");
    setScope("all");
    setLanguage("all");
    setPage(1);
  };

  return (
    <PageContainer
      title="E-Books"
      eyebrow="Digital Reading"
      description="Browse published E-Books available to your account, then read online or download when allowed."
    >
      <ScrollReveal>
        {ebooks.loading && ebooks.items.length === 0 ? (
          <div className="grid gap-4">
            <Skeleton className="h-20 rounded-3xl" />
            <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
              <Skeleton className="h-140 rounded-3xl" />
              <Skeleton className="h-140 rounded-3xl" />
            </div>
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
                  Unable to load the E-Book catalog.
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
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
              <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="font-display text-2xl font-black tracking-tight">
                        Digital Catalog
                      </CardTitle>
                      <Badge variant="outline" className="rounded-full">
                        {filtered.length} available
                      </Badge>
                    </div>
                    <CardDescription className="px-0 leading-6">
                      Select a cover card to view details and available reading
                      actions.
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
                      placeholder="Search by title, author, category, language, or format"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <FilterSelect
                      value={category}
                      onChange={setCategory}
                      values={[
                        { value: "all", label: "All categories" },
                        ...values("category").map((value) => ({
                          value,
                          label: labelToken(value),
                        })),
                      ]}
                    />
                    <FilterSelect
                      value={format}
                      onChange={setFormat}
                      values={[
                        { value: "all", label: "All formats" },
                        { value: "pdf", label: "PDF" },
                        { value: "epub", label: "EPUB" },
                      ]}
                    />
                    <FilterSelect
                      value={scope}
                      onChange={setScope}
                      values={[
                        { value: "all", label: "All access scopes" },
                        ...values("access_scope").map((value) => ({
                          value,
                          label: labelToken(value),
                        })),
                      ]}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-3 py-4 sm:px-4">
                {ebooks.error ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    {ebooks.error}
                  </div>
                ) : null}
                {visible.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/35 px-5 py-12 text-center">
                    <BookOpen className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-4 text-lg font-black">
                      {ebooks.items.length === 0
                        ? "No E-Books are available to your account."
                        : "No E-Books match the current filters."}
                    </p>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      {ebooks.items.length === 0
                        ? "Published E-Books will appear here when they become available."
                        : "Change or clear the filters to find another E-Book."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visible.map((item) => (
                      <StudentEBookCard
                        key={item.id}
                        ebook={item}
                        selected={selected?.id === item.id}
                        onSelect={() => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                )}
                {visible.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/75 px-4 py-4">
                    <RowsControl
                      value={pageSize}
                      options={PAGE_SIZE_OPTIONS}
                      onValueChange={setPageSize}
                      label="Books"
                    />
                    <PaginationControl
                      page={currentPage}
                      totalPages={totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <StudentEBookDetailPanel
              ebook={selected}
              onAccess={(type) => {
                if (selected) void ebooks.access(selected.id, type);
              }}
              previewPending={Boolean(
                selected && ebooks.isPending("preview", selected.id),
              )}
              downloadPending={Boolean(
                selected && ebooks.isPending("download", selected.id),
              )}
            />
          </div>
        )}
      </ScrollReveal>
    </PageContainer>
  );
}
