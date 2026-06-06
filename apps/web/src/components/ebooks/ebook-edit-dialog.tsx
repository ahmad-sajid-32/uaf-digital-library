"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { UpdateInput } from "@/lib/api/ebooks";
import { labelToken, type EBook, type EBookAccessScope } from "@/lib/ebooks";

export function EBookEditDialog({ ebook, onSave }: { ebook: EBook; onSave: (value: UpdateInput) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState(ebook.title);
  const [authors, setAuthors] = React.useState(ebook.authors);
  const [description, setDescription] = React.useState(ebook.description || "");
  const [scope, setScope] = React.useState<EBookAccessScope>(ebook.access_scope);
  const [allowPreview, setAllowPreview] = React.useState(ebook.allow_preview);
  const [allowDownload, setAllowDownload] = React.useState(ebook.allow_download);
  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        title, authors, description: description || null, subtitle: ebook.subtitle, isbn: ebook.isbn,
        publisher: ebook.publisher, publication_year: ebook.publication_year, edition: ebook.edition,
        language: ebook.language, category: ebook.category, keywords: ebook.keywords,
        linked_book_id: ebook.linked_book_id, access_scope: scope,
        allow_preview: allowPreview, allow_download: allowDownload,
      });
      setOpen(false);
    } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Edit</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Edit E-Book Metadata</DialogTitle></DialogHeader><div className="grid gap-3"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" /><Input value={authors} onChange={(event) => setAuthors(event.target.value)} placeholder="Authors" /><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={scope} onChange={(event) => setScope(event.target.value as EBookAccessScope)}>{["all_authenticated", "students_only", "staff_only"].map((value) => <option key={value} value={value}>{labelToken(value)}</option>)}</select><label className="flex gap-2 text-sm"><input type="checkbox" checked={allowPreview} onChange={(event) => setAllowPreview(event.target.checked)} />Allow preview</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} />Allow download</label></div><DialogFooter><Button disabled={busy || !title.trim() || !authors.trim() || (!allowPreview && !allowDownload)} onClick={() => void save()}>{busy ? "Saving..." : "Save"}</Button></DialogFooter></DialogContent></Dialog>;
}
