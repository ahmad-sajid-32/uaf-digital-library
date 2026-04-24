// apps/web/src/components/app-shell/page-container.tsx
/**
 * Shared page container for authenticated shell pages.
 *
 * Purpose:
 * - Provide one consistent page header and content surface inside the shell.
 * - Keep page-level spacing, header hierarchy, and action-slot behavior stable
 *   across later admin, librarian, and student modules.
 */

"use client";

import * as React from "react";

import type { PageContainerProps } from "@/components/app-shell/contracts";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { cn } from "@/lib/utils";

export function PageContainer({
  title,
  eyebrow,
  description,
  actions,
  children,
}: PageContainerProps): React.JSX.Element {
  const hasHeader = Boolean(title || eyebrow || description || actions);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {hasHeader ? (
        <ScrollReveal direction="up" delayMs={20}>
          <section className="header-glass rounded-[2rem] border border-border/10 px-5 py-6 shadow-lg shadow-primary/10 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 space-y-2">
                {eyebrow ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    {eyebrow}
                  </p>
                ) : null}
                {title ? (
                  <h1 className="text-page-title font-display font-black tracking-tight text-foreground">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base lg:text-lg">
                    {description}
                  </p>
                ) : null}
              </div>

              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
              ) : null}
            </div>
          </section>
        </ScrollReveal>
      ) : null}

      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-[2rem] border border-border/20 bg-background/90 p-4 shadow-xl shadow-primary/5 backdrop-blur-sm sm:p-6",
        )}
      >
        {children}
      </section>
    </div>
  );
}
