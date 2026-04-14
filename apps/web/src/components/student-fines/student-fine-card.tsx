"use client";

import { AlertCircle, CircleDollarSign } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatStudentFineAmount,
  formatStudentFineDateTime,
  getStudentFineStatusPresentation,
  type StudentFineItem,
} from "@/lib/student-fines";
import { cn } from "@/lib/utils";

interface StudentFineCardProps {
  item: StudentFineItem;
}

export function StudentFineCard({ item }: StudentFineCardProps) {
  const statusPresentation = getStudentFineStatusPresentation(item.status);

  return (
    <Card className="rounded-3xl border border-amber-500/15 bg-card/95 py-0 shadow-none">
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
                Read only
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
              Fine amount and status come directly from backend records.
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
              Borrow context is shown here so the fine is understandable without
              recalculating anything in the frontend.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Due Date
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentFineDateTime(item.due_date)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This view does not estimate overdue days or recompute money logic.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Return Date
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentFineDateTime(item.return_date)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              If no return is recorded yet, the backend still owns what that
              means for the fine lifecycle.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
            <div className="flex items-start gap-3">
              <CircleDollarSign className="mt-0.5 h-5 w-5 text-amber-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Visibility only
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  This student module only shows your fine status. It does not
                  expose settlement actions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Backend-owned fine logic
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Amount, status, and settlement outcomes stay backend-owned.
                  This UI only renders the returned truth.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
