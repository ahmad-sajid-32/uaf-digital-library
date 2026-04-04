// apps/web/src/components/app-shell/icon-map.ts
/**
 * Client-side icon resolver for authenticated shell configuration.
 *
 * Purpose:
 * - Keep server-to-client shell props serializable by storing icon names in
 *   layout config instead of passing component functions across the RSC
 *   boundary.
 * - Resolve those names back into Lucide icons only inside client components.
 */

import {
  BarChart3,
  BotMessageSquare,
  BookCopy,
  CreditCard,
  LayoutDashboard,
  LibraryBig,
  ScrollText,
  Settings,
  UserCircle2,
  Users,
} from "lucide-react";

import type { AppShellIconName } from "@/components/app-shell/contracts";

const APP_SHELL_ICON_MAP = {
  "bar-chart-3": BarChart3,
  "bot-message-square": BotMessageSquare,
  "book-copy": BookCopy,
  "credit-card": CreditCard,
  "layout-dashboard": LayoutDashboard,
  "library-big": LibraryBig,
  "scroll-text": ScrollText,
  settings: Settings,
  "user-circle-2": UserCircle2,
  users: Users,
} satisfies Record<AppShellIconName, typeof LayoutDashboard>;

export function getAppShellIcon(iconName: AppShellIconName) {
  return APP_SHELL_ICON_MAP[iconName];
}
