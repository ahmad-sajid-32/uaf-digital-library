/**
 * Shared single-file upload field with click and drag-drop support.
 *
 * Purpose:
 * - Provide one reusable file selection surface for screens that need a
 *   friendlier file picker than the raw browser control.
 * - Keep the interaction simple: click to choose, drag to drop, and show the
 *   selected file clearly.
 */

"use client";

import * as React from "react";
import { FileImage, FileText, FileUp, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "~/lib/utils";

function formatFileSize(value: number): string {
  if (value <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function getFileExtensionLabel(filename: string): string {
  const parts = filename.split(".");
  const extension = parts.length > 1 ? (parts.at(-1)?.toUpperCase() ?? "") : "";
  return extension || "FILE";
}

export function FileUploadField(props: {
  id: string;
  label: string;
  file: File | null;
  accept?: string;
  disabled?: boolean;
  helperText?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onFileChange: (file: File | null) => void;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const previewName = props.file?.name ?? "Choose a file";
  const previewExtension = getFileExtensionLabel(previewName);
  const isImagePreview = ["PNG", "JPG", "JPEG", "WEBP"].includes(
    previewExtension,
  );

  const openFilePicker = React.useCallback(() => {
    if (!props.disabled) {
      inputRef.current?.click();
    }
  }, [props.disabled]);

  const handleFileSelection = React.useCallback(
    (fileList: FileList | null) => {
      props.onFileChange(fileList?.[0] ?? null);
      setDragActive(false);
    },
    [props],
  );

  return (
    <div className="space-y-2">
      <Label
        htmlFor={props.id}
        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {props.label}
      </Label>

      <input
        ref={inputRef}
        id={props.id}
        type="file"
        accept={props.accept}
        disabled={props.disabled}
        className="sr-only"
        onChange={(event) => {
          handleFileSelection(event.target.files);
        }}
      />

      <div
        role="button"
        tabIndex={props.disabled ? -1 : 0}
        aria-disabled={props.disabled}
        className={cn(
          "relative overflow-hidden rounded-3xl border border-dashed border-border/70 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_42%),linear-gradient(180deg,hsl(var(--muted)/0.45),hsl(var(--background)))] p-5 text-left transition-all duration-200",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
          !props.disabled &&
            "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
          dragActive &&
            "border-primary bg-primary/5 shadow-[0_20px_60px_hsl(var(--primary)/0.12)]",
          props.disabled && "cursor-not-allowed opacity-60",
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
          if (!props.disabled) {
            setDragActive(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!props.disabled) {
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
          if (props.disabled) {
            return;
          }
          handleFileSelection(event.dataTransfer.files);
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.14),transparent_68%)]" />

        <div className="relative flex flex-col items-center justify-center gap-6 px-3 py-2 text-center">
          <div
            className={cn(
              "flex flex-col items-center gap-2 transition-transform duration-200",
              dragActive && "scale-[1.03] -translate-y-1",
            )}
          >
            <div className="rounded-md bg-background shadow-sm ring-1 ring-border/60">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/8 text-primary">
                {isImagePreview ? (
                  <FileImage className="h-7 w-7" />
                ) : (
                  <FileText className="h-7 w-7" />
                )}
              </div>
            </div>

            <div className="flex max-w-52 flex-col items-center gap-1">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                {props.file
                  ? props.file.name
                  : (props.emptyTitle ?? "Choose a file or drop it here")}
              </p>
            </div>
          </div>

          <div className="max-w-md space-y-1">
            <p className="text-sm leading-6 text-muted-foreground">
              {props.file
                ? "This file is ready. You can keep it, replace it, or clear it."
                : (props.emptyDescription ??
                  "Drag a file here or click to choose one.")}
            </p>
            {props.helperText ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {props.helperText}
              </p>
            ) : null}
          </div>

          {props.file ? (
            <div className="w-full max-w-md rounded-2xl border border-border/70 bg-background/90 px-4 py-2 text-left text-sm shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-primary/8 p-2 text-primary">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {props.file.name}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Size: {formatFileSize(props.file.size)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {props.file ? (
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                disabled={props.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onFileChange(null);

                  if (inputRef.current) {
                    inputRef.current.value = "";
                  }
                }}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
