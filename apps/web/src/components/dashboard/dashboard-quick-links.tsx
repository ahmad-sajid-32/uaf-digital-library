"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface DashboardQuickLinkItem {
  title: string;
  summary: string;
  href: string;
  icon: LucideIcon;
}

export function DashboardQuickLinks(props: {
  items: DashboardQuickLinkItem[];
}): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {props.items.map((item) => {
        const Icon = item.icon;

        return (
          <Button
            key={item.href}
            asChild
            variant="outline"
            className="h-auto justify-start rounded-[1.6rem] border-border/65 bg-background/55 px-4 py-4 text-left hover:bg-primary/5"
          >
            <Link href={item.href}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.summary}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
