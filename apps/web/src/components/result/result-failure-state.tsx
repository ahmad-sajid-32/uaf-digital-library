"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ResultFailureStateProps {
  heading: string;
  message: string;
  hasStaleData?: boolean;
  onRetry: () => void | Promise<void>;
}

export function ResultFailureState({
  heading,
  message,
  hasStaleData = false,
  onRetry,
}: ResultFailureStateProps) {
  return (
    <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">{heading}</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {message}
          </p>
          {hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The currently shown academic result may be stale. Retry to fetch
              the latest result payload.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2 self-start rounded-xl sm:self-auto"
          onClick={() => {
            void onRetry();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
