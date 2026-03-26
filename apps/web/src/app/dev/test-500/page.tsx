import { notFound } from "next/navigation";

import { Error500Page } from "@/components/error/error-500-page";
import {
  getRoleDashboardPath,
  resolveServerAuthResolution,
} from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function Test500Page() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const user = await getSupabaseServerUser();
  const auth = resolveServerAuthResolution(user);
  const hasDashboard = auth.status === "authenticated" && Boolean(auth.role);
  const dashboardHref =
    hasDashboard && auth.role ? getRoleDashboardPath(auth.role) : "/login";

  return (
    <Error500Page
      showBackHome={!hasDashboard}
      showDashboardAction
      dashboardHref={dashboardHref}
      dashboardLabel={hasDashboard ? "Go to Dashboard" : "Back to Login"}
    />
  );
}
