// apps/web/src/components/app-shell/user-avatar-menu.tsx
/**
 * Avatar-driven user menu for the authenticated shell.
 *
 * Purpose:
 * - Present the current signed-in user summary in one consistent menu surface.
 * - Keep profile navigation and logout action together.
 * - Reuse existing dropdown and avatar primitives instead of inventing a new
 *   overlay pattern.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import type { UserAvatarMenuProps } from "@/components/app-shell/contracts";
import { getAppShellIcon } from "@/components/app-shell/icon-map";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function toInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function UserAvatarMenu({
  user,
  items,
  onLogout,
}: UserAvatarMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/95 px-1.5 py-1 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open user menu"
        >
          <div className="hidden min-w-0 text-right pl-2 sm:block">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.fullName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.roleLabel}
            </p>
          </div>

          <Avatar className="size-10 border border-primary/15 bg-primary/10">
            <AvatarFallback className="bg-primary/10 font-display text-sm font-black text-primary">
              {toInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-72 rounded-2xl border-border/70 bg-card/98 p-2 shadow-xl"
      >
        <DropdownMenuLabel className="rounded-xl px-3 py-3">
          <div className="space-y-1">
            <p className="font-display text-base font-black text-foreground">
              {user.fullName}
            </p>
            <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {user.roleLabel}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="mx-1 bg-border/70" />

        {items.map((item) => {
          const Icon = getAppShellIcon(item.icon);

          return (
            <DropdownMenuItem
              key={item.id}
              asChild={Boolean(item.href)}
              disabled={item.disabled}
              className={cn(
                "mt-1 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-primary/10 focus:text-primary",
                item.tone === "destructive"
                  ? "text-danger focus:bg-danger/10 focus:text-danger"
                  : "text-foreground",
              )}
            >
              {item.href ? (
                <Link href={item.href} className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="mx-1 mt-1 bg-border/70" />

        <DropdownMenuItem
          onSelect={() => {
            void onLogout();
          }}
          className="mt-1 rounded-xl gap-2 px-3 py-2.5 text-sm font-medium text-danger focus:bg-danger/10 focus:text-danger"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
