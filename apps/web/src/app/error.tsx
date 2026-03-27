"use client";

import * as React from "react";

import { Error500Page } from "@/components/error/error-500-page";
import { getRoleDashboardPath } from "@/lib/auth/server-guard";
import { useAppAuth } from "@/hooks/useAppAuth";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { auth } = useAppAuth();

  React.useEffect(() => {
    console.error("WEB: app error boundary triggered", {
      digest: error.digest ?? null,
      name: error.name,
    });
    console.error(error);
  }, [error]);

  const hasDashboard = auth.status === "authenticated" && Boolean(auth.role);
  const dashboardHref =
    hasDashboard && auth.role ? getRoleDashboardPath(auth.role) : "/login";

  return (
    <Error500Page
      onRetry={reset}
      showBackHome={!hasDashboard}
      showDashboardAction
      dashboardHref={dashboardHref}
      dashboardLabel={hasDashboard ? "Go to Dashboard" : "Back to Login"}
    />
  );
}
