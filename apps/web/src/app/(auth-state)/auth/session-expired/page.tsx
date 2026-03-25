import { redirect } from "next/navigation";

import { SessionExpiredScreen } from "@/components/auth/session-expired-screen";
import { getAuthStateRouteRedirectPath } from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function SessionExpiredPage() {
  const user = await getSupabaseServerUser();
  const redirectPath = getAuthStateRouteRedirectPath("/auth/session-expired", user);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <SessionExpiredScreen />;
}
