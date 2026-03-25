// apps/web/src/components/error/not-found-screen.tsx
/**
 * Institution-branded 404 recovery screen.
 *
 * The page is designed as a calm operational dead-end, not as a playful meme
 * page. It reassures the user that the application is still intact and routes
 * them back into the correct surface depending on whether a valid session is
 * present.
 */

import Link from "next/link";
import * as React from "react";
import { Compass, Home } from "lucide-react";

import { ErrorPageShell } from "@/components/error/error-page-shell";
import { LibraryNotFoundIllustration } from "@/components/error/library-not-found-illustration";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface NotFoundScreenProps {
  primaryHref: string;
  primaryLabel: string;
}

export function NotFoundScreen({
  primaryHref,
  primaryLabel,
}: NotFoundScreenProps): React.JSX.Element {
  return (
    <ErrorPageShell>
      <div className="w-full max-w-3xl">
        <ScrollReveal direction="up" delayMs={20}>
          <div className="overflow-hidden rounded-4xl border border-border/60 bg-card/95 shadow-[0_30px_90px_-48px_hsl(var(--primary)/0.22)] backdrop-blur">
            <div className="border-b border-border/50 px-5 py-5 sm:px-8 sm:py-7">
              <ScrollReveal direction="down" delayMs={70}>
                <LibraryNotFoundIllustration />
              </ScrollReveal>
            </div>

            <div className="space-y-6 px-5 py-6 text-center sm:px-8 sm:py-8">
              <ScrollReveal direction="up-right" delayMs={90}>
                <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Error 404
                </div>
              </ScrollReveal>

              <ScrollReveal direction="up" delayMs={120}>
                <div className="space-y-3">
                  <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    Page Not Found
                  </h1>
                  <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    The page you are trying to access does not exist, may have
                    been moved, or the link may be incomplete. Please return to
                    a valid section of the UAF Smart E-Library.
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
                    <Link href={primaryHref}>
                      <Compass className="h-4 w-4" />
                      {primaryLabel}
                    </Link>
                  </Button>
                </div>
              </ScrollReveal>

              <ScrollReveal direction="left" delayMs={180}>
                <div className="space-y-4">
                  <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
                    If you reached this page from a saved bookmark or old link,
                    try returning to your dashboard and navigating again.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </ErrorPageShell>
  );
}
