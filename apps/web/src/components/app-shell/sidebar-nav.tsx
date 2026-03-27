// apps/web/src/components/app-shell/sidebar-nav.tsx
/**
 * Sidebar navigation renderer for the authenticated application shell.
 *
 * Purpose:
 * - Render one stable role-provided navigation contract.
 * - Keep active-link logic centralized so role layouts do not duplicate it.
 * - Reuse the shared sidebar UI primitives instead of creating another nav
 *   system outside the current design stack.
 */

"use client";

import * as React from "react";
import Link from "next/link";

import type {
  AppShellNavItem,
  SidebarNavProps,
} from "@/components/app-shell/contracts";
import { getAppShellIcon } from "@/components/app-shell/icon-map";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function isNavItemActive(
  item: AppShellNavItem,
  currentPathname: string,
): boolean {
  const matchMode = item.match ?? "exact";

  if (matchMode === "startsWith") {
    return (
      currentPathname === item.href ||
      currentPathname.startsWith(`${item.href}/`)
    );
  }

  return currentPathname === item.href;
}

export function SidebarNav({
  items,
  currentPathname,
}: SidebarNavProps): React.JSX.Element {
  return (
    <SidebarGroup className="px-2 py-1">
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = getAppShellIcon(item.icon);
            const isActive = isNavItemActive(item, currentPathname);

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  size="lg"
                  tooltip={item.label}
                  className="rounded-2xl px-3 font-medium transition-all duration-200 data-[active=true]:border data-[active=true]:border-primary/20 data-[active=true]:bg-primary/10 dark:data-[active=true]:bg-primary data-[active=true]:text-primary dark:data-[active=true]:text-primary-foreground hover:bg-primary/5 hover:text-foreground md:group-data-[collapsible=icon]:size-11! md:group-data-[collapsible=icon]:justify-center md:group-data-[collapsible=icon]:px-0"
                >
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={item.disabled || undefined}
                    className={cn(
                      "flex items-center gap-3 md:group-data-[collapsible=icon]:justify-center",
                      item.disabled && "pointer-events-none opacity-60",
                    )}
                  >
                    <Icon
                      className={
                        isActive
                          ? "h-5 w-5 text-primary dark:text-primary-foreground"
                          : "h-5 w-5 text-muted-foreground transition-colors group-hover/menu-item:text-primary"
                      }
                    />
                    <span className="truncate md:group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                  </Link>
                </SidebarMenuButton>

                {item.badge !== null && item.badge !== undefined ? (
                  <SidebarMenuBadge className="rounded-md bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
                    {item.badge}
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
