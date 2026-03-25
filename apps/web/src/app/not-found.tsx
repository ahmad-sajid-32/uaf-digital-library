import { NotFoundScreen } from "@/components/error/not-found-screen";
import {
  getRoleDashboardPath,
  resolveServerAuthResolution,
} from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

function getPrimaryCta(authStatus: ReturnType<typeof resolveServerAuthResolution>) {
  if (authStatus.status === "authenticated" && authStatus.role) {
    const roleLabel =
      authStatus.role.charAt(0).toUpperCase() + authStatus.role.slice(1);

    return {
      href: getRoleDashboardPath(authStatus.role),
      label: `Go to ${roleLabel} Dashboard`,
    };
  }

  return {
    href: "/login",
    label: "Back to Login",
  };
}

export default async function NotFound() {
  const user = await getSupabaseServerUser();
  const auth = resolveServerAuthResolution(user);
  const primaryCta = getPrimaryCta(auth);

  return (
    <NotFoundScreen
      primaryHref={primaryCta.href}
      primaryLabel={primaryCta.label}
    />
  );
}
