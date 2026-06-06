"use client";

import * as React from "react";
import { Activity, AlertCircle, Download, Eye, LoaderCircle, RefreshCw, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getEBookEvents, type AccessEvent } from "@/lib/api/ebooks";
import { labelToken } from "@/lib/ebooks";

export function EBookAccessEventsDialog({ ebookId }: { ebookId: string }) {
  const [items, setItems] = React.useState<AccessEvent[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const load = async () => {
    setLoading(true);
    try { setError(null); setItems((await getEBookEvents(ebookId)).items); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to load activity."); }
    finally { setLoading(false); }
  };
  return (
    <Dialog onOpenChange={(open) => { if (open) void load(); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="size-9 rounded-xl px-0 sm:h-8 sm:w-auto sm:px-3" aria-label="Review E-Book access activity" title="Review E-Book access activity"><Activity className="h-4 w-4" /><span className="hidden sm:inline">Activity</span></Button></DialogTrigger>
      <DialogContent className="rounded-3xl border-border/70 sm:max-w-4xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div>
          <DialogTitle className="font-display text-2xl font-black tracking-tight">Access Activity</DialogTitle>
          <DialogDescription>Successful preview and download link issuances for this E-Book.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/60 bg-muted/25 py-12 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Loading activity...</div> : null}
        {error ? <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none"><CardContent className="flex items-center justify-between gap-4 px-5 py-4"><div className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div><Button size="sm" variant="outline" className="rounded-xl" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Retry</Button></CardContent></Card> : null}
        {!loading && !error ? <div className="max-h-96 space-y-3 overflow-auto pr-1">
          {items.length === 0 ? <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center"><Activity className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No access activity recorded</p><p className="mt-1 text-xs text-muted-foreground">Preview and download activity will appear here.</p></div> : items.map((item) => {
            const Icon = item.event_type === "preview" ? Eye : Download;
            return <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.user_name || "Deleted account"}</p><Badge variant="outline">{labelToken(item.event_type)}</Badge></div><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="h-3.5 w-3.5" />{new Date(item.created_at).toLocaleString()}</p></div></div>;
          })}
        </div> : null}
      </DialogContent>
    </Dialog>
  );
}
