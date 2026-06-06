"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EBOOK_CATEGORIES, labelToken, type EBookCategory, type EBookFormat } from "@/lib/ebooks";
import type { UploadInput } from "@/lib/api/ebooks";

export function EBookUploadDialog({ onUpload }: { onUpload: (input: UploadInput) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [authors, setAuthors] = React.useState("");
  const [category, setCategory] = React.useState<EBookCategory>("other");
  const [file, setFile] = React.useState<File | null>(null);

  const submit = async () => {
    if (!file) return;
    const extension = file.name.toLowerCase().endsWith(".epub") ? "epub" : "pdf";
    setBusy(true);
    try {
      await onUpload({ title, authors, category, file, fileFormat: extension as EBookFormat });
      setOpen(false); setTitle(""); setAuthors(""); setFile(null);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Add E-Book</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload E-Book</DialogTitle><DialogDescription>Create a draft and validate one PDF or EPUB file.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <Input value={authors} onChange={(event) => setAuthors(event.target.value)} placeholder="Authors" />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as EBookCategory)}>
            {EBOOK_CATEGORIES.map((item) => <option key={item} value={item}>{labelToken(item)}</option>)}
          </select>
          <Input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </div>
        <DialogFooter><Button disabled={busy || !title.trim() || !authors.trim() || !file} onClick={() => void submit()}>{busy ? "Uploading and validating..." : "Upload E-Book"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
