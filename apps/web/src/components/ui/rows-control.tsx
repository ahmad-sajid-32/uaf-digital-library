// apps/web/src/components/ui/rows-control.tsx
/**
 * Reusable rows-per-page control aligned with the current admin-table design.
 *
 * Purpose:
 * - Provide one shared rows selector for future table surfaces.
 * - Preserve the compact inline control language already approved in the admin
 *   users list screen.
 */

"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface RowsControlProps {
  value: number;
  options: readonly number[];
  onValueChange: (value: number) => void;
  label?: string;
  className?: string;
}

export function RowsControl({
  value,
  options,
  onValueChange,
  label = "Rows",
  className,
}: RowsControlProps): React.JSX.Element {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <p className="text-xs font-medium text-muted-foreground sm:text-sm">
        {label}
      </p>
      <Select
        value={String(value)}
        onValueChange={(nextValue) => {
          onValueChange(Number(nextValue));
        }}
      >
        <SelectTrigger className="h-8 w-22 rounded-xl border-border/70 bg-background text-xs sm:h-9 sm:text-sm">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
