import { redirect } from "next/navigation";

import { getProtectedRoleRedirectPath } from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSupabaseServerUser();
  const redirectPath = getProtectedRoleRedirectPath(user, "admin");

  if (redirectPath) {
    redirect(redirectPath);
  }

  return children;
}
