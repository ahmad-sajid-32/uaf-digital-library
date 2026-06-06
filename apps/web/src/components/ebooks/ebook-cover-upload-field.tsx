"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function EBookCoverUploadField({ hasCover, onUpload, onRemove }: { hasCover: boolean; onUpload: (file: File, alt?: string) => Promise<unknown>; onRemove: () => Promise<unknown> }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [alt, setAlt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const upload = async () => { if (!file) return; setBusy(true); try { await onUpload(file, alt || undefined); } finally { setBusy(false); } };
  return <Dialog><DialogTrigger asChild><Button size="sm" variant="outline">Cover</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Manage E-Book Cover</DialogTitle></DialogHeader><div className="grid gap-3"><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Input value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Alternative text" /></div><DialogFooter>{hasCover ? <Button variant="destructive" onClick={() => void onRemove()}>Remove Cover</Button> : null}<Button disabled={busy || !file} onClick={() => void upload()}>{busy ? "Uploading..." : "Upload Cover"}</Button></DialogFooter></DialogContent></Dialog>;
}
