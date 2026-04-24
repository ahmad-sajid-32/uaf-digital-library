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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {props.items.map((item) => {
        const Icon = item.icon;

        return (
          <Button
            key={item.href}
            asChild
            variant="ghost"
            className="group h-auto justify-start rounded-[2rem] border border-border/60 bg-background/80 px-5 py-5 text-left transition hover:border-primary/60 hover:bg-primary/10"
          >
            <Link href={item.href}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.summary}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
