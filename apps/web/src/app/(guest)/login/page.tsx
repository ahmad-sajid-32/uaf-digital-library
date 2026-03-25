import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/auth/login-screen";
import { getServerLoginRedirectPath } from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function LoginPage() {
  const user = await getSupabaseServerUser();
  const redirectPath = getServerLoginRedirectPath(user);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
