// apps/web/src/components/providers/auth-provider.tsx
/**
 * Client-side auth provider for normalized application auth state.
 *
 * This provider subscribes to Supabase auth lifecycle events, maps the current
 * session through the normalization boundary, and exposes a lightweight
 * in-memory auth store for reactive UI. Password recovery/setup sessions are
 * suppressed from normal app routing while the password-link screen owns the
 * flow.
 */

"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";

import { mapSessionToAppAuthState } from "@/lib/auth/normalize-auth";
import { readAuthPreferenceSnapshot } from "@/lib/auth/preferences";
import {
  isPasswordRouteSessionFlowActive,
  isPasswordRouteSessionFlowMarked,
} from "@/lib/auth/session-client";
import type { AppAuthState } from "@/lib/auth/types";
import {
  getSupabaseBrowserClient,
  readSupabaseBrowserSession,
  readSupabaseBrowserUser,
} from "@/lib/supabase/client";

interface AuthContextValue {
  auth: AppAuthState;
  hydrated: boolean;
  refreshAuthState: () => Promise<void>;
  overrideProfileDisplayName: (fullName: string | null) => void;
  overrideProfileAvatarImageUrl: (avatarImageUrl: string | null) => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
);
const FALLBACK_AUTH_CONTEXT: AuthContextValue = {
  auth: getUnknownAuthState(),
  hydrated: false,
  refreshAuthState: async () => undefined,
  overrideProfileDisplayName: () => undefined,
  overrideProfileAvatarImageUrl: () => undefined,
};

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

function shouldSuppressPasswordRouteAuthState(auth: AppAuthState): boolean {
  const passwordFlowIsActive =
    isPasswordRouteSessionFlowActive() || isPasswordRouteSessionFlowMarked();

  if (!passwordFlowIsActive) {
    return false;
  }

  return (
    auth.status === "authenticated" ||
    auth.status === "verification_required" ||
    auth.status === "access_denied"
  );
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [auth, setAuth] = React.useState<AppAuthState>(getUnknownAuthState);
  const [hydrated, setHydrated] = React.useState(false);
  const refreshInFlightRef = React.useRef<Promise<void> | null>(null);
  const profileDisplayNameOverrideRef = React.useRef<string | null>(null);
  const profileAvatarImageUrlOverrideRef = React.useRef<
    string | null | undefined
  >(undefined);

  const applyAuthState = React.useCallback((nextAuth: AppAuthState) => {
    const effectiveNextAuth = shouldSuppressPasswordRouteAuthState(nextAuth)
      ? mapClientSession(null)
      : nextAuth;
    const activeOverride =
      effectiveNextAuth.status === "authenticated"
        ? profileDisplayNameOverrideRef.current
        : null;
    const activeAvatarImageUrlOverride =
      effectiveNextAuth.status === "authenticated"
        ? profileAvatarImageUrlOverrideRef.current
        : undefined;

    if (effectiveNextAuth.status !== "authenticated") {
      profileDisplayNameOverrideRef.current = null;
      profileAvatarImageUrlOverrideRef.current = undefined;
    }

    const resolvedAuth =
      effectiveNextAuth.status === "authenticated"
        ? {
            ...effectiveNextAuth,
            fullName: activeOverride || effectiveNextAuth.fullName,
            avatarImageUrl:
              activeAvatarImageUrlOverride !== undefined
                ? activeAvatarImageUrlOverride
                : effectiveNextAuth.avatarImageUrl,
          }
        : effectiveNextAuth;

    React.startTransition(() => {
      setAuth(resolvedAuth);
      setHydrated(true);
    });
  }, []);

  const overrideProfileDisplayName = React.useCallback(
    (fullName: string | null) => {
      const normalizedFullName =
        typeof fullName === "string" && fullName.trim()
          ? fullName.trim()
          : null;

      profileDisplayNameOverrideRef.current = normalizedFullName;

      React.startTransition(() => {
        setAuth((currentAuth) => {
          if (currentAuth.status !== "authenticated") {
            return currentAuth;
          }

          return {
            ...currentAuth,
            fullName: normalizedFullName,
          };
        });
      });
    },
    [],
  );

  const overrideProfileAvatarImageUrl = React.useCallback(
    (avatarImageUrl: string | null) => {
      const normalizedAvatarImageUrl =
        typeof avatarImageUrl === "string" && avatarImageUrl.trim()
          ? avatarImageUrl.trim()
          : null;

      profileAvatarImageUrlOverrideRef.current = normalizedAvatarImageUrl;

      React.startTransition(() => {
        setAuth((currentAuth) => {
          if (currentAuth.status !== "authenticated") {
            return currentAuth;
          }

          return {
            ...currentAuth,
            avatarImageUrl: normalizedAvatarImageUrl,
          };
        });
      });
    },
    [],
  );

  const refreshAuthState = React.useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshPromise = (async () => {
      if (
        isPasswordRouteSessionFlowActive() ||
        isPasswordRouteSessionFlowMarked()
      ) {
        applyAuthState(mapClientSession(null));
        return;
      }

      const { user, error: userError } = await readSupabaseBrowserUser();

      if (userError || !user) {
        applyAuthState(mapClientSession(null));
        return;
      }

      const { session, error } = await readSupabaseBrowserSession();

      if (error || !session) {
        applyAuthState(mapClientSession(null));
        return;
      }

      applyAuthState(mapClientSession(session));
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [applyAuthState]);

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    void refreshAuthState().catch(() => undefined);

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
          applyAuthState(mapClientSession(session));
          return;
        case "INITIAL_SESSION":
          void refreshAuthState().catch(() => undefined);
          return;
        case "SIGNED_OUT":
          applyAuthState(mapClientSession(null));
          return;
        default:
          return;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applyAuthState, refreshAuthState]);

  const contextValue = React.useMemo<AuthContextValue>(
    () => ({
      auth,
      hydrated,
      refreshAuthState,
      overrideProfileDisplayName,
      overrideProfileAvatarImageUrl,
    }),
    [
      auth,
      hydrated,
      overrideProfileAvatarImageUrl,
      overrideProfileDisplayName,
      refreshAuthState,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return React.useContext(AuthContext) ?? FALLBACK_AUTH_CONTEXT;
}
