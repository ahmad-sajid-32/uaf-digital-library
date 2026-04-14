"use client";

import { CheckCircle2, Clock3 } from "lucide-react";

import { BookStatusBadge } from "@/components/books/book-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBookCategoryLabel } from "@/lib/books";
import {
  formatStudentBorrowHistoryDateTime,
  type StudentBorrowHistoryItem,
} from "@/lib/student-borrow-history";

interface StudentBorrowHistoryCardProps {
  item: StudentBorrowHistoryItem;
}

export function StudentBorrowHistoryCard({
  item,
}: StudentBorrowHistoryCardProps) {
  return (
    <Card className="rounded-3xl border border-emerald-500/15 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-3 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
              >
                Returned Record
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {getBookCategoryLabel(item.category)}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">
              {item.title}
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {item.author}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Renewals Used
            </p>
            <p className="mt-2 text-xl font-black text-foreground">
              {item.renewal_count}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Issued
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentBorrowHistoryDateTime(item.issue_date)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This is when the backend recorded the borrow transaction.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Due Date
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentBorrowHistoryDateTime(item.due_date)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Historical due-date context only. This screen does not manage
              active renew or return work.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Returned
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentBorrowHistoryDateTime(item.return_date)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Completion state is anchored to return date, not guessed from
              current book status.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Current Book Status
            </p>
            <div className="mt-2">
              <BookStatusBadge status={item.book_status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This is the book&apos;s current catalog state, not its historical
              status at return time.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Read-only historical record
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  This row exists so you can review past borrowing activity
                  without mixing it into the active borrow workspace.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Ordered by latest return
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  The backend returns these records newest-returned first. This
                  first pass does not invent extra sort controls.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
