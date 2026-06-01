// apps/web/src/lib/supabase/client.ts
import "client-only";

import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof window !== "undefined") {
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

let browserClient: SupabaseClient | null = null;
let serializedAuthOperation: Promise<void> = Promise.resolve();

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are missing. Check apps/web/.env.local.",
    );
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return browserClient;
}

async function runSerializedBrowserAuthOperation<T>(
  operation: (supabase: SupabaseClient) => Promise<T>,
): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  const result = serializedAuthOperation
    .catch(() => undefined)
    .then(() => operation(supabase));

  serializedAuthOperation = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

export async function readSupabaseBrowserSession(): Promise<{
  session: Session | null;
  error: Error | null;
}> {
  return runSerializedBrowserAuthOperation(async (supabase) => {
    const { data, error } = await supabase.auth.getSession();

    return {
      session: data.session,
      error,
    };
  });
}

export async function readSupabaseBrowserUser(): Promise<{
  user: User | null;
  error: Error | null;
}> {
  return runSerializedBrowserAuthOperation(async (supabase) => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return {
      user,
      error,
    };
  });
}
