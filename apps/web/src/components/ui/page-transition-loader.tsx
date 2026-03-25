"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface PageTransitionLoaderProps {
  title: string;
  message: string;
}

export function PageTransitionLoader({
  title,
  message,
}: PageTransitionLoaderProps): React.JSX.Element {
  return (
    <ScrollReveal direction="up" delayMs={40}>
      <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
        <CardContent className="flex flex-col items-center justify-center gap-4 px-5 py-12 text-center sm:px-6">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <span className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
            <LoaderCircle className="relative h-7 w-7 animate-spin" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-xl font-black tracking-tight text-foreground">
              {title}
            </p>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              {message}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary/80 animate-pulse" />
            <span
              className="h-2 w-2 rounded-full bg-primary/60 animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-2 w-2 rounded-full bg-primary/40 animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </CardContent>
      </Card>
    </ScrollReveal>
  );
}
