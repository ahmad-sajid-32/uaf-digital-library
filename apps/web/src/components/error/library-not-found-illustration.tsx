// apps/web/src/components/error/library-not-found-illustration.tsx
/**
 * Branded illustration for the application 404 surface.
 *
 * The visual direction stays academic and calm: a floating open book, a broken
 * route line, a magnifier, and a restrained warning marker. The background
 * number and bookshelf layer remain unchanged so the error system feels
 * consistent across screens.
 */

import * as React from "react";
import { BookOpenText, Search, TriangleAlert } from "lucide-react";

export function LibraryNotFoundIllustration(): React.JSX.Element {
  return (
    <div className="relative isolate mx-auto flex h-64 w-full max-w-xl items-center justify-center overflow-hidden rounded-4xl border border-border/60 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.24),transparent_45%),radial-gradient(circle_at_75%_30%,hsl(var(--warning)/0.16),transparent_30%),linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--background)))]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background via-background/50 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--foreground)/0.06),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[100px] font-black tracking-[0.18em] text-foreground/5 sm:text-[150px]">
        404
      </div>

      <div className="pointer-events-none absolute inset-x-10 bottom-4 flex items-end justify-center gap-2 opacity-70">
        {[
          "h-10",
          "h-12",
          "h-14",
          "h-9",
          "h-16",
          "h-11",
          "h-13",
          "h-10",
          "h-12",
          "h-9",
        ].map((heightClass, index) => (
          <div
            key={`${heightClass}-${index}`}
            className={`w-6 rounded-t-md bg-linear-to-b from-muted-foreground/35 to-foreground/18 ${heightClass}`}
          />
        ))}
      </div>

      <svg
        viewBox="0 0 520 260"
        className="hidden lg:block pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="routeLine404" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--warning))" />
          </linearGradient>
        </defs>
        <path
          d="M74 86 C116 62, 164 78, 214 102"
          fill="none"
          stroke="url(#routeLine404)"
          strokeDasharray="9 10"
          strokeLinecap="round"
          strokeWidth="3.5"
          opacity="0.72"
        />
        <path
          d="M308 106 C348 88, 390 80, 444 98"
          fill="none"
          stroke="url(#routeLine404)"
          strokeDasharray="9 10"
          strokeLinecap="round"
          strokeWidth="3.5"
          opacity="0.72"
        />
        <circle cx="258" cy="104" r="5" fill="hsl(var(--warning))" />
      </svg>

      <div className="relative flex w-full items-center justify-center md:hidden">
        <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-primary/25 bg-primary/10 shadow-[0_0_36px_hsl(var(--primary)/0.2)]">
          <div className="absolute inset-5 rounded-full border border-border/50 bg-background/80" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-border/50 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--secondary)))] text-primary shadow-[0_18px_40px_-22px_hsl(var(--foreground)/0.28)]">
            <BookOpenText className="h-9 w-9" />
          </div>
          <div className="absolute right-5 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-warning/30 bg-warning/10 text-warning">
            <Search className="h-4 w-4" />
          </div>
          <div className="absolute bottom-6 left-5 flex h-10 w-10 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger">
            <TriangleAlert className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="relative hidden w-full max-w-118 items-center justify-between gap-5 md:flex">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-warning/25 bg-warning/10 shadow-[0_0_40px_hsl(var(--warning)/0.16)]">
          <div className="absolute inset-4 rounded-full border border-border/50 bg-warning/25" />
          <Search className="relative h-8 w-8 text-warning" />
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-x-10 top-1/2 h-28 -translate-y-1/2 rounded-full bg-primary/18 blur-3xl" />
          <div className="relative mx-auto h-46 w-full max-w-70">
            <div className="absolute left-1/2 top-1 h-5 w-26 -translate-x-1/2 rounded-full bg-warning/24 blur-xl" />
            <div className="absolute inset-x-[18%] top-[12%] h-[72%] rounded-4xl border border-border/60 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)))] shadow-[0_30px_60px_-28px_hsl(var(--foreground)/0.3)]" />
            <div className="absolute inset-x-[24%] top-[20%] h-[56%] rounded-[1.6rem] border border-border/45 bg-background/82" />
            <div className="absolute left-1/2 top-[34%] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-3xl border border-primary/28 bg-primary/10 text-primary shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
              <BookOpenText className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-danger/28 bg-danger/10 text-danger shadow-[0_0_32px_hsl(var(--danger)/0.18)]">
          <TriangleAlert className="h-8 w-8" />
          <div className="absolute inset-2 rounded-full border border-danger/18" />
        </div>
      </div>
    </div>
  );
}
