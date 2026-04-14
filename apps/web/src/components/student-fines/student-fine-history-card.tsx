"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatStudentFineAmount,
  formatStudentFineDateTime,
  getStudentFineStatusPresentation,
  type StudentFineHistoryItem,
} from "@/lib/student-fines";
import { cn } from "@/lib/utils";

interface StudentFineHistoryCardProps {
  item: StudentFineHistoryItem;
}

export function StudentFineHistoryCard({
  item,
}: StudentFineHistoryCardProps) {
  const statusPresentation = getStudentFineStatusPresentation(item.status);

  return (
    <Card className="rounded-3xl border border-emerald-500/15 bg-card/95 py-0 shadow-none">
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
              <Badge variant="secondary" className="rounded-full">
                Resolution record
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">
              {item.title}
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {statusPresentation.helper}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Amount
            </p>
            <p className="mt-2 text-xl font-black text-foreground">
              {formatStudentFineAmount(item.amount)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Fine Created
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentFineDateTime(item.fine_created_at)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Historical fines still preserve their original creation time.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Resolved At
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentFineDateTime(item.resolved_at)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Resolution timing is shown only from backend-returned metadata.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Issue Date
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentFineDateTime(item.issue_date)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Borrow dates remain contextual support, not recalculation inputs.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Due / Return
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Due {formatStudentFineDateTime(item.due_date)}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Returned {formatStudentFineDateTime(item.return_date)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Resolution context
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Resolved by {item.resolved_by_name ?? "Not recorded"}.
                </p>
                {item.waive_reason ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Waive reason: {item.waive_reason}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Read-only historical record
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  This student screen shows how the fine ended. It does not
                  expose settlement controls or reinterpret backend outcomes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
