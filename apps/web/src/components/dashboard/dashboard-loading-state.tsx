"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.9fr)]">
      <div className="grid gap-4">
        <Skeleton className="h-[25rem] rounded-[2rem]" />
        <Skeleton className="h-[22rem] rounded-[2rem]" />
      </div>

      <div className="grid gap-4">
        <Skeleton className="h-[25rem] rounded-[2rem]" />
        <Skeleton className="h-[12rem] rounded-[2rem]" />
        <Skeleton className="h-[22rem] rounded-[2rem]" />
      </div>
    </div>
  );
}
