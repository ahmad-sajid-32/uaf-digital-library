import { redirect } from "next/navigation";

import { AccessDeniedScreen } from "@/components/auth/access-denied-screen";
import { ForbiddenScreen } from "@/components/error/forbidden-screen";
import {
  getAuthStateRouteRedirectPath,
  getRoleDashboardPath,
  resolveServerAuthResolution,
} from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const user = await getSupabaseServerUser();
  const { reason } = await searchParams;
  const redirectPath = getAuthStateRouteRedirectPath(
    "/auth/access-denied",
    user,
    reason ?? null,
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  const auth = resolveServerAuthResolution(user);

  if (reason === "forbidden" && auth.status === "authenticated" && auth.role) {
    return <ForbiddenScreen dashboardHref={getRoleDashboardPath(auth.role)} />;
  }

  return <AccessDeniedScreen />;
}
