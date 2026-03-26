// apps/web/src/components/error/forbidden-screen.tsx
/**
 * Institution-branded 403 recovery screen.
 *
 * This screen communicates intentional access restriction inside a working
 * system. It is role-aware and routes the user back to a valid area without
 * framing the denial as a server failure.
 */

import Link from "next/link";
import * as React from "react";
import { Compass } from "lucide-react";

import { ErrorBackButton } from "@/components/error/error-back-button";
import { LibraryForbiddenIllustration } from "@/components/error/library-forbidden-illustration";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface ForbiddenScreenProps {
  dashboardHref: string;
}

export function ForbiddenScreen({
  dashboardHref,
}: ForbiddenScreenProps): React.JSX.Element {
  return (
    <div className="w-full max-w-3xl">
      <ScrollReveal direction="up" delayMs={20}>
        <div className="overflow-hidden rounded-4xl border border-border/60 bg-card/95 shadow-[0_30px_90px_-48px_hsl(var(--primary)/0.22)] backdrop-blur">
          <div className="border-b border-border/50 px-5 py-5 sm:px-8 sm:py-7">
            <ScrollReveal direction="down" delayMs={70}>
              <LibraryForbiddenIllustration />
            </ScrollReveal>
          </div>

          <div className="space-y-6 px-5 py-6 text-center sm:px-8 sm:py-8">
            <ScrollReveal direction="up-right" delayMs={90}>
              <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Error 403
              </div>
            </ScrollReveal>

            <ScrollReveal direction="up" delayMs={120}>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                  Access Restricted
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  You are signed in, but you do not have permission to view this
                  page or use this section of the UAF Smart E-Library. Please
                  return to an area available for your account.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delayMs={150}>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-xl px-6 text-sm font-bold shadow-md shadow-primary/30"
                >
                  <Link href={dashboardHref}>
                    <Compass className="h-4 w-4" />
                    Go to My Dashboard
                  </Link>
                </Button>
                <ErrorBackButton
                  fallbackHref={dashboardHref}
                  className="h-12 rounded-xl border-border/70 bg-background/70 px-6 text-sm font-semibold text-foreground hover:bg-accent/15 hover:text-foreground"
                >
                  Back to Previous Page
                </ErrorBackButton>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="left" delayMs={180}>
              <div className="space-y-4">
                <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
                  If you believe you should have access to this section, contact
                  the library administration or system administrator for role
                  verification.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
