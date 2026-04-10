"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoadingState(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      {/* Hero skeleton */}
      <Skeleton className="h-[13rem] rounded-3xl" />

      {/* Metric cards row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[10rem] rounded-2xl" />
        <Skeleton className="h-[10rem] rounded-2xl" />
        <Skeleton className="h-[10rem] rounded-2xl" />
      </div>

      {/* Main content grid */}
      <div className="grid gap-5 ">
        <div className="grid gap-5">
          <Skeleton className="h-[22rem] rounded-2xl" />
          <Skeleton className="h-[20rem] rounded-2xl" />
        </div>
        <div className="grid gap-5">
          <Skeleton className="h-[26rem] rounded-2xl" />
          <Skeleton className="h-[18rem] rounded-2xl" />
        </div>
      </div>

      {/* Quick navigation skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-48 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[4.5rem] rounded-xl" />
          <Skeleton className="h-[4.5rem] rounded-xl" />
          <Skeleton className="h-[4.5rem] rounded-xl" />
          <Skeleton className="h-[4.5rem] rounded-xl" />
          <Skeleton className="h-[4.5rem] rounded-xl" />
          <Skeleton className="h-[4.5rem] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
