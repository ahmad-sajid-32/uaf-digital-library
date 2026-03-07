import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui/logo";

export default function GuestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-3.5 sm:px-7 lg:px-10">
          <Link
            href="/login"
            className="transition-opacity hover:opacity-90"
            aria-label="Go to login"
          >
            <Logo className="h-8" variant="full" />
          </Link>
          <ThemeToggle variant="compact" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-border/60 bg-background/95">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-2.5 px-6 py-4 text-center sm:px-8 lg:px-12">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Copyright 2026 University of Agriculture Faisalabad. All rights
            reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <Link
              href="/login"
              className="transition-colors hover:text-primary"
            >
              Privacy Policy
            </Link>
            <span className="text-border">/</span>
            <Link
              href="/login"
              className="transition-colors hover:text-primary"
            >
              Terms of Use
            </Link>
            <span className="text-border">/</span>
            <Link
              href="/login"
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
