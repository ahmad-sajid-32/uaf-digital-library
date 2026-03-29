/**
 * Reusable document-status badge for staff document-management surfaces.
 */

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { DocumentProcessingStatus } from "@/lib/api/documents";
import { cn } from "@/lib/utils";

type DocumentStatusCopy = {
  label: string;
  className: string;
};

const DOCUMENT_STATUS_COPY: Record<DocumentProcessingStatus, DocumentStatusCopy> = {
  uploaded: {
    label: "Uploaded",
    className:
      "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  processing: {
    label: "Processing",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  indexed: {
    label: "Indexed",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className:
      "border-destructive/20 bg-destructive/10 text-destructive",
  },
};

export function DocumentStatusBadge(props: {
  status: DocumentProcessingStatus;
  isUploadStale?: boolean;
}): React.JSX.Element {
  const copy =
    props.status === "uploaded" && props.isUploadStale
      ? {
          label: "Upload Stale",
          className:
            "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
        }
      : DOCUMENT_STATUS_COPY[props.status];

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-1", copy.className)}
    >
      {copy.label}
    </Badge>
  );
}
