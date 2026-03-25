import { redirect } from "next/navigation";

import { getProtectedRoleRedirectPath } from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function LibrarianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSupabaseServerUser();
  const redirectPath = getProtectedRoleRedirectPath(user, "librarian");

  if (redirectPath) {
    redirect(redirectPath);
  }

  return children;
}
