// apps/web/src/components/providers/auth-provider.tsx
/**
 * Client-side auth provider for normalized application auth state.
 *
 * This provider does not invent a parallel auth system. It subscribes to
 * Supabase auth lifecycle events, maps the current session through the
 * normalization boundary, and exposes a lightweight in-memory auth store for
 * reactive UI. Real route protection still belongs to SSR and middleware in
 * later passes.
 */

"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";

import { mapSessionToAppAuthState } from "@/lib/auth/normalize-auth";
import { readAuthPreferenceSnapshot } from "@/lib/auth/preferences";
import type { AppAuthState } from "@/lib/auth/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthContextValue {
  auth: AppAuthState;
  hydrated: boolean;
  refreshAuthState: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function mapClientSession(session: Session | null): AppAuthState {
  const preferences = readAuthPreferenceSnapshot();

  return mapSessionToAppAuthState(session, {
    rememberMe: preferences.rememberMe,
    preferredTimezone: preferences.preferredTimezone,
  });
}

function getUnknownAuthState(): AppAuthState {
  return {
    ...mapClientSession(null),
    status: "unknown",
  };
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [auth, setAuth] = React.useState<AppAuthState>(getUnknownAuthState);
  const [hydrated, setHydrated] = React.useState(false);

  const refreshAuthState = React.useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      React.startTransition(() => {
        setAuth(mapClientSession(null));
        setHydrated(true);
      });
      return;
    }

    React.startTransition(() => {
      setAuth(mapClientSession(data.session));
      setHydrated(true);
    });
  }, []);

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    void refreshAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      switch (event) {
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
        case "INITIAL_SESSION":
          React.startTransition(() => {
            setAuth(mapClientSession(session));
            setHydrated(true);
          });
          return;
        case "SIGNED_OUT":
          React.startTransition(() => {
            setAuth(mapClientSession(null));
            setHydrated(true);
          });
          return;
        default:
          return;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshAuthState]);

  const contextValue = React.useMemo<AuthContextValue>(
    () => ({
      auth,
      hydrated,
      refreshAuthState,
    }),
    [auth, hydrated, refreshAuthState],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider.");
  }

  return context;
}
