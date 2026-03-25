import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui/logo";

export default function GuestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-7 sm:py-3.5 lg:px-10">
          <Link
            href="/login"
            className="min-w-0 transition-opacity hover:opacity-90"
            aria-label="Go to login"
          >
            <Logo className="h-7 sm:h-8" variant="full" />
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
