"use client";

import * as React from "react";
import {
  AlertCircle,
  BookOpen,
  BookPlus,
  FileText,
  ImagePlus,
  Library,
  LoaderCircle,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UploadInput } from "@/lib/api/ebooks";
import {
  EBOOK_CATEGORIES,
  labelToken,
  type EBookCategory,
  type EBookFormat,
} from "@/lib/ebooks";

const EBOOK_ACCEPT = ".pdf,.epub,application/pdf,application/epub+zip";
const COVER_ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_EBOOK_SIZE = 50 * 1024 * 1024;
const MAX_COVER_SIZE = 2 * 1024 * 1024;

function extension(filename: string): string {
  return filename.split(".").at(-1)?.toLowerCase() ?? "";
}

export function EBookUploadDialog({
  onUpload,
}: {
  onUpload: (input: UploadInput) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [authors, setAuthors] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<EBookCategory>("other");
  const [file, setFile] = React.useState<File | null>(null);
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverAltText, setCoverAltText] = React.useState("");

  const reset = () => {
    setTitle("");
    setAuthors("");
    setDescription("");
    setCategory("other");
    setFile(null);
    setCoverFile(null);
    setCoverAltText("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!file) return setError("Choose a PDF or EPUB file before continuing.");
    const fileExtension = extension(file.name);
    if (!["pdf", "epub"].includes(fileExtension))
      return setError("Choose a PDF or EPUB file.");
    if (file.size <= 0 || file.size > MAX_EBOOK_SIZE)
      return setError("Choose an E-Book file between 1 byte and 50 MB.");
    if (
      coverFile &&
      (!["jpg", "jpeg", "png", "webp"].includes(extension(coverFile.name)) ||
        coverFile.size <= 0 ||
        coverFile.size > MAX_COVER_SIZE)
    ) {
      return setError(
        "Choose a JPG, PNG, or WEBP cover that is 2 MB or smaller.",
      );
    }
    setBusy(true);
    try {
      const succeeded = await onUpload({
        title,
        authors,
        description: description.trim() || null,
        category,
        file,
        fileFormat: fileExtension as EBookFormat,
        coverFile,
        coverAltText: coverAltText.trim() || null,
      });
      if (succeeded) {
        setOpen(false);
        reset();
      } else {
        setError(
          "The E-Book could not be created. Review the message shown and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          if (!value) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <BookPlus className="h-4 w-4" />
          Add E-Book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94vh] overflow-y-auto rounded-3xl border-border/70 sm:max-w-5xl">
        <DialogHeader className="space-y-3 border-b border-border/60 pb-5 text-left">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <BookPlus className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                Create E-Book
              </DialogTitle>
              <DialogDescription className="max-w-3xl leading-6">
                Add the catalog information and optional cover first, then
                attach the PDF or EPUB file that readers will access.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="grid gap-5">
          <Card className="rounded-3xl border-border/60 py-0 shadow-none">
            <CardContent className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <Library className="h-5 w-5 text-primary" />
                  Catalog details
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  This information appears in the staff directory and student
                  digital catalog.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ebook-upload-title">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    Title
                  </Label>
                  <Input
                    id="ebook-upload-title"
                    value={title}
                    disabled={busy}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="E-Book title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ebook-upload-authors">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    Authors
                  </Label>
                  <Input
                    id="ebook-upload-authors"
                    value={authors}
                    disabled={busy}
                    onChange={(event) => setAuthors(event.target.value)}
                    placeholder="Author names"
                  />
                </div>
                <div className="grid gap-2 lg:col-span-2">
                  <Label htmlFor="ebook-upload-description">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Description{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="ebook-upload-description"
                    className="min-h-28 resize-y rounded-xl"
                    value={description}
                    disabled={busy}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Summarize the E-Book for readers."
                  />
                </div>
                <div className="grid gap-2 lg:col-span-2">
                  <Label>Category</Label>
                  <Select
                    disabled={busy}
                    value={category}
                    onValueChange={(value) =>
                      setCategory(value as EBookCategory)
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EBOOK_CATEGORIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {labelToken(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/60 py-0 shadow-none">
            <CardContent className="grid gap-4 px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <ImagePlus className="h-5 w-5 text-primary" />
                  Cover image{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Add a clear cover to make the E-Book easier to identify in the
                  catalog.
                </p>
              </div>
              <FileUploadField
                id="ebook-upload-cover"
                label="JPG, PNG, or WEBP cover"
                accept={COVER_ACCEPT}
                file={coverFile}
                disabled={busy}
                helperText="Supported covers: JPG, PNG, WEBP. Maximum size: 2 MB."
                emptyTitle="Choose a cover image or drop it here"
                onFileChange={(value) => {
                  setError(null);
                  setCoverFile(value);
                }}
              />
              {coverFile ? (
                <div className="grid gap-2">
                  <Label htmlFor="ebook-upload-cover-alt">
                    Cover alternative text
                  </Label>
                  <Input
                    id="ebook-upload-cover-alt"
                    value={coverAltText}
                    disabled={busy}
                    onChange={(event) => setCoverAltText(event.target.value)}
                    placeholder="Describe the cover for readers using assistive technology"
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/60 py-0 shadow-none">
            <CardContent className="grid gap-4 px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <BookOpen className="h-5 w-5 text-primary" />
                  E-Book file
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Attach the private PDF or EPUB file after completing the
                  catalog presentation.
                </p>
              </div>
              <FileUploadField
                id="ebook-upload-file"
                label="PDF or EPUB file"
                accept={EBOOK_ACCEPT}
                file={file}
                disabled={busy}
                helperText="Supported files: PDF and EPUB. Maximum size: 50 MB."
                emptyTitle="Choose an E-Book file or drop it here"
                onFileChange={(value) => {
                  setError(null);
                  setFile(value);
                }}
              />
            </CardContent>
          </Card>
          {error ? (
            <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t border-border/60 pt-5">
          <Button
            className="min-w-44 rounded-xl"
            disabled={busy || !title.trim() || !authors.trim() || !file}
            onClick={() => void submit()}
          >
            {busy ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Uploading and validating...
              </>
            ) : (
              <>
                <BookPlus className="h-4 w-4" />
                Create E-Book
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
