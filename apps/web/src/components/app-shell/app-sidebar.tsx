// apps/web/src/components/app-shell/app-sidebar.tsx
/**
 * Sidebar wrapper for the authenticated application shell.
 *
 * Purpose:
 * - Compose the existing sidebar primitive into the approved shell structure.
 * - Keep shell branding, navigation, and mobile close behavior in one place.
 * - Stay role-agnostic by receiving all role-specific data through props.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, PanelLeft, X } from "lucide-react";

import type { AppSidebarProps } from "@/components/app-shell/contracts";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

function MobileSidebarDismissButton(): React.JSX.Element {
  const { setOpenMobile } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setOpenMobile(false)}
      className="size-10 rounded-full border border-border/60 md:hidden"
    >
      <X className="h-4.5 w-4.5" />
      <span className="sr-only">Close sidebar</span>
    </Button>
  );
}

function SidebarDesktopBrandControl({
  dashboardHref,
}: {
  dashboardHref: string;
}): React.JSX.Element {
  const { open, toggleSidebar } = useSidebar();

  if (open) {
    return (
      <div className="hidden items-center justify-between gap-3 md:flex">
        <Link
          href={dashboardHref}
          className="inline-flex min-w-0 items-center rounded-2xl px-1 py-1 transition-colors hover:bg-primary/6"
        >
          <Logo className="h-12 w-auto" variant="icon" />
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="size-10 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <PanelLeft className="h-4.5 w-4.5" />
          <span className="sr-only">Collapse sidebar</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="hidden justify-center md:flex">
      <button
        type="button"
        onClick={toggleSidebar}
        className="group/sidebar-brand relative inline-flex h-14 w-14 items-center justify-center rounded-[1.4rem] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Expand sidebar"
        title="Expand sidebar"
      >
        <span className="transition-all duration-200 group-hover/sidebar-brand:scale-90 group-hover/sidebar-brand:opacity-0 py-2">
          <Logo className="h-9 w-auto" variant="icon" />
        </span>

        <span className="absolute inset-0 flex items-center justify-center text-primary opacity-0 transition-all duration-200 group-hover/sidebar-brand:opacity-100">
          <PanelLeft className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}

function SidebarFooterLogoutButton({
  onLogout,
}: {
  onLogout: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="destructive"
      onClick={() => {
        void onLogout();
      }}
      className="h-11 w-full justify-start gap-2 rounded-2xl px-3 font-semibold shadow-none md:group-data-[collapsible=icon]:size-11 md:group-data-[collapsible=icon]:justify-center md:group-data-[collapsible=icon]:px-0"
      title="Logout"
    >
      <LogOut className="h-4.5 w-4.5 shrink-0" />
      <span className="truncate md:group-data-[collapsible=icon]:hidden">
        Logout
      </span>
    </Button>
  );
}

export function AppSidebar({
  dashboardHref,
  navItems,
  currentPathname,
  onLogout,
}: AppSidebarProps): React.JSX.Element {
  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r-0 bg-[linear-gradient(180deg,hsl(var(--sidebar)),hsl(var(--sidebar))/0.98)]"
    >
      <SidebarHeader className="gap-3 px-3 py-3">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <Link
            href={dashboardHref}
            className="inline-flex min-w-0 items-center"
          >
            <Logo className="h-11 w-auto" variant="icon" />
          </Link>
          <MobileSidebarDismissButton />
        </div>

        <SidebarDesktopBrandControl dashboardHref={dashboardHref} />
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="pb-4">
        <SidebarNav items={navItems} currentPathname={currentPathname} />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-3 py-3">
        <SidebarFooterLogoutButton onLogout={onLogout} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
