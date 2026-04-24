/**
 * Upload dialog for the staff document-management module.
 *
 * Purpose:
 * - Collect document details and the selected file from staff.
 * - Run the upload flow from one place.
 * - Keep progress and errors visible without exposing internal system wording
 *   in the screen copy.
 */

"use client";

import * as React from "react";
import { AlertCircle, FilePlus2, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { Input } from "@/components/ui/input";
import { useDocumentUploadWorkflow } from "@/hooks/useDocuments";

const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "txt",
]);
const MAX_DOCUMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.at(-1)?.toLowerCase() ?? "") : "";
}

function getPhaseCopy(
  phase: "idle" | "requesting_upload_url" | "uploading_file" | "finalizing",
): string | null {
  switch (phase) {
    case "idle":
      return null;
    case "requesting_upload_url":
      return "Getting your upload ready.";
    case "uploading_file":
      return "Uploading your file.";
    case "finalizing":
      return "Checking the file and preparing it for the library.";
  }
}

export function DocumentUploadDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const { pending, phase, error, clearError, reset, uploadDocument } =
    useDocumentUploadWorkflow();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [documentType, setDocumentType] = React.useState("");
  const [audienceScope, setAudienceScope] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setSelectedFile(null);
    setTitle("");
    setDocumentType("");
    setAudienceScope("");
    setDepartment("");
    setLocalError(null);
    clearError();
    reset();
  }, [clearError, reset]);

  React.useEffect(() => {
    if (!props.open) {
      resetForm();
    }
  }, [props.open, resetForm]);

  const phaseCopy = getPhaseCopy(phase);

  const handleSubmit = React.useCallback(async () => {
    clearError();
    setLocalError(null);

    if (!selectedFile) {
      setLocalError("Choose a file before continuing.");
      return;
    }

    if (selectedFile.size <= 0) {
      setLocalError("The selected file is empty.");
      return;
    }

    if (selectedFile.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      setLocalError("Choose a file that is 25 MB or smaller.");
      return;
    }

    const extension = getFileExtension(selectedFile.name);

    if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
      setLocalError(
        "Choose a PDF, Word file, or TXT file.",
      );
      return;
    }

    const succeeded = await uploadDocument({
      file: selectedFile,
      title,
      documentType,
      audienceScope,
      department,
    });

    if (succeeded) {
      props.onOpenChange(false);
    }
  }, [
    audienceScope,
    clearError,
    department,
    documentType,
    props,
    selectedFile,
    title,
    uploadDocument,
  ]);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!pending) {
          props.onOpenChange(open);
        }
      }}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl lg:min-w-3xl overflow-y-auto rounded-3xl border-border/70 p-0">
        <div className="px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              Upload Official Document
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-6">
              Add a few details, choose the file, and the app will upload it and
              prepare it for the document library.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 grid gap-5">
            <div className="grid gap-5 grid-cols-1">
              <FileUploadField
                id="document-upload-file"
                label="File"
              accept={DOCUMENT_UPLOAD_ACCEPT}
              file={selectedFile}
              disabled={pending}
              helperText="Supported files: PDF, DOCX, TXT. Maximum size: 25 MB."
              emptyTitle="Choose a file or drop it here"
              emptyDescription="Drag a file into this area or click to pick one from your device."
                onFileChange={(file) => {
                  setLocalError(null);
                  setSelectedFile(file);
                }}
              />
            </div>

            <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
              <CardContent className="px-5 py-5 sm:px-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Document Details
                    </p>
                    <p className="text-base font-black text-foreground">
                      Optional details for easier searching
                    </p>
                  </div>

                  <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
                    <div className="lg:col-span-3">
                      <label
                        htmlFor="document-upload-title"
                        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        Title
                      </label>
                      <Input
                        id="document-upload-title"
                        value={title}
                        onChange={(event) => {
                          setTitle(event.target.value);
                        }}
                        placeholder="Optional name shown in the library"
                        className="h-11 rounded-xl border-border/70 bg-background"
                        disabled={pending}
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Leave this blank if you want the file name to be used.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="document-upload-type"
                        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        Category
                      </label>
                      <Input
                        id="document-upload-type"
                        value={documentType}
                        onChange={(event) => {
                          setDocumentType(event.target.value);
                        }}
                        placeholder="Example: Policy"
                        className="h-11 rounded-xl border-border/70 bg-background"
                        disabled={pending}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="document-upload-department"
                        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        Department
                      </label>
                      <Input
                        id="document-upload-department"
                        value={department}
                        onChange={(event) => {
                          setDepartment(event.target.value);
                        }}
                        placeholder="Example: Registrar Office"
                        className="h-11 rounded-xl border-border/70 bg-background"
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="document-upload-audience"
                        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        Who Can Use It
                      </label>
                      <Input
                        id="document-upload-audience"
                        value={audienceScope}
                        onChange={(event) => {
                          setAudienceScope(event.target.value);
                        }}
                        placeholder="Example: All students"
                        className="h-11 rounded-xl border-border/70 bg-background"
                        disabled={pending}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {phaseCopy ? (
              <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground">
                <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="font-semibold text-primary">Working on it</p>
                  <p className="leading-6 text-muted-foreground">{phaseCopy}</p>
                </div>
              </div>
            ) : null}

            {localError ? (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{localError}</p>
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            <DialogFooter className="border-t border-border/60 pt-5">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={pending}
                onClick={() => {
                  props.onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={pending || !selectedFile}
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {pending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {phase === "requesting_upload_url"
                      ? "Getting Ready..."
                      : phase === "uploading_file"
                        ? "Uploading..."
                        : "Finishing..."}
                  </>
                ) : (
                  <>
                    <FilePlus2 className="h-4 w-4" />
                    Upload Document
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
