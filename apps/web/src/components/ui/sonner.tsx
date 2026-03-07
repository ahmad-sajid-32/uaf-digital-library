"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast relative overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-lg",
          content: "gap-1 pr-8",
          title: "text-sm font-semibold text-foreground",
          description: "text-sm text-muted-foreground",
          closeButton:
            "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-none border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground focus:ring-0 focus:outline-none",
          success: "border-success/20",
          error: "border-danger/20",
          warning: "border-warning/20",
          info: "border-primary/20",
        },
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
