"use client";

import * as React from "react";
import { BookOpenText, RefreshCcw, Undo2 } from "lucide-react";

import { BookStatusBadge } from "@/components/books/book-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBookCategoryLabel } from "@/lib/books";
import {
  formatStudentBorrowDateTime,
  getStudentBorrowDuePresentation,
  type StudentActiveBorrowItem,
} from "@/lib/student-borrows";
import { cn } from "@/lib/utils";

function DueStatusPill(props: {
  label: string;
  state: "upcoming" | "due_today" | "overdue";
}): React.JSX.Element {
  return (
    <Badge
      className={cn(
        "rounded-full border",
        props.state === "overdue"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : props.state === "due_today"
            ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
            : "border-primary/20 bg-primary/10 text-primary",
      )}
      variant="outline"
    >
      {props.label}
    </Badge>
  );
}

interface StudentActiveBorrowCardProps {
  item: StudentActiveBorrowItem;
  mutationLocked: boolean;
  renewPending: boolean;
  returnPending: boolean;
  onRenewRequested: (item: StudentActiveBorrowItem) => void;
  onReturnRequested: (item: StudentActiveBorrowItem) => void;
}

export function StudentActiveBorrowCard({
  item,
  mutationLocked,
  renewPending,
  returnPending,
  onRenewRequested,
  onReturnRequested,
}: StudentActiveBorrowCardProps): React.JSX.Element {
  const duePresentation = getStudentBorrowDuePresentation(item.due_date);

  return (
    <Card
      className={cn(
        "rounded-3xl border py-0 shadow-none",
        duePresentation.state === "overdue"
          ? "border-destructive/20 bg-destructive/5"
          : "border-border/70 bg-card/95",
      )}
    >
      <CardHeader className="gap-3 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DueStatusPill
                label={duePresentation.label}
                state={duePresentation.state}
              />
              <BookStatusBadge status={item.book_status} />
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Issued
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatStudentBorrowDateTime(item.issue_date)}
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
              {formatStudentBorrowDateTime(item.due_date)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {duePresentation.helper}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4 sm:col-span-2 xl:col-span-1">
            <div className="flex items-start gap-3">
              <BookOpenText className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Backend-owned circulation truth
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Renew and return stay real backend actions. Queue conflicts,
                  fines, and final due-date outcomes are not guessed here.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-2xl"
            disabled={mutationLocked}
            onClick={() => {
              onRenewRequested(item);
            }}
          >
            {renewPending ? (
              <>
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Renewing...
              </>
            ) : (
              <>
                <RefreshCcw className="h-4 w-4" />
                Renew
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2 rounded-2xl"
            disabled={mutationLocked}
            onClick={() => {
              onReturnRequested(item);
            }}
          >
            {returnPending ? (
              <>
                <Undo2 className="h-4 w-4 animate-pulse" />
                Returning...
              </>
            ) : (
              <>
                <Undo2 className="h-4 w-4" />
                Return
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
