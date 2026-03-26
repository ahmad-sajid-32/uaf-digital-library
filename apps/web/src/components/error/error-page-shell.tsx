// apps/web/src/components/error/error-page-shell.tsx
/**
 * Shared shell for branded top-level error pages.
 *
 * This shell mirrors the guest/legal branding surface while keeping enough
 * flexibility for institution-focused 404, 403, and 500 screens. The shell is
 * intentionally full-screen and recovery-oriented instead of feeling like a
 * detached exception page.
 */

"use client";

import Link from "next/link";
import * as React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui/logo";

interface ErrorPageShellProps {
  children: React.ReactNode;
}

export function ErrorPageShell({
  children,
}: ErrorPageShellProps): React.JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--card))_42%,hsl(var(--background)))] text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-7 sm:py-3.5 lg:px-10">
          <Link
            href="/"
            className="min-w-0 transition-opacity hover:opacity-90"
            aria-label="Go to home"
          >
            <Logo className="h-7 sm:h-8" variant="full" />
          </Link>
          <ThemeToggle variant="compact" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-border/60 bg-background/95">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-2.5 px-6 py-4 text-center sm:px-8 lg:px-12">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Copyright {currentYear} University of Agriculture Faisalabad. All
            rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <Link
              href="/privacy-policy"
              className="transition-colors hover:text-primary"
            >
              Privacy Policy
            </Link>
            <span className="text-border">/</span>
            <Link
              href="/terms-of-use"
              className="transition-colors hover:text-primary"
            >
              Terms of Use
            </Link>
            <span className="text-border">/</span>
            <Link
              href="/library-rules"
              className="transition-colors hover:text-primary"
            >
              Library Rules
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
