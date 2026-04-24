"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type DashboardChartTone =
  | "primary"
  | "warning"
  | "danger"
  | "success"
  | "accent"
  | "muted";

export interface DashboardChartDatum {
  id: string;
  label: string;
  value: number;
  caption?: string;
  tone?: DashboardChartTone;
}

interface DashboardDonutChartProps {
  items: DashboardChartDatum[];
  totalLabel: string;
  totalValue: string;
  emptyLabel: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

interface DashboardActivityContourProps {
  items: DashboardChartDatum[];
  emptyTitle: string;
  emptyMessage: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

interface DashboardBarChartProps {
  items: DashboardChartDatum[];
  emptyTitle: string;
  emptyMessage: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

function getToneColor(tone: DashboardChartTone): string {
  switch (tone) {
    case "warning":
      return "hsl(var(--warning))";
    case "danger":
      return "hsl(var(--danger))";
    case "success":
      return "hsl(var(--success))";
    case "accent":
      return "hsl(var(--accent-foreground))";
    case "muted":
      return "hsl(var(--muted-foreground))";
    case "primary":
    default:
      return "hsl(var(--primary))";
  }
}

function getToneClassName(tone: DashboardChartTone): string {
  switch (tone) {
    case "warning":
      return "text-warning";
    case "danger":
      return "text-danger";
    case "success":
      return "text-success";
    case "accent":
      return "text-accent-foreground";
    case "muted":
      return "text-muted-foreground";
    case "primary":
    default:
      return "text-primary";
  }
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  width: number,
  baselineY: number,
): string {
  if (points.length === 0) {
    return "";
  }

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");

  return `${linePath} L ${width} ${baselineY} L 0 ${baselineY} Z`;
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}

export function DashboardDonutChart({
  items,
  totalLabel,
  totalValue,
  emptyLabel,
  valueFormatter = (value) => String(value),
  className,
}: DashboardDonutChartProps): React.JSX.Element {
  const normalizedItems = items.filter((item) => item.value > 0);
  const total = normalizedItems.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center",
        className,
      )}
    >
      <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full"
          role="img"
          aria-label={total > 0 ? totalLabel : emptyLabel}
        >
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={strokeWidth}
            opacity={0.35}
          />
          {total > 0
            ? normalizedItems.map((item) => {
                const fraction = item.value / total;
                const segmentLength = fraction * circumference;
                const circle = (
                  <circle
                    key={item.id}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={getToneColor(item.tone ?? "primary")}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                    strokeDashoffset={-cumulativeOffset}
                    transform="rotate(-90 60 60)"
                  />
                );

                cumulativeOffset += segmentLength;
                return circle;
              })
            : null}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {totalLabel}
          </p>
          <p className="mt-1 text-center text-2xl font-black tracking-tight text-foreground">
            {total > 0 ? totalValue : "0"}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {total > 0 ? (
          normalizedItems.map((item) => {
            const percentage = Math.round((item.value / total) * 100);

            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        getToneClassName(item.tone ?? "primary"),
                      )}
                      style={{
                        backgroundColor: getToneColor(item.tone ?? "primary"),
                      }}
                    />
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
                  </div>
                  {item.caption ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.caption}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {valueFormatter(item.value)}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {percentage}%
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-5">
            <p className="text-sm font-semibold text-foreground">{emptyLabel}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Queue demand will appear here once readers are waiting on specific
              titles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardActivityContour({
  items,
  emptyTitle,
  emptyMessage,
  valueFormatter = (value) => String(value),
  className,
}: DashboardActivityContourProps): React.JSX.Element {
  const width = 420;
  const height = 160;
  const topPadding = 18;
  const bottomPadding = 28;
  const maxValue = Math.max(...items.map((item) => item.value), 0);
  const usableHeight = height - topPadding - bottomPadding;
  const points = items.map((item, index) => {
    const x =
      items.length === 1
        ? width / 2
        : (index / Math.max(items.length - 1, 1)) * width;
    const normalizedHeight =
      maxValue > 0 ? (item.value / maxValue) * usableHeight : 0;

    return {
      x,
      y: height - bottomPadding - normalizedHeight,
      item,
    };
  });

  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, width, height - bottomPadding);

  return (
    <div className={cn("space-y-4", className)}>
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-4 py-6">
          <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-primary/8 via-background/80 to-background/50 px-4 py-4">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-40 w-full"
              role="img"
              aria-label="Top borrowed books chart"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="dashboard-activity-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary) / 0.28)" />
                  <stop offset="100%" stopColor="hsl(var(--primary) / 0.02)" />
                </linearGradient>
              </defs>

              <path
                d={areaPath}
                fill="url(#dashboard-activity-fill)"
              />
              <path
                d={linePath}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point) => (
                <circle
                  key={point.item.id}
                  cx={point.x}
                  cy={point.y}
                  r="4.5"
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                />
              ))}
            </svg>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {points.slice(0, 3).map((point, index) => (
              <div
                key={point.item.id}
                className="rounded-2xl border border-border/60 bg-background/60 px-3 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Rank {index + 1}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {point.item.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {valueFormatter(point.item.value)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardBarChart({
  items,
  emptyTitle,
  emptyMessage,
  valueFormatter = (value) => String(value),
  className,
}: DashboardBarChartProps): React.JSX.Element {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  return (
    <div className={cn("space-y-4", className)}>
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-4 py-6">
          <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="grid h-72 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => {
            const height = maxValue > 0 ? Math.max(16, (item.value / maxValue) * 100) : 0;

            return (
              <div
                key={item.id}
                className="flex min-w-0 flex-col justify-end gap-3"
              >
                <div className="flex min-h-0 flex-1 items-end rounded-[1.75rem] border border-border/60 bg-muted/25 px-2 py-2">
                  <div
                    className="w-full rounded-[1.1rem]"
                    style={{
                      height: `${height}%`,
                      background: `linear-gradient(180deg, ${getToneColor(item.tone ?? "primary")} 0%, ${getToneColor(item.tone ?? "primary")}cc 100%)`,
                    }}
                  />
                </div>
                <div className="space-y-1 px-1">
                  <p className="line-clamp-2 text-xs font-semibold leading-5 text-foreground">
                    {item.label}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {valueFormatter(item.value)}
                  </p>
                  {item.caption ? (
                    <p className="line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                      {item.caption}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
