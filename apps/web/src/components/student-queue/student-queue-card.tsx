"use client";

import { BellRing, ShieldCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  canCancelStudentQueueEntry,
  formatStudentQueueDateTime,
  getStudentQueueStatusPresentation,
  type StudentQueueItem,
} from "@/lib/student-queue";
import { cn } from "@/lib/utils";

interface StudentQueueCardProps {
  item: StudentQueueItem;
  mutationLocked: boolean;
  cancelPending: boolean;
  onCancelRequested: (item: StudentQueueItem) => void;
}

export function StudentQueueCard({
  item,
  mutationLocked,
  cancelPending,
  onCancelRequested,
}: StudentQueueCardProps) {
  const statusPresentation = getStudentQueueStatusPresentation(item.status);
  const canCancel = canCancelStudentQueueEntry(item.status);
  const positionLabel = canCancel ? "Current Position" : "Recorded Position";

  return (
    <Card className="rounded-3xl border border-border/70 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-3 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("rounded-full border", statusPresentation.toneClassName)}
              >
                {statusPresentation.label}
              </Badge>
              {canCancel ? (
                <Badge variant="secondary" className="rounded-full">
                  Action available
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full">
                  Read only
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">
              {item.title}
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {statusPresentation.description}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {positionLabel}
            </p>
            <p className="mt-2 text-xl font-black text-foreground">
              #{item.position}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Queue Status
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {statusPresentation.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Status text comes directly from the backend queue state.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Notified At
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentQueueDateTime(item.notified_at)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Notification timestamps are shown only when the backend returns
              them.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Hold Expires
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentQueueDateTime(item.hold_expires_at)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Hold-expiry behavior stays backend-owned. This screen only shows
              the returned timestamp.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-start gap-3">
              {canCancel ? (
                <BellRing className="mt-0.5 h-5 w-5 text-primary" />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {canCancel ? "Cancelable entry" : "Terminal queue record"}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {canCancel
                    ? "This status can still be cancelled through the real backend route."
                    : "This queue status is visible for truthfulness, but it no longer supports cancellation."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {canCancel ? (
            <Button
              type="button"
              variant="destructive"
              className="gap-2 rounded-2xl"
              disabled={mutationLocked}
              onClick={() => {
                onCancelRequested(item);
              }}
            >
              {cancelPending ? (
                <>
                  <XCircle className="h-4 w-4 animate-pulse" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Cancel Queue Entry
                </>
              )}
            </Button>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              No active queue action is available for this returned status.
            </div>
          )}

          {item.status === "notified" ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              This entry is in a notified hold state. The backend still owns the
              hold-expiry deadline and any next queue promotion after cancellation.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
