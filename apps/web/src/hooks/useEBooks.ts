"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  accessEBook, archiveEBook, clearEBookCover, deleteEBook, finalizeEBook, getStaffEBooks, getStudentEBooks,
  publishEBook, setEBookCover, updateEBook, uploadEBook, type UpdateInput, type UploadInput,
} from "@/lib/api/ebooks";
import type { EBook, EBookAccessEventType } from "@/lib/ebooks";

export type EBookPendingAction =
  | "upload"
  | "finalize"
  | "publish"
  | "archive"
  | "remove"
  | "update"
  | "set-cover"
  | "clear-cover"
  | EBookAccessEventType;

export function useEBooks(mode: "staff" | "student") {
  const [items, setItems] = React.useState<EBook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    action: EBookPendingAction;
    ebookId: string | null;
  } | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await (mode === "staff" ? getStaffEBooks() : getStudentEBooks())); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to load E-Books."); }
    finally { setLoading(false); }
  }, [mode]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const mutate = React.useCallback(async (
    action: EBookPendingAction,
    ebookId: string | null,
    operation: () => Promise<unknown>,
    message: string,
  ): Promise<boolean> => {
    setPendingAction({ action, ebookId });
    try { await operation(); toast.success(message); await refresh(); return true; }
    catch (value) { toast.error(value instanceof Error ? value.message : "E-Book action failed."); return false; }
    finally { setPendingAction(null); }
  }, [refresh]);

  return {
    items, loading, error, pendingAction, refresh,
    isPending: (action: EBookPendingAction, ebookId: string | null = null) =>
      pendingAction?.action === action && pendingAction.ebookId === ebookId,
    upload: (input: UploadInput) => mutate("upload", null, () => uploadEBook(input), "E-Book uploaded and finalized."),
    finalize: (id: string) => mutate("finalize", id, () => finalizeEBook(id), "E-Book file finalized."),
    publish: (id: string) => mutate("publish", id, () => publishEBook(id), "E-Book published."),
    archive: (id: string) => mutate("archive", id, () => archiveEBook(id), "E-Book archived."),
    remove: (id: string) => mutate("remove", id, () => deleteEBook(id), "E-Book deleted."),
    update: (id: string, value: UpdateInput) => mutate("update", id, () => updateEBook(id, value), "E-Book metadata updated."),
    setCover: (id: string, file: File, altText?: string) => mutate("set-cover", id, () => setEBookCover(id, file, altText), "E-Book cover updated."),
    clearCover: (id: string) => mutate("clear-cover", id, () => clearEBookCover(id), "E-Book cover removed."),
    access: async (id: string, type: EBookAccessEventType) => {
      setPendingAction({ action: type, ebookId: id });
      try {
        const result = await accessEBook(id, type, mode === "staff");
        window.open(result.url, "_blank", "noopener,noreferrer");
      } catch (value) {
        toast.error(value instanceof Error ? value.message : "Unable to open this E-Book.");
      } finally {
        setPendingAction(null);
      }
    },
  };
}
