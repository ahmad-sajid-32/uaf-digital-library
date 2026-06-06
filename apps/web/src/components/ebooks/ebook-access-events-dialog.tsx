"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getEBookEvents, type AccessEvent } from "@/lib/api/ebooks";
import { labelToken } from "@/lib/ebooks";

export function EBookAccessEventsDialog({ ebookId }: { ebookId: string }) {
  const [items, setItems] = React.useState<AccessEvent[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const load = async () => {
    try { setError(null); setItems((await getEBookEvents(ebookId)).items); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to load activity."); }
  };
  return (
    <Dialog onOpenChange={(open) => { if (open) void load(); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Activity</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Access Activity</DialogTitle><DialogDescription>Successful preview and download URL issuances.</DialogDescription></DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="max-h-80 space-y-2 overflow-auto">
          {items.length === 0 && !error ? <p className="text-sm text-muted-foreground">No access activity recorded.</p> : items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              <strong>{labelToken(item.event_type)}</strong> by {item.user_name || "Deleted account"}<br />
              <span className="text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
