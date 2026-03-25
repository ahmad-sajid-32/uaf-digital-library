import * as React from "react";
import Image from "next/image";

import logoSmall from "../../assets/Logo_Small.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "icon" | "full";
}

export function Logo({
  className = "h-10 w-auto",
  variant = "full",
}: LogoProps): React.JSX.Element {
  const isFull = variant === "full";

  return (
    <div
      className={cn("inline-flex min-w-0 items-center gap-2 sm:gap-3", className)}
      aria-label="UAF Smart E-Library logo"
    >
      <Image
        src={logoSmall}
        alt="UAF Smart E-Library logo"
        className="h-full w-auto shrink-0 object-contain"
        draggable={false}
        priority
      />

      {isFull ? (
        <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap font-display text-sm font-bold tracking-tight sm:gap-1.5 sm:text-lg">
          <span className="text-foreground">UAF</span>
          <span className="text-primary">Smart</span>
          <span className="text-warning/80">E-Library</span>
        </div>
      ) : null}
    </div>
  );
}
