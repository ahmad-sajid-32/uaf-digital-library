"use client";

import * as React from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StudentBorrowActionDialogType = "borrow" | "renew" | "return";

function getDialogCopy(action: StudentBorrowActionDialogType): {
  title: string;
  confirmLabel: string;
  pendingLabel: string;
  description: string;
} {
  switch (action) {
    case "borrow":
      return {
        title: "Borrow This Book",
        confirmLabel: "Confirm Borrow",
        pendingLabel: "Borrowing...",
        description:
          "This sends a real borrow request to the backend. Borrow limits, overdue restrictions, queue conflicts, and hold rules are still decided by the backend.",
      };
    case "renew":
      return {
        title: "Renew This Borrow",
        confirmLabel: "Confirm Renew",
        pendingLabel: "Renewing...",
        description:
          "This asks the backend to extend the due date. Queue pressure, renewal limits, and loan state still stay backend-owned.",
      };
    case "return":
      return {
        title: "Return This Book",
        confirmLabel: "Confirm Return",
        pendingLabel: "Returning...",
        description:
          "This sends a real return request to the backend. Queue reassignment and fine side effects still stay backend-owned.",
      };
  }
}

interface StudentBorrowActionDialogProps {
  action: StudentBorrowActionDialogType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  supportingText?: string | null;
  pending: boolean;
  error: string | null;
  onConfirm: () => Promise<boolean>;
}

export function StudentBorrowActionDialog({
  action,
  open,
  onOpenChange,
  bookTitle,
  supportingText,
  pending,
  error,
  onConfirm,
}: StudentBorrowActionDialogProps): React.JSX.Element {
  const dialogCopy = getDialogCopy(action);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-2xl rounded-3xl border-border/70 p-0"
        showCloseButton={!pending}
      >
        <div className="space-y-5 px-6 py-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              {dialogCopy.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {dialogCopy.description}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-3xl border border-border/70 bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Selected Book
            </p>
            <p className="mt-2 text-lg font-black text-foreground">
              {bookTitle}
            </p>
            {supportingText ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {supportingText}
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={pending}
              onClick={() => {
                void (async () => {
                  const succeeded = await onConfirm();

                  if (succeeded) {
                    onOpenChange(false);
                  }
                })();
              }}
            >
              {pending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {dialogCopy.pendingLabel}
                </>
              ) : (
                dialogCopy.confirmLabel
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
