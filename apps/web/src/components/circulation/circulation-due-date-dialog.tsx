// apps/web/src/components/circulation/circulation-due-date-dialog.tsx
/**
 * Due-date adjustment dialog for staff circulation management.
 *
 * Purpose:
 * - Edit a selected loan due date against the real backend contract.
 * - Keep the dialog focused on due-date adjustment without mixing destructive
 *   controls into the same surface.
 */

"use client";

import * as React from "react";
import { AlertTriangle, CalendarClock, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAdjustCirculationDueDate } from "@/hooks/useCirculation";
import type { StaffCirculationLoanDetailItem } from "@/lib/circulation";

type CirculationDueDateDialogLoan = Pick<
  StaffCirculationLoanDetailItem,
  "transaction_id" | "book_id" | "book_title" | "user_full_name" | "due_date"
>;

interface CirculationDueDateDialogProps {
  loan: CirculationDueDateDialogLoan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDateTimeLocalValue(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function CirculationDueDateDialog({
  loan,
  open,
  onOpenChange,
}: CirculationDueDateDialogProps): React.JSX.Element {
  const { pending, error, clearError, adjustDueDate } = useAdjustCirculationDueDate();
  const [dueDateValue, setDueDateValue] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!loan || !open) {
      return;
    }

    setDueDateValue(toDateTimeLocalValue(loan.due_date));
  }, [loan, open]);

  React.useEffect(() => {
    if (open) {
      return;
    }

    setValidationError(null);
    clearError();
  }, [clearError, open]);

  const hasUnsavedChanges = Boolean(
    loan && dueDateValue && dueDateValue !== toDateTimeLocalValue(loan.due_date),
  );

  const handleSave = React.useCallback(async () => {
    if (!loan || !dueDateValue) {
      setValidationError("Due date is required.");
      return;
    }

    const nextDueDate = new Date(dueDateValue);

    if (Number.isNaN(nextDueDate.getTime())) {
      setValidationError("Enter a valid due date and time.");
      return;
    }

    setValidationError(null);

    const success = await adjustDueDate(
      loan.transaction_id,
      {
        due_date: nextDueDate.toISOString(),
      },
      {
        relatedBookId: loan.book_id,
      },
    );

    if (success) {
      onOpenChange(false);
    }
  }, [adjustDueDate, dueDateValue, loan, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl rounded-3xl border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Adjust Due Date
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Update the selected loan due date through the database-owned
              circulation contract so recalculation and conflict behavior stay
              truthful.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loan ? (
            <div className="space-y-4">
              <Card className="border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
                <CardHeader className="px-5 py-5">
                  <CardTitle className="text-lg font-black tracking-tight">
                    {loan.book_title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
                  <div className="text-sm text-muted-foreground">
                    Borrower
                    <p className="mt-1 font-semibold text-foreground">
                      {loan.user_full_name}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Current Due Date
                    <p className="mt-1 font-semibold text-foreground">
                      {new Intl.DateTimeFormat("en-PK", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(loan.due_date))}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {validationError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {validationError}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Card className="border-border/60 bg-card/95 py-0 shadow-none">
                <CardContent className="space-y-3 px-5 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="circulation-due-date">New Due Date</Label>
                    <Input
                      id="circulation-due-date"
                      type="datetime-local"
                      value={dueDateValue}
                      onChange={(event) => {
                        setDueDateValue(event.target.value);
                      }}
                      disabled={pending}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
                    If the loan is already returned and still has a pending fine,
                    the backend recalculates that fine from the new due date.
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-border/60 bg-muted/35 py-0 shadow-none">
              <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
                Select a circulation record before adjusting the due date.
              </CardContent>
            </Card>
          )}

          <DialogFooter className="mt-6 border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={pending}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-xl border border-sky-500/30 bg-sky-500 text-white hover:bg-sky-500/90 dark:border-sky-400/40 dark:bg-sky-500 dark:text-sky-950"
              disabled={pending || !loan || !hasUnsavedChanges}
              onClick={() => {
                void handleSave();
              }}
            >
              {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              {pending ? "Updating..." : "Update Due Date"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
