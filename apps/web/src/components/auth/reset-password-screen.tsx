"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import reset_hero_image from "@/assets/reset_hero_image.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluatePasswordChecks, useResetPassword } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

function RequirementRow({
  met,
  label,
}: {
  met: boolean;
  label: string;
}): React.JSX.Element {
  const Icon = met ? CheckCircle2 : Shield;

  return (
    <li className="flex items-center gap-3 text-sm text-muted-foreground">
      <Icon
        className={cn(
          "h-4 w-4",
          met ? "text-success" : "text-muted-foreground",
        )}
      />
      <span>{label}</span>
    </li>
  );
}

export function ResetPasswordScreen(): React.JSX.Element {
  const { submit, loading, error, ready, invalidLink } = useResetPassword();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const passwordChecks = React.useMemo(
    () => evaluatePasswordChecks(newPassword, confirmPassword),
    [confirmPassword, newPassword],
  );

  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit(newPassword, confirmPassword);
  };

  if (!ready) {
    return (
      <AuthShell>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardContent className="flex items-center justify-center py-12">
            <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-muted px-5 py-3 text-sm font-medium text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              Validating your recovery session...
            </div>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (invalidLink) {
    return (
      <AuthShell>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardHeader className="space-y-4 px-5 pt-5 text-center sm:px-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="font-display text-2xl font-black tracking-tight text-foreground">
              Invalid or Expired Link
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6 text-muted-foreground">
              This recovery link is no longer valid. Request a new reset email
              to continue.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
            <Button asChild className="h-11 rounded-xl px-5 text-sm">
              <Link href="/forgot-password">Request a New Link</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="gap-0 overflow-hidden border-border/60 bg-card/95 py-0 shadow-md shadow-primary/10">
        <div
          className="relative min-h-32 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary) / 0.72), hsl(var(--primary) / 0.72)), url(${reset_hero_image.src})`,
          }}
        >
          <div className="flex h-full flex-col justify-end gap-1.5 p-3 text-primary-foreground">
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-black tracking-tight">
                Reset Your Password
              </h1>
              <p className="max-w-sm text-[11px] leading-5 text-primary-foreground/90">
                Create a secure new password for your academic account.
              </p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-4 px-5 pb-5 pt-4 sm:px-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  className="h-12 rounded-xl border-border/70 bg-muted pl-11 pr-12 text-sm"
                  placeholder="Enter a strong password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showNewPassword ? "Hide password" : "Show password"
                  }
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  className="h-12 rounded-xl border-border/70 bg-muted pl-11 pr-12 text-sm"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/70 p-3">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                Security Requirements
              </p>
              <ul className="space-y-3">
                <RequirementRow
                  met={passwordChecks.minLength}
                  label="At least 8 characters long"
                />
                <RequirementRow
                  met={passwordChecks.uppercase}
                  label="Include at least one uppercase letter (A-Z)"
                />
                <RequirementRow
                  met={passwordChecks.numberOrSpecial}
                  label="Include at least one number or special character"
                />
                <RequirementRow
                  met={passwordChecks.matches}
                  label="Passwords must match"
                />
              </ul>
            </div>

            {error ? (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-sm font-bold shadow-md shadow-primary/20"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/60 px-5 pb-5 pt-4 text-center sm:px-6">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Secured by UAF Enterprise Identity
          </div>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
