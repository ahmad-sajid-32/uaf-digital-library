// apps/web/src/components/auth/protected-route-shell.tsx
/**
 * Lightweight protected route shell wrapper.
 *
 * This wrapper gives protected role routes a consistent page frame while the
 * actual dashboard modules are still placeholders. It is not an authorization
 * primitive; middleware and server layouts provide the protection.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

interface ProtectedRouteShellProps {
  children: React.ReactNode;
  className?: string;
}

export function ProtectedRouteShell({
  children,
  className,
}: ProtectedRouteShellProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_38%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--background)))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
