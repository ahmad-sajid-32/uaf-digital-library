// apps/web/src/components/error/library-runtime-error-illustration.tsx
/**
 * Branded illustration for the application 500 surface.
 *
 * The visual language communicates a temporary system interruption without
 * turning the screen into an alarm panel: a library terminal, books, ambient
 * glow, and a restrained warning pulse. The background number and bookshelf
 * layer remain unchanged so the error system still reads as a unified set.
 */

import * as React from "react";
import { BookOpenText, Monitor, TriangleAlert } from "lucide-react";

export function LibraryRuntimeErrorIllustration(): React.JSX.Element {
  return (
    <div className="relative isolate mx-auto flex h-64 w-full max-w-xl items-center justify-center overflow-hidden rounded-4xl border border-border/60 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.22),transparent_42%),radial-gradient(circle_at_70%_24%,hsl(var(--warning)/0.14),transparent_28%),linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--background)))] px-6 py-8 shadow-[0_30px_80px_-40px_hsl(var(--primary)/0.32)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background via-background/45 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--foreground)/0.05),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[120px] font-black tracking-[0.18em] text-foreground/5 sm:text-[150px]">
        500
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
        className="hidden md:block pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="runtimeLine500" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--warning))" />
          </linearGradient>
        </defs>
        <path
          d="M94 88 C134 74, 180 84, 222 112"
          fill="none"
          stroke="url(#runtimeLine500)"
          strokeDasharray="10 9"
          strokeLinecap="round"
          strokeWidth="3.5"
          opacity="0.76"
        />
        <path
          d="M300 116 C340 90, 380 88, 430 102"
          fill="none"
          stroke="url(#runtimeLine500)"
          strokeDasharray="10 9"
          strokeLinecap="round"
          strokeWidth="3.5"
          opacity="0.76"
        />
      </svg>

      <div className="relative flex w-full items-center justify-center md:hidden">
        <div className="relative flex h-38 w-38 items-center justify-center rounded-full border border-primary/25 bg-primary/10 shadow-[0_0_36px_hsl(var(--primary)/0.18)]">
          <div className="absolute inset-5 rounded-full border border-border/50 bg-background/80" />
          <div className="relative flex h-22 w-22 items-center justify-center rounded-[1.7rem] border border-border/50 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)))] text-primary shadow-[0_18px_42px_-24px_hsl(var(--foreground)/0.26)]">
            <Monitor className="h-9 w-9" />
            <div className="pointer-events-none absolute inset-x-4 top-5 h-px bg-foreground/16" />
            <div className="pointer-events-none absolute inset-x-4 top-8 h-px bg-warning/30" />
            <div className="pointer-events-none absolute inset-x-4 top-11 h-px bg-danger/26" />
          </div>
          <div className="absolute left-5 bottom-8 flex h-10 w-10 items-center justify-center rounded-full border border-warning/30 bg-warning/10 text-warning">
            <BookOpenText className="h-4 w-4" />
          </div>
          <div className="absolute right-5 top-8 flex h-10 w-10 items-center justify-center rounded-full border border-danger/25 bg-danger/10 text-danger">
            <TriangleAlert className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="relative hidden w-full max-w-118 items-center justify-between gap-5 md:flex">
        <div className="relative flex h-18 w-18 shrink-0 mb-7 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-[0_0_28px_hsl(var(--foreground)/0.26)]">
          <BookOpenText className="h-7 w-7 " />
          <div className="absolute inset-2 rounded-full border border-primary/16" />
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-10 top-1/2 h-28 -translate-y-1/2 rounded-full bg-primary/18 blur-3xl" />
          <div className="relative mx-auto h-46 w-full max-w-70">
            <div className="absolute left-1/2 top-1 h-5 w-26 -translate-x-1/2 rounded-full bg-warning/24 blur-xl" />
            <div className="absolute inset-x-[18%] top-[12%] h-[72%] rounded-4xl border border-border/60 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)))] shadow-[0_30px_60px_-28px_hsl(var(--foreground)/0.3)]" />
            <div className="absolute inset-x-[24%] top-[20%] h-[56%] rounded-[1.6rem] border border-border/45 bg-background/82" />
            <div className="absolute left-1/2 top-[34%] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-3xl border border-primary/28 bg-primary/10 text-primary shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
              <Monitor className="h-8 w-8" />
            </div>
          </div>
        </div>
        <div className="relative flex h-18 w-18 shrink-0 items-center justify-center rounded-full border border-warning/25 bg-warning/10 text-warning shadow-[0_0_28px_hsl(var(--warning)/0.16)]">
          <TriangleAlert className="h-7 w-7" />
          <div className="absolute inset-2 rounded-full border border-warning/16" />
        </div>
      </div>
    </div>
  );
}
