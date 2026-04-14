"use client";

import * as React from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SELF_PROFILE_DELETE_CONFIRMATION } from "@/lib/self-profile";

interface SelfDeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  pending: boolean;
  error: string | null;
  confirmationValue: string;
  onConfirmationValueChange: (value: string) => void;
  onConfirm: () => Promise<boolean>;
}

export function SelfDeleteAccountDialog({
  open,
  onOpenChange,
  email,
  pending,
  error,
  confirmationValue,
  onConfirmationValueChange,
  onConfirm,
}: SelfDeleteAccountDialogProps): React.JSX.Element {
  const canConfirm =
    confirmationValue.trim() === SELF_PROFILE_DELETE_CONFIRMATION;

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
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                Irreversible Action
              </p>
            </div>
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              This sends a real destructive request to the backend. Your account
              and dependent library data will be removed according to the
              current backend contract.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm leading-6 text-foreground">
            <p className="font-semibold text-destructive">Signed-in account</p>
            <p className="mt-2 break-all">{email}</p>
            <p className="mt-3 text-muted-foreground">
              Type{" "}
              <span className="font-semibold text-foreground">
                {SELF_PROFILE_DELETE_CONFIRMATION}
              </span>{" "}
              to confirm.
            </p>
          </div>

          <div className="space-y-2">
            <Input
              value={confirmationValue}
              onChange={(event) => {
                onConfirmationValueChange(event.target.value);
              }}
              placeholder={SELF_PROFILE_DELETE_CONFIRMATION}
              disabled={pending}
              className="h-12 rounded-xl"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={pending}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Keep Account
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={pending || !canConfirm}
              onClick={() => {
                void onConfirm();
              }}
            >
              {pending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Account"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
