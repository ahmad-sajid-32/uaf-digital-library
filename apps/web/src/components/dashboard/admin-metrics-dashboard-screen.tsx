"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BotMessageSquare,
  BookCopy,
  Clock3,
  CreditCard,
  FileText,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";
import {
  DashboardActivityContour,
  DashboardBarChart,
  DashboardDonutChart,
  type DashboardChartDatum,
} from "@/components/dashboard/dashboard-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useAdminMetrics } from "@/hooks/useAdminMetrics";
import { cn } from "@/lib/utils";

/* ───────────────────────────── Quick-link config ───────────────────────────── */

interface QuickLinkItem {
  title: string;
  summary: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
}

const QUICK_LINKS: QuickLinkItem[] = [
  {
    title: "Circulation",
    summary: "Review active and overdue books.",
    href: "/admin/circulation",
    icon: LibraryBig,
    gradient: "from-violet-500/10 to-purple-600/5",
    iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    title: "Fines",
    summary: "Review unpaid and cleared fines.",
    href: "/admin/fines",
    icon: CreditCard,
    gradient: "from-amber-500/10 to-orange-600/5",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    title: "Catalog",
    summary: "Manage books and availability.",
    href: "/admin/catalog",
    icon: BookCopy,
    gradient: "from-emerald-500/10 to-teal-600/5",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Users",
    summary: "Manage user accounts and roles.",
    href: "/admin/users",
    icon: Users,
    gradient: "from-blue-500/10 to-indigo-600/5",
    iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    title: "Documents",
    summary: "Review document uploads and status.",
    href: "/admin/documents",
    icon: FileText,
    gradient: "from-rose-500/10 to-pink-600/5",
    iconBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  {
    title: "Assistant",
    summary: "Ask the assistant using official library information.",
    href: "/admin/assistant",
    icon: BotMessageSquare,
    gradient: "from-cyan-500/10 to-sky-600/5",
    iconBg: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  },
];

/* ─────────────────────────── Formatting helpers ─────────────────────────── */

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeTime(value: number | null): string {
  if (!value) return "Not loaded yet";
  const diffMinutes = Math.max(1, Math.round((Date.now() - value) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function getSystemHeadline(
  metrics: NonNullable<ReturnType<typeof useAdminMetrics>["metrics"]>,
  isSystemQuiet: boolean,
): string {
  if (isSystemQuiet)
    return "Nothing needs attention right now.";
  if (metrics.overdueCount > 0) return "Overdue books need review.";
  if (metrics.queuePressure.length > 0)
    return "Waiting list activity needs review.";
  if (metrics.activeBorrowCount > 0)
    return "Books are currently borrowed.";
  return "System is active.";
}

/* ─────────────────────────── Animated Counter ──────────────────────────── */

function AnimatedCounter({
  value,
  formatter,
  className,
}: {
  value: number;
  formatter: (v: number) => string;
  className?: string;
}): React.JSX.Element {
  const [displayValue, setDisplayValue] = React.useState(0);
  const prevValueRef = React.useRef(0);

  React.useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    prevValueRef.current = value;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const duration = 800;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [value]);

  return <span className={className}>{formatter(displayValue)}</span>;
}

/* ────────────────────────── Sparkline Mini-Chart ───────────────────────── */

function MiniSparkline({
  values,
  color = "hsl(var(--primary))",
  className,
}: {
  values: number[];
  color?: string;
  className?: string;
}): React.JSX.Element {
  const width = 80;
  const height = 28;
  const padding = 2;
  const maxVal = Math.max(...values, 1);

  const points = values.map((v, i) => {
    const x =
      padding + (i / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (v / maxVal) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-7 w-20", className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id={`spark-fill-${color.replace(/[^a-z0-9]/gi, "")}`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#spark-fill-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ──────────────────────── Primary Metric Card ────────────────────────── */

function PrimaryMetricCard({
  title,
  value,
  formattedValue,
  summary,
  icon: Icon,
  tone,
  sparkValues,
  trendLabel,
}: {
  title: string;
  value: number;
  formattedValue: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "warning" | "fine";
  sparkValues?: number[];
  trendLabel?: string;
}): React.JSX.Element {
  const toneMap = {
    primary: {
      border: "border-primary/20 hover:border-primary/35",
      bg: "bg-gradient-to-br from-primary/8 via-primary/3 to-transparent",
      icon: "bg-primary/12 text-primary ring-1 ring-primary/20",
      dot: "bg-primary",
      sparkColor: "hsl(var(--primary))",
      badge: "bg-primary/10 text-primary border-primary/20",
    },
    warning: {
      border: "border-danger/20 hover:border-danger/35",
      bg: "bg-gradient-to-br from-danger/8 via-danger/3 to-transparent",
      icon: "bg-danger/12 text-danger ring-1 ring-danger/20",
      dot: "bg-danger",
      sparkColor: "hsl(var(--danger))",
      badge: "bg-danger/10 text-danger border-danger/20",
    },
    fine: {
      border: "border-warning/20 hover:border-warning/35",
      bg: "bg-gradient-to-br from-warning/8 via-warning/3 to-transparent",
      icon: "bg-warning/12 text-warning ring-1 ring-warning/20",
      dot: "bg-warning",
      sparkColor: "hsl(var(--warning))",
      badge: "bg-warning/10 text-warning border-warning/20",
    },
  };
  const t = toneMap[tone];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300",
        t.border,
        t.bg,
      )}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-transform duration-500 group-hover:scale-150" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                t.icon,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </p>
          </div>

          <div className="flex items-end gap-3">
            <AnimatedCounter
              value={value}
              formatter={() => formattedValue}
              className="font-display text-3xl font-black tracking-tight text-foreground"
            />
            {sparkValues && sparkValues.length > 1 && (
              <MiniSparkline
                values={sparkValues}
                color={t.sparkColor}
                className="mb-1"
              />
            )}
          </div>

          {trendLabel && (
            <Badge
              variant="outline"
              className={cn("rounded-full text-[10px] font-semibold", t.badge)}
            >
              <TrendingUp className="mr-1 h-3 w-3" />
              {trendLabel}
            </Badge>
          )}
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        {summary}
      </p>
    </div>
  );
}

/* ──────────────────── Pulse Indicator ──────────────────────────────── */

function SystemPulse({ isQuiet }: { isQuiet: boolean }): React.JSX.Element {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {!isQuiet && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          isQuiet ? "bg-muted-foreground/40" : "bg-emerald-500",
        )}
      />
    </span>
  );
}

/* ─────────────────────── Error State ──────────────────────────────── */

function DashboardErrorState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl border border-danger/20 bg-gradient-to-r from-danger/5 via-danger/3 to-transparent p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/12 text-danger ring-1 ring-danger/20">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">
              Unable to load dashboard
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {props.message}
            </p>
            {props.hasStaleData && (
              <p className="text-[12px] text-muted-foreground/70">
                Showing stale data. Refresh for the latest.
              </p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start rounded-xl border-danger/25 text-danger hover:bg-danger/10 sm:self-auto"
          onClick={() => {
            void props.onRetry();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────── Manage System Card ──────────────────────── */

function QuickNavCard({ item }: { item: QuickLinkItem }): React.JSX.Element {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3.5 overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br p-4 transition-all duration-300",
        "hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
        item.gradient,
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          item.iconBg,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {item.summary}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ██  MAIN DASHBOARD SCREEN
   ══════════════════════════════════════════════════════════════════════ */

export function AdminMetricsDashboardScreen(): React.JSX.Element {
  const metricsQuery = useAdminMetrics({
    popularLimit: 5,
    queueLimit: 5,
    autoLoad: true,
  });

  const metrics = metricsQuery.metrics;

  const popularChartItems: DashboardChartDatum[] = React.useMemo(
    () =>
      metricsQuery.popularBooks.map((item, index) => ({
        id: item.bookId,
        label: item.title,
        value: item.borrowCount,
        caption: `Rank ${index + 1}`,
        tone: index === 0 ? "primary" : index === 1 ? "accent" : "muted",
      })),
    [metricsQuery.popularBooks],
  );

  const queueChartItems: DashboardChartDatum[] = React.useMemo(
    () =>
      metricsQuery.queuePressure.map((item, index) => ({
        id: item.bookId,
        label: item.title,
        value: item.waitingCount,
        caption: `Rank ${index + 1}`,
        tone: index === 0 ? "danger" : index === 1 ? "warning" : "primary",
      })),
    [metricsQuery.queuePressure],
  );

  const totalWaitingReaders = React.useMemo(
    () =>
      metricsQuery.queuePressure.reduce(
        (sum, item) => sum + item.waitingCount,
        0,
      ),
    [metricsQuery.queuePressure],
  );

  /* Derive mini-sparkline data from popular books (gives visual context) */
  const borrowSparkValues = React.useMemo(
    () =>
      metricsQuery.popularBooks.length > 0
        ? metricsQuery.popularBooks.map((b) => b.borrowCount)
        : [0, 0],
    [metricsQuery.popularBooks],
  );

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col gap-5">
        {/* Loading state */}
        {metricsQuery.loading ? <DashboardLoadingState /> : null}

        {/* Full error (no data at all) */}
        {!metricsQuery.loading &&
        metricsQuery.error &&
        !metricsQuery.hasData ? (
          <DashboardErrorState
            hasStaleData={metricsQuery.hasStaleData}
            message={metricsQuery.error}
            onRetry={metricsQuery.retry}
          />
        ) : null}

        {/* Main dashboard content */}
        {!metricsQuery.loading && metricsQuery.hasData && metrics ? (
          <>
            {/* Stale data error banner */}
            {metricsQuery.error ? (
              <DashboardErrorState
                hasStaleData={metricsQuery.hasStaleData}
                message={metricsQuery.error}
                onRetry={metricsQuery.retry}
              />
            ) : null}

            {/* ───── HERO SECTION ───── */}
            <ScrollReveal direction="up" delayMs={30}>
              <div className="relative overflow-hidden py-2">
                {/* Decorative background blobs */}
                <div className="relative grid gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge className="rounded-full bg-primary/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary shadow-none hover:bg-primary/12">
                            <Zap className="mr-1.5 h-3 w-3" />
                            Admin Dashboard
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <h1 className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                            Dashboard
                          </h1>
                          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {getSystemHeadline(
                              metrics,
                              metricsQuery.isSystemQuiet,
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Refresh Button */}
                      <div className="flex items-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                          disabled={
                            metricsQuery.loading || metricsQuery.refreshing
                          }
                          onClick={() => {
                            void metricsQuery.refresh();
                          }}
                        >
                          {metricsQuery.loading || metricsQuery.refreshing ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Refresh
                        </Button>
                      </div>
                    </div>
                    {/* System Status Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/40 bg-background/60 px-4 py-3 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <SystemPulse isQuiet={metricsQuery.isSystemQuiet} />
                        <span className="text-[13px] font-medium text-foreground">
                          {metricsQuery.isSystemQuiet
                            ? "Nothing needs attention"
                            : "System is running"}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-border/60" />
                      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatRelativeTime(metricsQuery.lastLoadedAt)}
                      </div>
                      <div className="h-4 w-px bg-border/60" />
                      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <Activity className="h-3.5 w-3.5" />
                        <span>
                          {metricsQuery.isSystemQuiet
                            ? "No urgent items"
                            : `${metrics.activeBorrowCount} active`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ───── METRICS CARDS ROW ───── */}
            <ScrollReveal direction="up" delayMs={80}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PrimaryMetricCard
                  title="Active Borrows"
                  value={metrics.activeBorrowCount}
                  formattedValue={formatCount(metrics.activeBorrowCount)}
                  summary={
                    metrics.activeBorrowCount > 0
                      ? "Books currently borrowed by readers."
                      : "No books are currently borrowed."
                  }
                  icon={LibraryBig}
                  tone="primary"
                  sparkValues={borrowSparkValues}
                  trendLabel={
                    metrics.activeBorrowCount > 0 ? "Live" : undefined
                  }
                />
                <PrimaryMetricCard
                  title="Overdue Loans"
                  value={metrics.overdueCount}
                  formattedValue={formatCount(metrics.overdueCount)}
                  summary={
                    metrics.overdueCount > 0
                      ? "Review overdue books and follow up with borrowers."
                      : "No overdue books currently need review."
                  }
                  icon={ShieldAlert}
                  tone="warning"
                  trendLabel={
                    metrics.overdueCount > 0 ? "Needs Attention" : undefined
                  }
                />
                <PrimaryMetricCard
                  title="Pending Fines"
                  value={metrics.totalPendingFines}
                  formattedValue={formatMoney(metrics.totalPendingFines)}
                  summary={
                    metrics.totalPendingFines > 0
                      ? "Unpaid fines are currently pending."
                      : "No unpaid fines right now."
                  }
                  icon={CreditCard}
                  tone="fine"
                  trendLabel={
                    metrics.totalPendingFines > 0 ? "Outstanding" : undefined
                  }
                />
              </div>
            </ScrollReveal>

            {/* ───── MAIN CONTENT GRID ───── */}
            <div className="grid gap-5 ">
              {/* LEFT COLUMN */}
              <div className="grid gap-5">
                {/* Borrow activity */}
                <ScrollReveal direction="up" delayMs={120}>
                  <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 py-0 shadow-sm shadow-primary/5">
                    <CardHeader className="gap-2 border-b border-border/40 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                            Book Activity
                          </p>
                          <CardTitle className="text-xl font-black tracking-tight">
                            Borrow activity
                          </CardTitle>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                      </div>
                      <CardDescription className="px-0 text-[13px] leading-relaxed">
                        Borrow activity across the most active titles.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 py-6">
                      <DashboardActivityContour
                        items={popularChartItems}
                        emptyTitle="No borrowing activity yet"
                        emptyMessage="Most-borrowed books will appear here when borrowing records are available."
                        valueFormatter={(value) =>
                          `${formatCount(value)} borrows`
                        }
                      />
                    </CardContent>
                  </Card>
                </ScrollReveal>

                {/* Most Borrowed Books Bar Chart */}
                <ScrollReveal direction="up" delayMs={160}>
                  <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 py-0 shadow-sm shadow-primary/5">
                    <CardHeader className="gap-2 border-b border-border/40 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                            Catalog Activity
                          </p>
                          <CardTitle className="text-xl font-black tracking-tight">
                            Most borrowed books
                          </CardTitle>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <BookCopy className="h-4 w-4" />
                        </div>
                      </div>
                      <CardDescription className="px-0 text-[13px] leading-relaxed">
                        Titles attracting the most borrowing volume right now.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 py-6">
                      <DashboardBarChart
                        items={popularChartItems}
                        emptyTitle="No popular-book data yet"
                        emptyMessage="Borrow activity has not produced any ranked popular-book data yet."
                        valueFormatter={(value) =>
                          `${formatCount(value)} borrows`
                        }
                      />
                    </CardContent>
                  </Card>
                </ScrollReveal>
              </div>

              {/* RIGHT COLUMN */}
              <div className="grid gap-5">
                {/* Waiting list overview */}
                <ScrollReveal direction="up" delayMs={100}>
                  <Card className="overflow-hidden rounded-2xl border-danger/12 bg-card/95 py-0 shadow-sm shadow-danger/5">
                    <CardHeader className="gap-2 border-b border-border/40 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-danger">
                            Needs Attention
                          </p>
                          <CardTitle className="text-xl font-black tracking-tight">
                            Waiting list overview
                          </CardTitle>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger/10 text-danger">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                      </div>
                      <CardDescription className="px-0 text-[13px] leading-relaxed">
                        Review overdue books and waiting list activity.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 px-6 py-6">
                      <DashboardDonutChart
                        items={queueChartItems}
                        totalLabel="Waiting readers"
                        totalValue={formatCount(totalWaitingReaders)}
                        emptyLabel="No waiting readers right now"
                        valueFormatter={(value) =>
                          `${formatCount(value)} waiting`
                        }
                      />

                      {/* Secondary pressure metrics */}
                      <div className="grid gap-3">
                        <div className="rounded-xl border border-danger/15 bg-gradient-to-r from-danger/5 to-transparent p-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/12 text-danger">
                              <ShieldAlert className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-danger">
                              Overdue books
                            </p>
                          </div>
                          <p className="mt-2 font-display text-2xl font-black tracking-tight text-foreground">
                            {formatCount(metrics.overdueCount)}
                          </p>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                            {metrics.overdueCount > 0
                              ? "Open circulation first and review overdue books."
                              : "No overdue books need action."}
                          </p>
                        </div>

                        <div className="rounded-xl border border-warning/15 bg-gradient-to-r from-warning/5 to-transparent p-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/12 text-warning">
                              <Activity className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-warning">
                              Top waiting list book
                            </p>
                          </div>
                          <p className="mt-2 text-sm font-bold text-foreground">
                            {metricsQuery.topQueuedBook?.title ??
                              "No waiting list hotspot"}
                          </p>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                            {metricsQuery.topQueuedBook
                              ? `${formatCount(metricsQuery.topQueuedBook.waitingCount)} readers are waiting for this book.`
                              : "No books currently have a waiting list."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollReveal>

                {/* Waiting List Activity Bar Chart */}
                <ScrollReveal direction="up" delayMs={180}>
                  <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 py-0 shadow-sm shadow-primary/5">
                    <CardHeader className="gap-2 border-b border-border/40 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                            Waiting List Activity
                          </p>
                          <CardTitle className="text-xl font-black tracking-tight">
                            Books with waiting readers
                          </CardTitle>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Users className="h-4 w-4" />
                        </div>
                      </div>
                      <CardDescription className="px-0 text-[13px] leading-relaxed">
                        Books currently requested by waiting readers.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 py-6">
                      <DashboardBarChart
                        items={queueChartItems}
                        emptyTitle="No waiting readers right now"
                        emptyMessage="There are currently no books with readers waiting."
                        valueFormatter={(value) =>
                          `${formatCount(value)} waiting`
                        }
                      />
                    </CardContent>
                  </Card>
                </ScrollReveal>
              </div>
            </div>

            {/* ───── Manage System ───── */}
            <ScrollReveal direction="up" delayMs={200}>
              <div className="space-y-4 pb-3">
                <div className="space-y-1 px-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-black tracking-tight text-foreground">
                      Manage System
                    </h2>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    Open the section you need next.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {QUICK_LINKS.map((item) => (
                    <QuickNavCard key={item.href} item={item} />
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
