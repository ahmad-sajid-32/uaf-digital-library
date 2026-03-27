// apps/web/src/components/app-shell/app-topbar.tsx
/**
 * Topbar for the authenticated application shell.
 *
 * Purpose:
 * - Present the authenticated brand/header surface consistently across roles.
 * - Expose sidebar toggle, theme controls, and avatar-menu entry in one place.
 * - Translate the approved sample design language into the current React
 *   component system without hardcoding any role-specific navigation data.
 */

"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";

import type { AppTopbarProps } from "@/components/app-shell/contracts";
import { UserAvatarMenu } from "@/components/app-shell/user-avatar-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppTopbar({
  user,
  menuItems,
  onSidebarToggle,
  onLogout,
}: AppTopbarProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onSidebarToggle}
            className="size-10 rounded-full border border-border/60 bg-card/95 text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
          >
            <PanelLeft className="h-4.5 w-4.5" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </div>
        <div className=""></div>
        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle variant="compact" />
          <UserAvatarMenu user={user} items={menuItems} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
