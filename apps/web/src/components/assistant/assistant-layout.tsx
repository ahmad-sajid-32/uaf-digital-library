// apps/web/src/components/assistant/assistant-layout.tsx
/**
 * Chat-first workspace layout for the admin assistant screen.
 *
 * Purpose:
 * - Replace the dashboard-style grid with one continuous assistant workspace.
 * - Keep desktop history and mobile drawer behavior in one layout boundary.
 * - Avoid reusing the global shell sidebar provider inside the assistant
 *   module, because that provider owns global cookie and shortcut behavior.
 */

"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AssistantWorkspaceLayoutProps {
  isSidebarCollapsedDesktop: boolean;
  isSidebarOpenMobile: boolean;
  onSidebarOpenMobileChange: (open: boolean) => void;
  desktopSidebar: React.ReactNode;
  mobileSidebar: React.ReactNode;
  main: React.ReactNode;
}

export function AssistantWorkspaceLayout({
  isSidebarCollapsedDesktop,
  isSidebarOpenMobile,
  onSidebarOpenMobileChange,
  desktopSidebar,
  mobileSidebar,
  main,
}: AssistantWorkspaceLayoutProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden bg-transparent">
        <aside
          className={cn(
            "hidden min-h-0 shrink-0 border-r border-border/50 bg-transparent transition-[width] duration-200 ease-out md:flex",
            isSidebarCollapsedDesktop ? "w-20" : "w-80",
          )}
        >
          {desktopSidebar}
        </aside>

        <div className="min-w-0 flex-1">{main}</div>

        <Sheet open={isSidebarOpenMobile} onOpenChange={onSidebarOpenMobileChange}>
          <SheetContent
            side="left"
            className="w-80 border-r border-border/60 bg-background/96 p-0 sm:max-w-sm"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Conversation history</SheetTitle>
              <SheetDescription>
                Open previous assistant conversations or start a new chat.
              </SheetDescription>
            </SheetHeader>
            {mobileSidebar}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
