import { BookOpen, Download, LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EBook, EBookAccessEventType } from "@/lib/ebooks";

export function StudentEBookAccessCard({
  ebook,
  onAccess,
  previewPending,
  downloadPending,
}: {
  ebook: EBook;
  onAccess: (type: EBookAccessEventType) => void;
  previewPending: boolean;
  downloadPending: boolean;
}) {
  const actionPending = previewPending || downloadPending;
  return (
    <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Available reading actions</div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">The library creates a short-lived secure link when you choose an available action.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ebook.allow_preview ? <Button className="rounded-xl" disabled={actionPending} onClick={() => onAccess("preview")}>{previewPending ? <><LoaderCircle className="h-4 w-4 animate-spin" />Opening...</> : <><BookOpen className="h-4 w-4" />Read Online</>}</Button> : null}
        {ebook.allow_download ? <Button className="rounded-xl" variant="outline" disabled={actionPending} onClick={() => onAccess("download")}>{downloadPending ? <><LoaderCircle className="h-4 w-4 animate-spin" />Preparing...</> : <><Download className="h-4 w-4" />Download</>}</Button> : null}
      </div>
    </div>
  );
}
