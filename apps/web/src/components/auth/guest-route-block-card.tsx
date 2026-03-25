// apps/web/src/components/auth/guest-route-block-card.tsx
/**
 * Shared blocked-session UI for guest auth routes.
 *
 * This keeps login and forgot-password screens from rendering their forms when
 * the current browser session is already authenticated.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, ShieldAlert } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GuestRouteBlockCardProps {
  title: string;
  description: string;
  actionLabel: string;
  actionLoadingLabel: string;
  loading?: boolean;
  onAction: () => void | Promise<void>;
}

export function GuestRouteBlockCard({
  title,
  description,
  actionLabel,
  actionLoadingLabel,
  loading = false,
  onAction,
}: GuestRouteBlockCardProps): React.JSX.Element {
  return (
    <AuthShell>
      <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
        <CardHeader className="space-y-4 px-5 pt-5 text-center sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="font-display text-2xl font-black tracking-tight text-foreground">
            {title}
          </CardTitle>
          <CardDescription className="px-0 text-sm leading-6 text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-5 pb-5 sm:px-6">
          <Button
            type="button"
            className="h-12 w-full rounded-xl text-sm font-bold shadow-md shadow-primary/20"
            disabled={loading}
            onClick={() => {
              void onAction();
            }}
          >
            {loading ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                {actionLoadingLabel}
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
          <Button
            asChild
            variant="ghost"
            className="h-auto p-0 text-sm font-semibold text-primary hover:bg-transparent hover:text-primary/80"
          >
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
