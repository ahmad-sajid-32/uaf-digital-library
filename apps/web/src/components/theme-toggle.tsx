"use client";

// apps/web/src/components/theme-toggle.tsx
/**
 * Theme toggle control for switching between system, light, and dark modes.
 *
 * The selected value is persisted by next-themes in localStorage so the
 * user's theme choice survives page refreshes and browser restarts.
 */

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type ThemeOption = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: "system" | "light" | "dark";
};

interface ThemeToggleProps {
  variant?: "default" | "compact";
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    icon: Monitor,
    label: "System",
    value: "system",
  },
  {
    icon: Sun,
    label: "Light",
    value: "light",
  },
  {
    icon: Moon,
    label: "Dark",
    value: "dark",
  },
];

export function ThemeToggle({
  variant = "default",
}: ThemeToggleProps): React.JSX.Element {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? theme ?? "system" : "system";
  const isCompact = variant === "compact";
  const activeIndex = Math.max(
    THEME_OPTIONS.findIndex((option) => option.value === activeTheme),
    0,
  );

  if (isCompact) {
    return (
      <div className="relative inline-grid grid-cols-3 rounded-full border border-border/60 bg-card/95 p-1 text-card-foreground shadow-sm">
        <div
          className="pointer-events-none absolute left-1 top-1 h-9 w-9 rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(${activeIndex} * 100%))`,
          }}
        />
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = activeTheme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={cn(
                "relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={`Switch to ${option.label.toLowerCase()} theme`}
              aria-pressed={isActive}
              title={option.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 text-card-foreground shadow-sm">
      <div className="space-y-1">
        <p className="font-display text-lg font-bold">Theme</p>
        <p className="text-sm text-muted-foreground">
          Default is system. Your selection is saved locally.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border/50 bg-muted p-1">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = activeTheme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Active appearance:{" "}
        <span className="font-medium text-foreground">
          {mounted ? resolvedTheme : "system"}
        </span>
      </p>
    </div>
  );
}
