import { redirect } from "next/navigation";

import {
  AuthenticatedRoleShell,
  buildInitialRoleShellUserSummary,
  getRoleShellLayoutConfig,
} from "@/components/app-shell";
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

  if (!user?.id || !user.email) {
    redirect("/login");
  }

  return (
    <AuthenticatedRoleShell
      layout={getRoleShellLayoutConfig("librarian")}
      initialUser={buildInitialRoleShellUserSummary({
        userId: user.id,
        email: user.email,
        role: "librarian",
        fullName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
      })}
    >
      {children}
    </AuthenticatedRoleShell>
  );
}
