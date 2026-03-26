// apps/web/src/components/error/error-back-button.tsx
/**
 * Safe back-navigation control for error surfaces.
 *
 * The button prefers returning to the previous in-app page when that history
 * entry appears to belong to the same origin. If not, it falls back to a safe
 * internal destination instead of sending the user to an unrelated or empty
 * history target.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

interface ErrorBackButtonProps {
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
}

export function ErrorBackButton({
  fallbackHref,
  children,
  className,
}: ErrorBackButtonProps): React.JSX.Element {
  const router = useRouter();

  const handleClick = () => {
    const hasHistory = window.history.length > 1;
    const hasSafeReferrer =
      typeof document.referrer === "string" &&
      document.referrer.startsWith(window.location.origin);

    if (hasHistory && hasSafeReferrer) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
}
