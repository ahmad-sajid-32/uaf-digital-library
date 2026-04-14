"use client";

import * as React from "react";
import { LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SelfProfileFormProps {
  email: string;
  roleLabel: string;
  fullName: string;
  userId: string;
  dirty: boolean;
  pending: boolean;
  canSubmit: boolean;
  validationError: string | null;
  error: string | null;
  syncWarning: string | null;
  onFullNameChange: (value: string) => void;
  onSubmit: () => Promise<boolean>;
  onReset: () => void;
}

export function SelfProfileForm({
  email,
  roleLabel,
  fullName,
  userId,
  dirty,
  pending,
  canSubmit,
  validationError,
  error,
  syncWarning,
  onFullNameChange,
  onSubmit,
  onReset,
}: SelfProfileFormProps): React.JSX.Element {
  const helperMessage = validationError || error || syncWarning;
  const helperTone =
    validationError || error ? "text-destructive" : "text-amber-700";

  return (
    <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
      <CardHeader className="space-y-3 px-6 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Self service
          </Badge>
          <Badge variant="outline" className="rounded-full">
            1 editable field
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="font-display text-2xl font-black tracking-tight">
            Profile Details
          </CardTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            The current self-service contract only allows full-name updates.
            Email, role, and account identity remain display-only here.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-6 pb-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-center gap-2 text-primary">
              <Mail className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                Email
              </p>
            </div>
            <p className="mt-3 break-all text-sm font-semibold text-foreground">
              {email}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                Role
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {roleLabel}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                Account Id
              </p>
            </div>
            <p className="mt-3 break-all text-sm font-semibold text-foreground">
              {userId}
            </p>
          </div>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="self-profile-full-name">Full Name</Label>
            <Input
              id="self-profile-full-name"
              value={fullName}
              onChange={(event) => {
                onFullNameChange(event.target.value);
              }}
              disabled={pending}
              className="h-12 rounded-xl"
              placeholder="Enter your full name"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              The backend currently accepts only `full_name` in this self-service
              profile update contract.
            </p>
          </div>

          {helperMessage ? (
            <div
              className={`rounded-2xl border px-4 py-4 text-sm ${validationError || error ? "border-destructive/20 bg-destructive/5" : "border-amber-200 bg-amber-50"} ${helperTone}`}
            >
              {helperMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={!dirty || pending}
              onClick={onReset}
            >
              Reset
            </Button>
            <Button type="submit" className="rounded-xl" disabled={!canSubmit}>
              {pending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
