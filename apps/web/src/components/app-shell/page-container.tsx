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
    <div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {hasHeader ? (
        <ScrollReveal direction="up" delayMs={20}>
          <section className="rounded-[1.75rem] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 space-y-2">
                {eyebrow ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    {eyebrow}
                  </p>
                ) : null}
                {title ? (
                  <h1 className="font-display text-3xl font-black tracking-tight text-foreground">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {description}
                  </p>
                ) : null}
              </div>

              {actions ? (
                <div className="flex shrink-0 items-center gap-3">{actions}</div>
              ) : null}
            </div>
          </section>
        </ScrollReveal>
      ) : null}

      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-[1.75rem] p-4 shadow-sm shadow-primary/5 sm:p-6",
        )}
      >
        {children}
      </section>
    </div>
  );
}
