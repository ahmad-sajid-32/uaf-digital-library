// apps/web/src/components/error/error-500-page.tsx
/**
 * Reusable branded 500-style recovery page.
 *
 * This component is used by App Router error boundaries and by a dev-only
 * preview route. It intentionally avoids exposing raw error details and keeps
 * recovery actions focused on retrying or returning to a safe internal area.
 */

"use client";

import Link from "next/link";
import * as React from "react";
import { Compass, RotateCcw } from "lucide-react";

import { ErrorPageShell } from "@/components/error/error-page-shell";
import { LibraryRuntimeErrorIllustration } from "@/components/error/library-runtime-error-illustration";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface Error500PageProps {
  onRetry?: () => void;
  showBackHome?: boolean;
  showDashboardAction?: boolean;
  dashboardHref?: string;
  dashboardLabel?: string;
}

export function Error500Page({
  onRetry,
  showBackHome = false,
  showDashboardAction = true,
  dashboardHref = "/login",
  dashboardLabel = "Go to Dashboard",
}: Error500PageProps): React.JSX.Element {
  const handleRetry = React.useCallback(() => {
    if (onRetry) {
      onRetry();
      return;
    }

    window.location.reload();
  }, [onRetry]);

  return (
    <ErrorPageShell>
      <div className="w-full max-w-3xl">
        <ScrollReveal direction="up" delayMs={20}>
          <div className="overflow-hidden rounded-4xl border border-border/60 bg-card/95 shadow-[0_30px_90px_-48px_hsl(var(--primary)/0.22)] backdrop-blur">
            <div className="border-b border-border/50 px-5 py-5 sm:px-8 sm:py-7">
              <ScrollReveal direction="down" delayMs={70}>
                <LibraryRuntimeErrorIllustration />
              </ScrollReveal>
            </div>

            <div className="space-y-6 px-5 py-6 text-center sm:px-8 sm:py-8">
              <ScrollReveal direction="up-right" delayMs={90}>
                <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Error 500
                </div>
              </ScrollReveal>

              <ScrollReveal direction="up" delayMs={120}>
                <div className="space-y-3">
                  <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    Something Went Wrong
                  </h1>
                  <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    The UAF Smart E-Library encountered an unexpected problem
                    while loading this page. Please try again, or return to a
                    safe section of the application.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal direction="right" delayMs={150}>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 rounded-xl px-6 text-sm font-bold shadow-md shadow-primary/30"
                    onClick={handleRetry}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                  {showDashboardAction ? (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="h-12 rounded-xl border-border/70 bg-background/70 px-6 text-sm font-semibold text-foreground hover:bg-accent/15 hover:text-foreground"
                    >
                      <Link href={dashboardHref}>
                        <Compass className="h-4 w-4" />
                        {dashboardLabel}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </ScrollReveal>

              <ScrollReveal direction="left" delayMs={180}>
                <div className="space-y-4">
                  <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
                    If this issue continues, return to your dashboard and try
                    again later. Repeated failures may indicate a temporary
                    service problem.
                  </p>

                  {showBackHome ? (
                    <div className="text-sm">
                      <Link
                        href="/login"
                        className="font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        Back to Login
                      </Link>
                    </div>
                  ) : null}
                </div>
              </ScrollReveal>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </ErrorPageShell>
  );
}
