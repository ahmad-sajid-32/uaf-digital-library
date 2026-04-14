"use client";

import { LoaderCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface ResultLoadingStateProps {
  title: string;
  message: string;
  compact?: boolean;
}

export function ResultLoadingState({
  title,
  message,
  compact = false,
}: ResultLoadingStateProps) {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
      <CardContent
        className={compact ? "px-5 py-5" : "px-6 py-10 text-center"}
      >
        <div
          className={`flex ${compact ? "items-start gap-3" : "flex-col items-center gap-4"}`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LoaderCircle className="h-6 w-6 animate-spin" />
          </div>
          <div className={compact ? "space-y-1" : "space-y-2"}>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Fetching Result
            </p>
            <p className="text-lg font-black tracking-tight text-foreground">
              {title}
            </p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {message}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
