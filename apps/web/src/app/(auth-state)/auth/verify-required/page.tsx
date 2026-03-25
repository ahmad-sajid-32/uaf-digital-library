import { redirect } from "next/navigation";

import { VerifyRequiredScreen } from "@/components/auth/verify-required-screen";
import { getAuthStateRouteRedirectPath } from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function VerifyRequiredPage() {
  const user = await getSupabaseServerUser();
  const redirectPath = getAuthStateRouteRedirectPath("/auth/verify-required", user);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <VerifyRequiredScreen />;
}
