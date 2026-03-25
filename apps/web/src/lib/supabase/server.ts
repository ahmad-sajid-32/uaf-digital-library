// apps/web/src/lib/supabase/server.ts
/**
 * Server-side Supabase SSR helpers for the Next.js frontend.
 *
 * This file provides the server-visible auth client used by layouts, server
 * components, and future route guards. The intended protection path is
 * `getUser()`, not a naive `getSession()` trust path, because validated user
 * retrieval is the safer server-side check for cookie-backed auth.
 */

import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseServerEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are missing. Check apps/web/.env.local.",
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { supabaseUrl: url, supabaseAnonKey: anonKey } = getSupabaseServerEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components may not be allowed to mutate cookies.
          // Middleware and route handlers are the proper write boundary.
        }
      },
    },
  });
}

export async function getSupabaseServerUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}
