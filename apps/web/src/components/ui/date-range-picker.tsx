// apps/web/src/components/ui/date-range-picker.tsx
/**
 * Reusable flatpickr-based date-range picker for management-table filters.
 *
 * Purpose:
 * - Use flatpickr's native range-selection behavior instead of maintaining a
 *   custom calendar interaction layer.
 * - Keep the existing `from` / `to` value contract so module hooks can keep
 *   their filtering logic unchanged.
 * - Present the picker through the app's input styling while delegating range
 *   completion, outside-click handling, and month/year navigation to
 *   flatpickr.
 */

"use client";

import * as React from "react";
import { CalendarRange, X } from "lucide-react";
import Flatpickr from "react-flatpickr";
import type { Options } from "flatpickr/dist/types/options";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface DateRangePickerValue {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRangePickerValue;
  onChange: (value: DateRangePickerValue) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  numberOfMonths?: number;
}

type FlatpickrInputProps = React.ComponentProps<"input"> & {
  render?: unknown;
};

function parseDateKey(value: string): Date | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const [yearText, monthText, dayText] = normalizedValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    year <= 0 ||
    month <= 0 ||
    month > 12 ||
    day <= 0 ||
    day > 31
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeRangeValue(value: DateRangePickerValue): Date[] {
  const dates = [parseDateKey(value.from), parseDateKey(value.to)].filter(
    (entry): entry is Date => entry instanceof Date,
  );

  return dates;
}

export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder = "Select a date range",
  className,
  triggerClassName,
  disabled = false,
  numberOfMonths = 1,
}: DateRangePickerProps): React.JSX.Element {
  const flatpickrValue = React.useMemo(
    () => normalizeRangeValue(value),
    [value],
  );
  const hasSelection = Boolean(value.from || value.to);
  const currentYear = React.useMemo(() => new Date().getFullYear(), []);
  const options = React.useMemo<Options>(
    () => ({
      mode: "range",
      showMonths: numberOfMonths,
      monthSelectorType: "static",
      dateFormat: "M j, Y",
      disableMobile: true,
      allowInput: false,
      closeOnSelect: true,
      static: false,
      position: "auto left",
      prevArrow: '<span aria-hidden="true">&lsaquo;</span>',
      nextArrow: '<span aria-hidden="true">&rsaquo;</span>',
      minDate: new Date(2000, 0, 1),
      maxDate: new Date(currentYear + 10, 11, 31),
    }),
    [currentYear, numberOfMonths],
  );

  const handleChange = React.useCallback(
    (selectedDates: Date[]) => {
      onChange({
        from: selectedDates[0] ? toDateKey(selectedDates[0]) : "",
        to: selectedDates[1] ? toDateKey(selectedDates[1]) : "",
      });
    },
    [onChange],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <CalendarRange className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Flatpickr
          value={flatpickrValue}
          options={options}
          onChange={handleChange}
          disabled={disabled}
          render={(props, ref) => {
            const safeInputProps = { ...(props as FlatpickrInputProps) };
            const inputValue = safeInputProps.value;

            delete safeInputProps.render;
            delete safeInputProps.value;

            return (
              <input
                {...safeInputProps}
                ref={ref}
                type="text"
                value={typeof inputValue === "string" ? inputValue : undefined}
                readOnly
                aria-label={label ?? placeholder}
                placeholder={placeholder}
                className={cn(
                  "uaf-flatpickr-input h-10 w-full rounded-xl border border-border/70 bg-background py-2 pr-10 pl-9 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  triggerClassName,
                )}
              />
            );
          }}
        />
        {hasSelection ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 z-10 h-8 w-8 -translate-y-1/2 rounded-lg"
            aria-label="Clear selected date range"
            onClick={() => {
              onChange({
                from: "",
                to: "",
              });
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
