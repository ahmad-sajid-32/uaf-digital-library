// apps/web/src/components/auth/password-link-state-card.tsx
/**
 * Shared state card for password setup and recovery routes.
 *
 * These routes are intentionally public, but they should still surface clear
 * invalid or expired-link states instead of silently collapsing into a login
 * redirect.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface PasswordLinkStateCardProps {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function PasswordLinkStateCard({
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: PasswordLinkStateCardProps): React.JSX.Element {
  return (
    <AuthShell>
      <ScrollReveal direction="up" delayMs={40}>
      <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
        <CardHeader className="space-y-4 px-5 pt-5 text-center sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="font-display text-2xl font-black tracking-tight text-foreground">
            {title}
          </CardTitle>
          <CardDescription className="px-0 text-sm leading-6 text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex flex-col gap-3 border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
          <Button asChild className="h-11 w-full rounded-xl text-sm">
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          {secondaryLabel && secondaryHref ? (
            <Button
              asChild
              variant="ghost"
              className="h-auto p-0 text-sm font-semibold text-primary hover:bg-transparent hover:text-primary/80"
            >
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          ) : null}
        </CardFooter>
      </Card>
      </ScrollReveal>
    </AuthShell>
  );
}
