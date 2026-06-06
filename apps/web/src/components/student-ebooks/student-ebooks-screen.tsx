"use client";

import * as React from "react";
import { PageContainer } from "@/components/app-shell";
import { StudentEBookCard } from "@/components/student-ebooks/student-ebook-card";
import { StudentEBookDetailPanel } from "@/components/student-ebooks/student-ebook-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEBooks } from "@/hooks/useEBooks";

export function StudentEBooksScreen() {
  const ebooks = useEBooks("student");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [format, setFormat] = React.useState("all");
  const [scope, setScope] = React.useState("all");
  const [language, setLanguage] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const values = (key: "category" | "language" | "access_scope") => Array.from(new Set(ebooks.items.map((item) => item[key]))).sort();
  const visible = ebooks.items.filter((item) => `${item.title} ${item.authors} ${item.category} ${item.language} ${item.file?.file_format || ""}`.toLowerCase().includes(search.trim().toLowerCase())
    && (category === "all" || item.category === category)
    && (format === "all" || item.file?.file_format === format)
    && (scope === "all" || item.access_scope === scope)
    && (language === "all" || item.language === language));
  const selected = ebooks.items.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  return <PageContainer title="E-Books" eyebrow="Digital Reading" description="Read or download published E-Books available to your account.">
    <div className="space-y-4"><div className="grid gap-3 md:grid-cols-5"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search E-Books" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{values("category").map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={format} onChange={(event) => setFormat(event.target.value)}><option value="all">All formats</option><option value="pdf">PDF</option><option value="epub">EPUB</option></select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">All scopes</option>{values("access_scope").map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="all">All languages</option>{values("language").map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
      {ebooks.loading ? <p className="text-sm text-muted-foreground">Loading E-Books...</p> : null}
      {ebooks.error ? <div className="flex items-center justify-between rounded-xl border p-5"><span>{ebooks.error}</span><Button variant="outline" onClick={() => void ebooks.refresh()}>Retry</Button></div> : null}
      {!ebooks.loading && !ebooks.error && visible.length === 0 ? <p className="rounded-xl border p-6 text-sm text-muted-foreground">{ebooks.items.length === 0 ? "No E-Books are available to your account." : "No E-Books match the current search."}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]"><div className="grid gap-3 sm:grid-cols-2">{visible.map((item) => <StudentEBookCard key={item.id} ebook={item} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />)}</div><StudentEBookDetailPanel ebook={selected} onAccess={(type) => { if (selected) void ebooks.access(selected.id, type); }} /></div>
    </div>
  </PageContainer>;
}
