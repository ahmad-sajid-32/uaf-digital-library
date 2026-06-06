"use client";

import * as React from "react";
import { AlertCircle, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EBookCoverUploadField({ hasCover, onUpload, onRemove }: { hasCover: boolean; onUpload: (file: File, alt?: string) => Promise<boolean>; onRemove: () => Promise<boolean> }) {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [alt, setAlt] = React.useState("");
  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => { setFile(null); setAlt(""); setError(null); };
  const upload = async () => {
    if (!file) return;
    setError(null);
    if (file.size <= 0 || file.size > 2 * 1024 * 1024) return setError("Choose a cover image that is 2 MB or smaller.");
    setBusy("upload");
    try {
      if (await onUpload(file, alt || undefined)) { setOpen(false); reset(); }
    } finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy("remove");
    try {
      if (await onRemove()) { setOpen(false); reset(); }
    } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); if (!value) reset(); } }}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="size-9 rounded-xl px-0 sm:h-8 sm:w-auto sm:px-3" aria-label="Manage E-Book cover" title="Manage E-Book cover"><ImagePlus className="h-4 w-4" /><span className="hidden sm:inline">Cover</span></Button></DialogTrigger>
      <DialogContent className="rounded-3xl border-border/70 sm:max-w-4xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><ImagePlus className="h-5 w-5" /></div>
          <DialogTitle className="font-display text-2xl font-black tracking-tight">Manage E-Book Cover</DialogTitle>
          <DialogDescription>Upload a reader-facing cover image or remove the current cover.</DialogDescription>
        </DialogHeader>
        <Card className="rounded-3xl border-border/60 py-0 shadow-none">
          <CardContent className="grid gap-4 px-5 py-5">
            <FileUploadField id="ebook-cover-file" label="Cover image" file={file} accept="image/jpeg,image/png,image/webp" disabled={busy !== null} helperText="JPG, PNG, or WEBP. Maximum size: 2 MB." onFileChange={(value) => { setError(null); setFile(value); }} />
            <div className="grid gap-2"><Label htmlFor="ebook-cover-alt">Alternative text</Label><Input id="ebook-cover-alt" value={alt} disabled={busy !== null} onChange={(event) => setAlt(event.target.value)} placeholder="Describe the cover for assistive technology" /></div>
          </CardContent>
        </Card>
        {error ? <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div> : null}
        <DialogFooter>
          {hasCover ? <Button className="rounded-xl" variant="destructive" disabled={busy !== null} onClick={() => void remove()}>{busy === "remove" ? <><LoaderCircle className="h-4 w-4 animate-spin" />Removing...</> : <><Trash2 className="h-4 w-4" />Remove cover</>}</Button> : null}
          <Button className="rounded-xl" disabled={busy !== null || !file} onClick={() => void upload()}>{busy === "upload" ? <><LoaderCircle className="h-4 w-4 animate-spin" />Uploading...</> : <><ImagePlus className="h-4 w-4" />Upload cover</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
