"use client";

import * as React from "react";
import {
  BookOpen,
  Download,
  LoaderCircle,
  Save,
  ShieldCheck,
  SquarePen,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UpdateInput } from "@/lib/api/ebooks";
import { labelToken, type EBook, type EBookAccessScope } from "@/lib/ebooks";

export function EBookEditDialog({
  ebook,
  onSave,
}: {
  ebook: EBook;
  onSave: (value: UpdateInput) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState(ebook.title);
  const [authors, setAuthors] = React.useState(ebook.authors);
  const [description, setDescription] = React.useState(ebook.description || "");
  const [scope, setScope] = React.useState<EBookAccessScope>(
    ebook.access_scope,
  );
  const [allowPreview, setAllowPreview] = React.useState(ebook.allow_preview);
  const [allowDownload, setAllowDownload] = React.useState(
    ebook.allow_download,
  );

  const save = async () => {
    setBusy(true);
    try {
      const succeeded = await onSave({
        title,
        authors,
        description: description || null,
        subtitle: ebook.subtitle,
        isbn: ebook.isbn,
        publisher: ebook.publisher,
        publication_year: ebook.publication_year,
        edition: ebook.edition,
        language: ebook.language,
        category: ebook.category,
        keywords: ebook.keywords,
        linked_book_id: ebook.linked_book_id,
        access_scope: scope,
        allow_preview: allowPreview,
        allow_download: allowDownload,
      });
      if (succeeded) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="size-9 rounded-xl px-0 sm:h-8 sm:w-auto sm:px-3"
          aria-label="Edit E-Book metadata"
          title="Edit E-Book metadata"
        >
          <SquarePen className="h-4 w-4" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border/70 sm:max-w-4xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
            <SquarePen className="h-5 w-5" />
          </div>
          <DialogTitle className="font-display text-2xl font-black tracking-tight">
            Edit E-Book Metadata
          </DialogTitle>
          <DialogDescription>
            Update the reader-facing identity and access settings for this
            E-Book.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Card className="rounded-3xl border-border/60 py-0 shadow-none">
            <CardContent className="grid gap-4 px-5 py-5">
              <div className="flex items-center gap-2 font-semibold">
                <BookOpen className="h-5 w-5 text-primary" />
                Reader-facing details
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`ebook-title-${ebook.id}`}>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  Title
                </Label>
                <Input
                  id={`ebook-title-${ebook.id}`}
                  value={title}
                  disabled={busy}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`ebook-authors-${ebook.id}`}>
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  Authors
                </Label>
                <Input
                  id={`ebook-authors-${ebook.id}`}
                  value={authors}
                  disabled={busy}
                  onChange={(event) => setAuthors(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`ebook-description-${ebook.id}`}>
                  Description
                </Label>
                <Textarea
                  id={`ebook-description-${ebook.id}`}
                  className="min-h-28"
                  value={description}
                  disabled={busy}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 py-0 shadow-none">
            <CardContent className="grid gap-4 px-5 py-5">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Access controls
              </div>
              <div className="grid gap-2">
                <Label>Reader scope</Label>
                <Select
                  value={scope}
                  disabled={busy}
                  onValueChange={(value) => setScope(value as EBookAccessScope)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["all_authenticated", "students_only", "staff_only"].map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {labelToken(value)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4">
                <Checkbox
                  checked={allowPreview}
                  disabled={busy}
                  onCheckedChange={(value) => setAllowPreview(value === true)}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Allow online preview
                  </span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    Authorized readers can open a short-lived reading link.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4">
                <Checkbox
                  checked={allowDownload}
                  disabled={busy}
                  onCheckedChange={(value) => setAllowDownload(value === true)}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Download className="h-4 w-4 text-primary" />
                    Allow download
                  </span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    Authorized readers can request a short-lived download link.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            className="rounded-xl"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={
              busy ||
              !title.trim() ||
              !authors.trim() ||
              (!allowPreview && !allowDownload)
            }
            onClick={() => void save()}
          >
            {busy ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving changes...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
