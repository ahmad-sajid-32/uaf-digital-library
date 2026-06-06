"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  accessEBook, archiveEBook, clearEBookCover, deleteEBook, finalizeEBook, getStaffEBooks, getStudentEBooks,
  publishEBook, setEBookCover, updateEBook, uploadEBook, type UpdateInput, type UploadInput,
} from "@/lib/api/ebooks";
import type { EBook, EBookAccessEventType } from "@/lib/ebooks";

export function useEBooks(mode: "staff" | "student") {
  const [items, setItems] = React.useState<EBook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await (mode === "staff" ? getStaffEBooks() : getStudentEBooks())); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to load E-Books."); }
    finally { setLoading(false); }
  }, [mode]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const mutate = React.useCallback(async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); toast.success(message); await refresh(); }
    catch (value) { toast.error(value instanceof Error ? value.message : "E-Book action failed."); throw value; }
  }, [refresh]);

  return {
    items, loading, error, refresh,
    upload: (input: UploadInput) => mutate(() => uploadEBook(input), "E-Book uploaded and finalized."),
    finalize: (id: string) => mutate(() => finalizeEBook(id), "E-Book file finalized."),
    publish: (id: string) => mutate(() => publishEBook(id), "E-Book published."),
    archive: (id: string) => mutate(() => archiveEBook(id), "E-Book archived."),
    remove: (id: string) => mutate(() => deleteEBook(id), "Draft E-Book deleted."),
    update: (id: string, value: UpdateInput) => mutate(() => updateEBook(id, value), "E-Book metadata updated."),
    setCover: (id: string, file: File, altText?: string) => mutate(() => setEBookCover(id, file, altText), "E-Book cover updated."),
    clearCover: (id: string) => mutate(() => clearEBookCover(id), "E-Book cover removed."),
    access: async (id: string, type: EBookAccessEventType) => {
      try {
        const result = await accessEBook(id, type, mode === "staff");
        window.open(result.url, "_blank", "noopener,noreferrer");
      } catch (value) {
        toast.error(value instanceof Error ? value.message : "Unable to open this E-Book.");
        throw value;
      }
    },
  };
}
