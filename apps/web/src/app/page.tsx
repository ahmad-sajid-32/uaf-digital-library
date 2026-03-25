import { redirect } from "next/navigation";

import { getServerLoginRedirectPath } from "@/lib/auth/server-guard";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function Home(): Promise<never> {
  const user = await getSupabaseServerUser();
  const redirectPath = getServerLoginRedirectPath(user) ?? "/login";

  redirect(redirectPath);
}
