// apps/web/src/components/auth/auth-state-screen.tsx
/**
 * Shared screen shell for explicit auth transition states.
 *
 * These screens represent truthful application auth states such as
 * verification-required, access-denied, and session-expired. They are not
 * access-control mechanisms themselves; they present the user-facing recovery
 * path after middleware or login/session logic has already resolved the state.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, LoaderCircle } from "lucide-react";

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
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface AuthStateScreenProps {
  icon: LucideIcon;
  iconTone: "warning" | "danger" | "primary";
  title: string;
  description: string;
  message: string;
  actionLabel: string;
  actionLoadingLabel: string;
  actionIcon?: LucideIcon;
  actionLoading?: boolean;
  onAction?: () => void | Promise<void>;
  secondaryLabel?: string;
  secondaryHref?: string;
}

function resolveToneClasses(tone: AuthStateScreenProps["iconTone"]): string {
  switch (tone) {
    case "danger":
      return "bg-danger/10 text-danger";
    case "primary":
      return "bg-primary/10 text-primary";
    default:
      return "bg-warning/10 text-warning";
  }
}

export function AuthStateScreen({
  icon: Icon,
  iconTone,
  title,
  description,
  message,
  actionLabel,
  actionLoadingLabel,
  actionIcon: ActionIcon,
  actionLoading = false,
  onAction,
  secondaryLabel = "Back to Login",
  secondaryHref = "/login",
}: AuthStateScreenProps): React.JSX.Element {
  return (
    <AuthShell className="max-w-lg">
      <ScrollReveal direction="up" delayMs={40}>
      <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
        <CardHeader className="space-y-4 px-5 pt-5 text-center sm:px-6">
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${resolveToneClasses(iconTone)}`}
          >
            <Icon className="h-7 w-7" />
          </div>
          <CardTitle className="font-display text-2xl font-black tracking-tight text-foreground">
            {title}
          </CardTitle>
          <CardDescription className="px-0 text-sm leading-6 text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-5 pb-5 sm:px-6">
          <p className="rounded-xl border border-border/60 bg-muted/70 px-4 py-3 text-sm text-foreground">
            {message}
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
          {onAction ? (
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-sm font-bold shadow-md shadow-primary/20"
              disabled={actionLoading}
              onClick={() => {
                void onAction();
              }}
            >
              {actionLoading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  {actionLoadingLabel}
                </>
              ) : (
                <>
                  {ActionIcon ? <ActionIcon className="h-4 w-4" /> : null}
                  {actionLabel}
                </>
              )}
            </Button>
          ) : (
            <Button
              asChild
              className="h-12 w-full rounded-xl text-sm font-bold shadow-md shadow-primary/20"
            >
              <Link href={secondaryHref}>{actionLabel}</Link>
            </Button>
          )}

          <Button
            asChild
            variant="ghost"
            className="h-auto p-0 text-sm font-semibold text-primary hover:bg-transparent hover:text-primary/80"
          >
            <Link href={secondaryHref}>
              <ArrowLeft className="h-4 w-4" />
              {secondaryLabel}
            </Link>
          </Button>
        </CardFooter>
      </Card>
      </ScrollReveal>
    </AuthShell>
  );
}
