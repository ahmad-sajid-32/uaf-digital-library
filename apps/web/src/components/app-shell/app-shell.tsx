// apps/web/src/components/app-shell/app-shell.tsx
/**
 * Shared authenticated application shell.
 *
 * Purpose:
 * - Compose the shell primitives into one reusable authenticated frame.
 * - Own sidebar state through the existing sidebar provider primitive.
 * - Provide the layered background and content surfaces that match the
 *   approved design direction for authenticated routes.
 */

"use client";

import * as React from "react";

import type { AppShellProps } from "@/components/app-shell/contracts";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppTopbar } from "@/components/app-shell/app-topbar";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";

function AppShellFrame({
  layout,
  currentPathname,
  user,
  onLogout,
  children,
}: Omit<AppShellProps, "defaultSidebarOpen">): React.JSX.Element {
  const { toggleSidebar } = useSidebar();

  return (
    <>
      <AppSidebar
        dashboardHref={layout.dashboardHref}
        navItems={layout.navItems}
        currentPathname={currentPathname}
        onLogout={onLogout}
      />

      <SidebarInset className="h-svh min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_38%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
        <AppTopbar
          user={user}
          menuItems={layout.menuItems}
          onSidebarToggle={toggleSidebar}
          onLogout={onLogout}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}

export function AppShell({
  layout,
  currentPathname,
  user,
  onLogout,
  defaultSidebarOpen = true,
  children,
}: AppShellProps): React.JSX.Element {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppShellFrame
        layout={layout}
        currentPathname={currentPathname}
        user={user}
        onLogout={onLogout}
      >
        {children}
      </AppShellFrame>
    </SidebarProvider>
  );
}
