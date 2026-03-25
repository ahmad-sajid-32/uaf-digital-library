// apps/web/src/components/auth/session-expired-screen.tsx
/**
 * Session-expired state screen.
 *
 * This screen gives users a clear recovery path when a previously valid session
 * is no longer usable and the app wants to direct them back into a clean login
 * flow.
 */

"use client";

import * as React from "react";
import { ClockAlert, LogIn } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";

export function SessionExpiredScreen(): React.JSX.Element {
  return (
    <AuthStateScreen
      icon={ClockAlert}
      iconTone="warning"
      title="Session Expired"
      description="Your previous session is no longer valid, or it timed out before the application could continue safely."
      message="Sign in again to restore access. If this happened during an active workflow, re-open the feature after signing back in."
      actionLabel="Go to Login"
      actionLoadingLabel="Redirecting..."
      actionIcon={LogIn}
      secondaryLabel="Back to Login"
      secondaryHref="/login?auth=session-expired"
    />
  );
}
