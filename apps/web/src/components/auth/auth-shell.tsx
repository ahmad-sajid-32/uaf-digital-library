import * as React from "react";

import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthShell({
  children,
  className,
}: AuthShellProps): React.JSX.Element {
  return <div className={cn("w-full max-w-md", className)}>{children}</div>;
}
