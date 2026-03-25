import { redirect } from "next/navigation";

import { AccessDeniedScreen } from "@/components/auth/access-denied-screen";
import { getAuthStateRouteRedirectPath } from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function AccessDeniedPage() {
  const user = await getSupabaseServerUser();
  const redirectPath = getAuthStateRouteRedirectPath("/auth/access-denied", user);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <AccessDeniedScreen />;
}
