"use client";

import * as React from "react";

import { Error500Page } from "@/components/error/error-500-page";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("WEB: global error boundary triggered", {
      digest: error.digest ?? null,
      name: error.name,
    });
    console.error(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Error500Page
            onRetry={reset}
            showBackHome
            showDashboardAction
            dashboardHref="/login"
            dashboardLabel="Back to Login"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
