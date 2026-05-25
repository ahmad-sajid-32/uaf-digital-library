// apps/web/src/components/books/book-cover-upload-field.tsx
/**
 * Book-cover upload field for staff book create/edit workflows.
 *
 * Purpose:
 * - Provide a focused image-only upload surface for book cover selection.
 * - Match the existing institutional upload-card styling used elsewhere in the
 *   application while adding cover-specific preview and validation behavior.
 * - Support current-cover preview, selected-file preview, replacement, clearing,
 *   and optional existing-cover removal.
 *
 * Book Cover Integration:
 * - This component does not upload directly to Supabase Storage.
 * - It only selects and validates a local File object.
 * - The parent form sends the selected File to the FastAPI cover endpoint.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  ImagePlus,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BOOK_COVER_MAX_SIZE_BYTES,
  BOOK_COVER_MIME_TYPE_VALUES,
  formatBookCoverSize,
  isSupportedBookCoverMimeType,
  type BookCoverMimeType,
} from "@/lib/books";
import { cn } from "@/lib/utils";

import { BookCoverImage } from "./book-cover-image";

const BOOK_COVER_ACCEPT = BOOK_COVER_MIME_TYPE_VALUES.join(",");

interface BookCoverValidationResult {
  valid: boolean;
  message: string | null;
}

interface BookCoverUploadFieldProps {
  id: string;
  title: string;
  author?: string | null;
  label?: string;
  file: File | null;
  currentCoverImageUrl?: string | null;
  currentCoverImageAlt?: string | null;
  disabled?: boolean;
  uploadPending?: boolean;
  removePending?: boolean;
  helperText?: string;
  error?: string | null;
  className?: string;
  onFileChange: (file: File | null) => void;
  onValidationError?: (message: string | null) => void;
  onRemoveCurrentCover?: () => void | Promise<void>;
}

function getBookCoverTypeLabel(value: BookCoverMimeType): string {
  if (value === "image/jpeg") {
    return "JPEG";
  }

  if (value === "image/png") {
    return "PNG";
  }

  return "WEBP";
}

function getAllowedTypesLabel(): string {
  return BOOK_COVER_MIME_TYPE_VALUES.map(getBookCoverTypeLabel).join(", ");
}

function validateBookCoverFile(file: File): BookCoverValidationResult {
  const mimeType = file.type.trim().toLowerCase();

  if (!isSupportedBookCoverMimeType(mimeType)) {
    return {
      valid: false,
      message: `Invalid cover type. Use ${getAllowedTypesLabel()} only.`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      message: "The selected cover image is empty.",
    };
  }

  if (file.size > BOOK_COVER_MAX_SIZE_BYTES) {
    return {
      valid: false,
      message: `The selected cover image is too large. Maximum allowed size is ${formatBookCoverSize(
        BOOK_COVER_MAX_SIZE_BYTES,
      )}.`,
    };
  }

  return {
    valid: true,
    message: null,
  };
}

function getFileExtensionLabel(filename: string): string {
  const extension = filename.split(".").at(-1)?.trim().toUpperCase();

  if (!extension || extension === filename.toUpperCase()) {
    return "IMAGE";
  }

  return extension;
}

export function BookCoverUploadField({
  id,
  title,
  author,
  label = "Book cover",
  file,
  currentCoverImageUrl,
  currentCoverImageAlt,
  disabled = false,
  uploadPending = false,
  removePending = false,
  helperText,
  error,
  className,
  onFileChange,
  onValidationError,
  onRemoveCurrentCover,
}: BookCoverUploadFieldProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const normalizedCurrentCoverUrl = currentCoverImageUrl?.trim() ?? "";
  const hasCurrentCover = normalizedCurrentCoverUrl.length > 0;
  const fieldDisabled = disabled || uploadPending || removePending;
  const visibleError = error ?? localError;
  const displayImageUrl = previewUrl ?? normalizedCurrentCoverUrl;
  const displayCoverAlt = file
    ? `Selected cover preview for ${title}`
    : currentCoverImageAlt;
  const selectedExtension = file ? getFileExtensionLabel(file.name) : null;
  const selectedMimeType = file?.type.trim().toLowerCase() ?? null;
  const selectedMimeTypeLabel = isSupportedBookCoverMimeType(selectedMimeType)
    ? getBookCoverTypeLabel(selectedMimeType)
    : selectedExtension;
  const statusLabel = file
    ? "Selected cover"
    : hasCurrentCover
      ? "Current cover"
      : "No cover selected";

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const resetNativeInput = React.useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const openFilePicker = React.useCallback(() => {
    if (!fieldDisabled) {
      inputRef.current?.click();
    }
  }, [fieldDisabled]);

  const clearSelectedFile = React.useCallback(() => {
    setLocalError(null);
    onValidationError?.(null);
    onFileChange(null);
    resetNativeInput();
  }, [onFileChange, onValidationError, resetNativeInput]);

  const handleSelectedFile = React.useCallback(
    (nextFile: File | null) => {
      setDragActive(false);

      if (!nextFile) {
        clearSelectedFile();
        return;
      }

      const validation = validateBookCoverFile(nextFile);

      if (!validation.valid) {
        setLocalError(validation.message);
        onValidationError?.(validation.message);
        onFileChange(null);
        resetNativeInput();
        return;
      }

      setLocalError(null);
      onValidationError?.(null);
      onFileChange(nextFile);
    },
    [clearSelectedFile, onFileChange, onValidationError, resetNativeInput],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {label}
      </Label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={BOOK_COVER_ACCEPT}
        disabled={fieldDisabled}
        className="sr-only"
        onChange={(event) => {
          handleSelectedFile(event.target.files?.[0] ?? null);
        }}
      />

      <div
        role="button"
        tabIndex={fieldDisabled ? -1 : 0}
        aria-disabled={fieldDisabled}
        aria-describedby={`${id}-helper ${id}-status`}
        className={cn(
          "relative overflow-hidden rounded-3xl border border-dashed border-border/70 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_42%),linear-gradient(180deg,hsl(var(--muted)/0.45),hsl(var(--background)))] p-4 text-left transition-all duration-200 sm:p-5",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          !fieldDisabled &&
            "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
          dragActive &&
            !fieldDisabled &&
            "border-primary bg-primary/5 shadow-[0_20px_60px_hsl(var(--primary)/0.12)]",
          fieldDisabled && "cursor-not-allowed opacity-60",
          visibleError && "border-destructive/60 bg-destructive/5",
        )}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();

          if (!fieldDisabled) {
            setDragActive(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();

          if (!fieldDisabled) {
            event.dataTransfer.dropEffect = "copy";
            setDragActive(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();

          if (
            event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            return;
          }

          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();

          if (fieldDisabled) {
            return;
          }

          handleSelectedFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.14),transparent_68%)]" />

        <div className="relative grid gap-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
          <div className="flex justify-center sm:justify-start">
            <BookCoverImage
              title={title}
              author={author}
              coverImageUrl={displayImageUrl}
              coverImageAlt={displayCoverAlt}
              variant="card"
              className={cn(
                "w-24 transition-transform duration-200 sm:w-28",
                dragActive && !fieldDisabled && "scale-[1.03] -translate-y-1",
              )}
              showTextFallback={false}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  <FileImage className="h-3.5 w-3.5" />
                  {statusLabel}
                </span>

                {file ? (
                  <span
                    id={`${id}-status`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-black text-foreground">
                  {file
                    ? file.name
                    : hasCurrentCover
                      ? "A cover image is already attached to this book."
                      : "Choose a cover image or drop it here."}
                </p>

                <p
                  id={`${id}-helper`}
                  className="text-sm leading-6 text-muted-foreground"
                >
                  {helperText ??
                    `Allowed formats: ${getAllowedTypesLabel()}. Maximum size: ${formatBookCoverSize(
                      BOOK_COVER_MAX_SIZE_BYTES,
                    )}.`}
                </p>
              </div>
            </div>

            {file ? (
              <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-3 text-sm shadow-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UploadCloud className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {selectedMimeTypeLabel} · {formatBookCoverSize(file.size)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {visibleError ? (
              <div className="flex gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-5">{visibleError}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={fieldDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  openFilePicker();
                }}
              >
                <ImagePlus className="h-4 w-4" />
                {file || hasCurrentCover ? "Replace cover" : "Choose cover"}
              </Button>

              {file ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  disabled={fieldDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    clearSelectedFile();
                  }}
                >
                  <X className="h-4 w-4" />
                  Clear selection
                </Button>
              ) : null}

              {!file && hasCurrentCover && onRemoveCurrentCover ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-destructive hover:text-destructive"
                  disabled={fieldDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onRemoveCurrentCover();
                  }}
                >
                  <X className="h-4 w-4" />
                  {removePending ? "Removing..." : "Remove cover"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
