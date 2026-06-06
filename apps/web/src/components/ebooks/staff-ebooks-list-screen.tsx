"use client";

import * as React from "react";
import { PageContainer } from "@/components/app-shell";
import { EBookAccessEventsDialog } from "@/components/ebooks/ebook-access-events-dialog";
import { EBookAccessScopeBadge } from "@/components/ebooks/ebook-access-scope-badge";
import { EBookCoverUploadField } from "@/components/ebooks/ebook-cover-upload-field";
import { EBookDetailDialog } from "@/components/ebooks/ebook-detail-dialog";
import { EBookEditDialog } from "@/components/ebooks/ebook-edit-dialog";
import { EBookStatusBadge } from "@/components/ebooks/ebook-status-badge";
import { EBookUploadDialog } from "@/components/ebooks/ebook-upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEBooks } from "@/hooks/useEBooks";
import { labelToken } from "@/lib/ebooks";

const PAGE_SIZE = 10;

export function StaffEBooksListScreen() {
  const ebooks = useEBooks("staff");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [format, setFormat] = React.useState("all");
  const [scope, setScope] = React.useState("all");
  const [language, setLanguage] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const options = (key: "category" | "language") => Array.from(new Set(ebooks.items.map((item) => item[key]))).sort();
  const filtered = ebooks.items.filter((item) => {
    const matchesSearch = `${item.title} ${item.authors} ${item.isbn || ""} ${item.publisher || ""} ${item.category} ${item.language}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch
      && (status === "all" || item.status === status)
      && (category === "all" || item.category === category)
      && (format === "all" || item.file?.file_format === format)
      && (scope === "all" || item.access_scope === scope)
      && (language === "all" || item.language === language);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE);
  const selectClass = "h-10 rounded-md border bg-background px-3 text-sm";

  return (
    <PageContainer title="E-Books" eyebrow="Digital Reading" description="Manage free private-file E-Books and review access activity." actions={<EBookUploadDialog onUpload={ebooks.upload} />}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search E-Books" />
          <select className={selectClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option>{["draft", "published", "archived"].map((value) => <option key={value} value={value}>{labelToken(value)}</option>)}</select>
          <select className={selectClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="all">All categories</option>{options("category").map((value) => <option key={value} value={value}>{labelToken(value)}</option>)}</select>
          <select className={selectClass} value={format} onChange={(event) => { setFormat(event.target.value); setPage(1); }}><option value="all">All formats</option>{["pdf", "epub"].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select>
          <select className={selectClass} value={scope} onChange={(event) => { setScope(event.target.value); setPage(1); }}><option value="all">All scopes</option>{["all_authenticated", "students_only", "staff_only"].map((value) => <option key={value} value={value}>{labelToken(value)}</option>)}</select>
          <select className={selectClass} value={language} onChange={(event) => { setLanguage(event.target.value); setPage(1); }}><option value="all">All languages</option>{options("language").map((value) => <option key={value} value={value}>{value}</option>)}</select>
        </div>
        {ebooks.loading ? <p className="text-sm text-muted-foreground">Loading E-Books...</p> : null}
        {ebooks.error ? <Card><CardContent className="flex items-center justify-between p-6"><span>{ebooks.error}</span><Button variant="outline" onClick={() => void ebooks.refresh()}>Retry</Button></CardContent></Card> : null}
        {!ebooks.loading && !ebooks.error && filtered.length === 0 ? <p className="rounded-xl border p-6 text-sm text-muted-foreground">{ebooks.items.length === 0 ? "No E-Books exist yet." : "No E-Books match the current filters."}</p> : null}
        {visible.length > 0 ? <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>E-Book</TableHead><TableHead>Status</TableHead><TableHead>File</TableHead><TableHead>Scope</TableHead><TableHead className="min-w-96">Actions</TableHead></TableRow></TableHeader><TableBody>
          {visible.map((item) => <TableRow key={item.id}><TableCell><div className="font-semibold">{item.title}</div><div className="text-xs text-muted-foreground">{item.authors} | {labelToken(item.category)} | {item.language}</div></TableCell><TableCell><EBookStatusBadge status={item.status} /></TableCell><TableCell>{item.file ? `${item.file.file_format.toUpperCase()} | ${labelToken(item.file.file_status)}` : "No file"}</TableCell><TableCell><EBookAccessScopeBadge scope={item.access_scope} /></TableCell><TableCell><div className="flex flex-wrap gap-2">
            <EBookDetailDialog ebook={item} /><EBookEditDialog ebook={item} onSave={(value) => ebooks.update(item.id, value)} /><EBookCoverUploadField hasCover={Boolean(item.cover_image_url)} onUpload={(file, alt) => ebooks.setCover(item.id, file, alt)} onRemove={() => ebooks.clearCover(item.id)} />
            {item.file?.file_status !== "ready" ? <Button size="sm" variant="outline" onClick={() => void ebooks.finalize(item.id)}>Finalize / Retry</Button> : null}
            {item.status !== "published" && item.file?.file_status === "ready" ? <Button size="sm" onClick={() => void ebooks.publish(item.id)}>Publish</Button> : null}
            {item.status === "published" ? <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Archive this E-Book? Students will lose access.")) void ebooks.archive(item.id); }}>Archive</Button> : null}
            {item.file?.file_status === "ready" ? <><Button size="sm" variant="outline" onClick={() => void ebooks.access(item.id, "preview")}>Preview</Button><Button size="sm" variant="outline" onClick={() => void ebooks.access(item.id, "download")}>Download</Button></> : null}
            <EBookAccessEventsDialog ebookId={item.id} />
            {item.status === "draft" ? <Button size="sm" variant="destructive" onClick={() => { if (window.confirm("Delete this draft and its private file? This cannot be undone.")) void ebooks.remove(item.id); }}>Delete Draft</Button> : null}
          </div></TableCell></TableRow>)}
        </TableBody></Table></div> : null}
        {filtered.length > PAGE_SIZE ? <div className="flex items-center justify-between text-sm"><span>Page {Math.min(page, pageCount)} of {pageCount}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div> : null}
      </div>
    </PageContainer>
  );
}
