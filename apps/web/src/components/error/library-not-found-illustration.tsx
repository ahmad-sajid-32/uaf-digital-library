// apps/web/src/components/error/library-not-found-illustration.tsx
/**
 * Branded illustration for the application 404 surface.
 *
 * The visual direction stays academic and calm: a floating book, a broken
 * route line, a magnifier, and quiet bookshelf silhouettes. It intentionally
 * avoids meme/comedic error-page tropes so the screen remains consistent with
 * the institutional product tone.
 */

import * as React from "react";
import { Search, TriangleAlert } from "lucide-react";

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
        className="pointer-events-none hidden md:block absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="routeLine" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--warning))" />
          </linearGradient>
        </defs>
        <path
          d="M76 72 C126 58, 170 88, 218 98"
          fill="none"
          stroke="url(#routeLine)"
          strokeDasharray="8 10"
          strokeLinecap="round"
          strokeWidth="3.5"
          opacity="0.92"
        />
        <path
          d="M304 106 C344 118, 386 92, 440 88"
          fill="none"
          stroke="url(#routeLine)"
          strokeDasharray="8 10"
          strokeLinecap="round"
          strokeWidth="3.5"
          opacity="0.72"
        />
        <circle cx="255" cy="102" r="5" fill="hsl(var(--warning))" />
      </svg>

      <div className="relative hidden  md:flex w-full max-w-120 items-center justify-between gap-4">
        <div className="relative mt-16 h-28 w-28 shrink-0 rounded-full border border-primary/35 bg-primary/10 shadow-[0_0_50px_hsl(var(--primary)/0.26)]">
          <div className="absolute inset-4 rounded-full border border-border/50 bg-background/75" />
          <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-warning/30 bg-warning/10 text-warning">
            <Search className="h-6 w-6" />
          </div>
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-danger/35 bg-danger/10 text-danger shadow-[0_0_32px_hsl(var(--danger)/0.22)]">
          <TriangleAlert className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
