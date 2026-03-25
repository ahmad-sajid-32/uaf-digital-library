// apps/web/src/lib/supabase/middleware.ts
/**
 * Middleware-oriented Supabase SSR helper for Next.js request handling.
 *
 * This file prepares the coarse auth gate used later by `apps/web/middleware.ts`.
 * It wires Supabase SSR cookie synchronization into a request/response pair so
 * middleware can validate the current user without inventing a parallel cookie
 * system.
 */

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseMiddlewareEnv(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
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

export interface SupabaseMiddlewareClient {
  supabase: SupabaseClient;
  getResponse: () => NextResponse;
}

export function createSupabaseMiddlewareClient(
  request: NextRequest,
): SupabaseMiddlewareClient {
  const { supabaseUrl: url, supabaseAnonKey: anonKey } =
    getSupabaseMiddlewareEnv();
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return {
    supabase,
    getResponse: () => response,
  };
}
