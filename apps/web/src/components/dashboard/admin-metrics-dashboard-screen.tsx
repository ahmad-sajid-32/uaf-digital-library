"use client";

// apps/web/src/components/dashboard/admin-metrics-dashboard-screen.tsx
/**
 * Admin metrics dashboard screen.
 *
 * Purpose:
 * - Present the admin dashboard as an operational governance surface.
 * - Prioritize overdue pressure, unresolved fine workload, waiting-list pressure,
 *   and circulation load before secondary activity insight.
 * - Keep Quick Actions at the end so the dashboard first explains the current
 *   system state, then routes the admin into the correct operational module.
 *
 * Integration notes:
 * - Uses the existing useAdminMetrics hook and preserves dashboard behavior.
 * - Uses existing dashboard visual helpers for chart/insight sections.
 * - Does not invent unavailable document/indexing metrics.
 */

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BotMessageSquare,
  BookCopy,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Gauge,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
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

/* ───────────────────────────── Types ───────────────────────────── */

type AdminMetricsSnapshot = NonNullable<
  ReturnType<typeof useAdminMetrics>["metrics"]
>;

type DashboardIcon = React.ComponentType<{ className?: string }>;

type GovernanceTone =
  | "critical"
  | "warning"
  | "primary"
  | "success"
  | "neutral";

interface QuickLinkItem {
  title: string;
  summary: string;
  href: string;
  icon: DashboardIcon;
  gradient: string;
  iconBg: string;
}

/* ───────────────────────────── Quick-link config ───────────────────────────── */

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
  if (!value) {
    return "Not loaded yet";
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - value) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.round(diffHours / 24)}d ago`;
}

function getToneClassName(tone: GovernanceTone): string {
  if (tone === "critical") {
    return "border-danger/25 bg-danger/10 text-danger";
  }

  if (tone === "warning") {
    return "border-warning/25 bg-warning/10 text-warning";
  }

  if (tone === "success") {
    return "border-success/25 bg-success/10 text-success";
  }

  if (tone === "neutral") {
    return "border-border/70 bg-background/70 text-muted-foreground";
  }

  return "border-primary/20 bg-primary/10 text-primary";
}

function getSystemHeadline(
  metrics: AdminMetricsSnapshot,
  isSystemQuiet: boolean,
  totalWaitingReaders: number,
): string {
  if (metrics.overdueCount > 0) {
    return "Overdue circulation pressure needs admin review.";
  }

  if (metrics.totalPendingFines > 0) {
    return "Pending fine workload needs financial review.";
  }

  if (totalWaitingReaders > 0) {
    return "Waiting-list pressure is building around requested titles.";
  }

  if (metrics.activeBorrowCount > 0) {
    return "Circulation is active with no urgent admin pressure.";
  }

  if (isSystemQuiet) {
    return "Nothing needs admin attention right now.";
  }

  return "System activity is available for review.";
}

function getGovernancePriority(
  metrics: AdminMetricsSnapshot,
  totalWaitingReaders: number,
): {
  label: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: DashboardIcon;
  tone: GovernanceTone;
} {
  if (metrics.overdueCount > 0) {
    return {
      label: "Highest Priority",
      title: `${formatCount(metrics.overdueCount)} overdue ${
        metrics.overdueCount === 1 ? "loan" : "loans"
      }`,
      description:
        "Overdue books create the highest operational risk. Review circulation before looking at general activity trends.",
      href: "/admin/circulation",
      actionLabel: "Review Circulation",
      icon: ShieldAlert,
      tone: "critical",
    };
  }

  if (metrics.totalPendingFines > 0) {
    return {
      label: "Financial Workload",
      title: `${formatMoney(metrics.totalPendingFines)} pending`,
      description:
        "Fine records are still unresolved. Open fine management to review settlement and waiver status.",
      href: "/admin/fines",
      actionLabel: "Review Fines",
      icon: CreditCard,
      tone: "warning",
    };
  }

  if (totalWaitingReaders > 0) {
    return {
      label: "Queue Pressure",
      title: `${formatCount(totalWaitingReaders)} waiting ${
        totalWaitingReaders === 1 ? "reader" : "readers"
      }`,
      description:
        "Reader demand is collecting around unavailable titles. Review queue pressure and catalog availability.",
      href: "/admin/catalog",
      actionLabel: "Review Catalog",
      icon: UsersRound,
      tone: "primary",
    };
  }

  if (metrics.activeBorrowCount > 0) {
    return {
      label: "Active Circulation",
      title: `${formatCount(metrics.activeBorrowCount)} active ${
        metrics.activeBorrowCount === 1 ? "borrow" : "borrows"
      }`,
      description:
        "Books are currently issued. No urgent pressure is visible, but circulation activity should remain supervised.",
      href: "/admin/circulation",
      actionLabel: "Open Circulation",
      icon: LibraryBig,
      tone: "primary",
    };
  }

  return {
    label: "Quiet State",
    title: "No immediate workload",
    description:
      "There are no overdue loans, pending fines, waiting-list pressure, or active borrow records requiring admin action.",
    href: "/admin/catalog",
    actionLabel: "Open Catalog",
    icon: CheckCircle2,
    tone: "success",
  };
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
  const [displayValue, setDisplayValue] = React.useState(value);
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    prevValueRef.current = value;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const duration = 650;
    const startTime = performance.now();
    let frameId = 0;

    function animate(currentTime: number): void {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
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

  const points = values.map((value, index) => {
    const x =
      padding +
      (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (value / maxVal) * (height - padding * 2);

    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;
  const gradientId = `spark-fill-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-7 w-20", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
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

/* ──────────────────────── Shared control helpers ────────────────────────── */

function DashboardLinkButton(props: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}): React.JSX.Element {
  return (
    <Button
      asChild
      variant={props.variant ?? "outline"}
      className={cn("justify-between gap-2 rounded-xl", props.className)}
    >
      <Link href={props.href}>
        {props.children}
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    </Button>
  );
}

function SystemPulse({ isQuiet }: { isQuiet: boolean }): React.JSX.Element {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {!isQuiet ? (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
      ) : null}
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          isQuiet ? "bg-muted-foreground/40" : "bg-success",
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
    <div className="overflow-hidden rounded-2xl border border-danger/20 bg-danger/5 p-5">
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
            {props.hasStaleData ? (
              <p className="text-[12px] text-muted-foreground/70">
                Showing previous dashboard information. Refresh to load the
                latest state.
              </p>
            ) : null}
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

/* ─────────────────────── Governance components ───────────────────────── */

function GovernanceCommandCenter(props: {
  metrics: AdminMetricsSnapshot;
  isSystemQuiet: boolean;
  lastLoadedAt: number | null;
  totalWaitingReaders: number;
  onRefresh: () => void | Promise<void>;
  isRefreshing: boolean;
}): React.JSX.Element {
  const priority = getGovernancePriority(
    props.metrics,
    props.totalWaitingReaders,
  );
  const PriorityIcon = priority.icon;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/95 p-4 shadow-sm sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary" />
      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit rounded-full bg-primary/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary shadow-none hover:bg-primary/12">
                <Zap className="mr-1.5 h-3 w-3" />
                Admin Governance
              </Badge>
              <div className="space-y-2">
                <h1 className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                  Dashboard
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {getSystemHeadline(
                    props.metrics,
                    props.isSystemQuiet,
                    props.totalWaitingReaders,
                  )}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 sm:w-fit"
              disabled={props.isRefreshing}
              onClick={() => {
                void props.onRefresh();
              }}
            >
              {props.isRefreshing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/40 bg-background/60 px-4 py-3 backdrop-blur-sm sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <SystemPulse isQuiet={props.isSystemQuiet} />
              <span className="text-[13px] font-medium text-foreground">
                {props.isSystemQuiet ? "No urgent items" : "Attention required"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Last refreshed {formatRelativeTime(props.lastLoadedAt)}
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              {formatCount(props.metrics.activeBorrowCount)} active
            </div>
          </div>
        </div>

        <div
          className={cn(
            "rounded-[1.75rem] border p-5",
            getToneClassName(priority.tone),
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start xl:flex-col">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-current/20 bg-background/50">
              <PriorityIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <Badge
                variant="outline"
                className="rounded-full border-current/20 bg-background/45 text-current"
              >
                {priority.label}
              </Badge>
              <div className="space-y-2">
                <p className="text-2xl font-black tracking-tight text-foreground">
                  {priority.title}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {priority.description}
                </p>
              </div>
              <DashboardLinkButton
                href={priority.href}
                variant="default"
                className="w-full sm:w-fit xl:w-full"
              >
                {priority.actionLabel}
              </DashboardLinkButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GovernanceMetricCard(props: {
  title: string;
  value: number;
  formattedValue: string;
  summary: string;
  href: string;
  actionLabel: string;
  icon: DashboardIcon;
  tone: GovernanceTone;
  sparkValues?: number[];
  trendLabel?: string;
}): React.JSX.Element {
  const Icon = props.icon;
  const sparkColor =
    props.tone === "critical"
      ? "hsl(var(--danger))"
      : props.tone === "warning"
        ? "hsl(var(--warning))"
        : "hsl(var(--primary))";

  return (
    <Card className="group overflow-hidden rounded-2xl border-border/50 bg-card/95 py-0 shadow-sm transition-colors duration-200 hover:border-primary/25">
      <CardContent className="relative flex h-full flex-col gap-4 p-5">
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                  getToneClassName(props.tone),
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {props.title}
              </p>
            </div>

            <div className="flex items-end gap-3">
              <AnimatedCounter
                value={props.value}
                formatter={() => props.formattedValue}
                className="font-display text-3xl font-black tracking-tight text-foreground"
              />
              {props.sparkValues && props.sparkValues.length > 1 ? (
                <MiniSparkline
                  values={props.sparkValues}
                  color={sparkColor}
                  className="mb-1"
                />
              ) : null}
            </div>

            {props.trendLabel ? (
              <Badge
                variant="outline"
                className={cn(
                  "w-fit rounded-full text-[10px] font-semibold",
                  getToneClassName(props.tone),
                )}
              >
                <TrendingUp className="mr-1 h-3 w-3" />
                {props.trendLabel}
              </Badge>
            ) : null}
          </div>
        </div>

        <p className="relative text-[13px] leading-relaxed text-muted-foreground">
          {props.summary}
        </p>

        <DashboardLinkButton
          href={props.href}
          className="relative mt-auto w-full"
        >
          {props.actionLabel}
        </DashboardLinkButton>
      </CardContent>
    </Card>
  );
}

function OperationalPressurePanel(props: {
  queueItems: DashboardChartDatum[];
  totalWaitingReaders: number;
  topQueuedBookTitle: string | null;
  topQueuedBookWaitingCount: number | null;
  overdueCount: number;
}): React.JSX.Element {
  return (
    <Card className="overflow-hidden rounded-2xl border-danger/12 bg-card/95 py-0 shadow-sm shadow-danger/5">
      <CardHeader className="gap-2 border-b border-border/40 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-danger">
              Operational Pressure
            </p>
            <CardTitle className="text-xl font-black tracking-tight">
              Queue and overdue pressure
            </CardTitle>
            <CardDescription className="px-0 text-[13px] leading-relaxed">
              Use this section to spot books creating waiting-list or overdue
              pressure before reviewing general activity.
            </CardDescription>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <Gauge className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(260px,0.65fr)]">
        <DashboardDonutChart
          items={props.queueItems}
          totalLabel="Waiting readers"
          totalValue={formatCount(props.totalWaitingReaders)}
          emptyLabel="No waiting readers right now"
          valueFormatter={(value) => `${formatCount(value)} waiting`}
        />

        <div className="grid gap-3">
          <div className="rounded-xl border border-danger/15 bg-danger/5 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/12 text-danger">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-danger">
                Overdue loans
              </p>
            </div>
            <p className="mt-2 font-display text-2xl font-black tracking-tight text-foreground">
              {formatCount(props.overdueCount)}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {props.overdueCount > 0
                ? "Open circulation first and review overdue books."
                : "No overdue books need admin attention."}
            </p>
          </div>

          <div className="rounded-xl border border-warning/15 bg-warning/5 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning">
                <UsersRound className="h-3.5 w-3.5" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-warning">
                Top waiting title
              </p>
            </div>
            <p className="mt-2 break-words text-sm font-bold text-foreground">
              {props.topQueuedBookTitle ?? "No waiting-list hotspot"}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {props.topQueuedBookTitle && props.topQueuedBookWaitingCount
                ? `${formatCount(
                    props.topQueuedBookWaitingCount,
                  )} readers are waiting for this book.`
                : "No books currently have a waiting list."}
            </p>
          </div>

          <DashboardLinkButton href="/admin/circulation" className="w-full">
            Open Circulation
          </DashboardLinkButton>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityInsightCard(props: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: DashboardIcon;
  children: React.ReactNode;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 py-0 shadow-sm shadow-primary/5">
      <CardHeader className="gap-2 border-b border-border/40 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              {props.eyebrow}
            </p>
            <CardTitle className="text-xl font-black tracking-tight">
              {props.title}
            </CardTitle>
            <CardDescription className="px-0 text-[13px] leading-relaxed">
              {props.description}
            </CardDescription>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
        {props.children}
        <div className="mt-5">
          <DashboardLinkButton
            href={props.href}
            variant="ghost"
            className="w-full sm:w-fit"
          >
            {props.actionLabel}
          </DashboardLinkButton>
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────── Quick Actions ──────────────────────── */

function QuickNavCard({ item }: { item: QuickLinkItem }): React.JSX.Element {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex min-w-0 items-center gap-3.5 overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br p-4 transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5",
        item.gradient,
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          item.iconBg,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold text-foreground">
          {item.title}
        </p>
        <p className="mt-0.5 break-words text-[12px] leading-5 text-muted-foreground">
          {item.summary}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
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
        coverImageUrl: item.coverImageUrl,
        coverImageAlt: item.coverImageAlt,
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
        coverImageUrl: item.coverImageUrl,
        coverImageAlt: item.coverImageAlt,
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

  const borrowSparkValues = React.useMemo(
    () =>
      metricsQuery.popularBooks.length > 0
        ? metricsQuery.popularBooks.map((book) => book.borrowCount)
        : [0, 0],
    [metricsQuery.popularBooks],
  );

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col gap-5">
        {metricsQuery.loading ? <DashboardLoadingState /> : null}

        {!metricsQuery.loading &&
        metricsQuery.error &&
        !metricsQuery.hasData ? (
          <DashboardErrorState
            hasStaleData={metricsQuery.hasStaleData}
            message={metricsQuery.error}
            onRetry={metricsQuery.retry}
          />
        ) : null}

        {!metricsQuery.loading && metricsQuery.hasData && metrics ? (
          <>
            {metricsQuery.error ? (
              <DashboardErrorState
                hasStaleData={metricsQuery.hasStaleData}
                message={metricsQuery.error}
                onRetry={metricsQuery.retry}
              />
            ) : null}

            <ScrollReveal direction="up" delayMs={30}>
              <GovernanceCommandCenter
                metrics={metrics}
                isSystemQuiet={metricsQuery.isSystemQuiet}
                lastLoadedAt={metricsQuery.lastLoadedAt}
                totalWaitingReaders={totalWaitingReaders}
                onRefresh={metricsQuery.refresh}
                isRefreshing={metricsQuery.loading || metricsQuery.refreshing}
              />
            </ScrollReveal>

            <ScrollReveal direction="up" delayMs={70}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <GovernanceMetricCard
                  title="Overdue Loans"
                  value={metrics.overdueCount}
                  formattedValue={formatCount(metrics.overdueCount)}
                  summary={
                    metrics.overdueCount > 0
                      ? "Highest-priority circulation records that need review."
                      : "No overdue books currently need review."
                  }
                  href="/admin/circulation"
                  actionLabel="Review"
                  icon={ShieldAlert}
                  tone={metrics.overdueCount > 0 ? "critical" : "neutral"}
                  trendLabel={
                    metrics.overdueCount > 0 ? "Needs Attention" : undefined
                  }
                />
                <GovernanceMetricCard
                  title="Pending Fines"
                  value={metrics.totalPendingFines}
                  formattedValue={formatMoney(metrics.totalPendingFines)}
                  summary={
                    metrics.totalPendingFines > 0
                      ? "Unresolved fine workload visible at system level."
                      : "No unpaid fines are currently pending."
                  }
                  href="/admin/fines"
                  actionLabel="Open"
                  icon={CreditCard}
                  tone={metrics.totalPendingFines > 0 ? "warning" : "neutral"}
                  trendLabel={
                    metrics.totalPendingFines > 0 ? "Outstanding" : undefined
                  }
                />
                <GovernanceMetricCard
                  title="Waiting Readers"
                  value={totalWaitingReaders}
                  formattedValue={formatCount(totalWaitingReaders)}
                  summary={
                    totalWaitingReaders > 0
                      ? "Readers waiting for unavailable or high-demand titles."
                      : "No readers are currently waiting in queues."
                  }
                  href="/admin/catalog"
                  actionLabel="Check"
                  icon={UsersRound}
                  tone={totalWaitingReaders > 0 ? "primary" : "neutral"}
                  trendLabel={
                    totalWaitingReaders > 0 ? "Queue Pressure" : undefined
                  }
                />
                <GovernanceMetricCard
                  title="Active Borrows"
                  value={metrics.activeBorrowCount}
                  formattedValue={formatCount(metrics.activeBorrowCount)}
                  summary={
                    metrics.activeBorrowCount > 0
                      ? "Live circulation load across currently borrowed books."
                      : "No books are currently borrowed."
                  }
                  href="/admin/circulation"
                  actionLabel="Open"
                  icon={LibraryBig}
                  tone="primary"
                  sparkValues={borrowSparkValues}
                  trendLabel={
                    metrics.activeBorrowCount > 0 ? "Live" : undefined
                  }
                />
              </div>
            </ScrollReveal>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <ScrollReveal direction="up" delayMs={100}>
                <OperationalPressurePanel
                  queueItems={queueChartItems}
                  totalWaitingReaders={totalWaitingReaders}
                  topQueuedBookTitle={metricsQuery.topQueuedBook?.title ?? null}
                  topQueuedBookWaitingCount={
                    metricsQuery.topQueuedBook?.waitingCount ?? null
                  }
                  overdueCount={metrics.overdueCount}
                />
              </ScrollReveal>

              <ScrollReveal direction="up" delayMs={120}>
                <ActivityInsightCard
                  eyebrow="Waiting List Activity"
                  title="Books with waiting readers"
                  description="Secondary view of titles currently requested by waiting readers."
                  href="/admin/catalog"
                  actionLabel="Open Catalog"
                  icon={Users}
                >
                  <DashboardBarChart
                    items={queueChartItems}
                    emptyTitle="No waiting readers right now"
                    emptyMessage="There are currently no books with readers waiting."
                    valueFormatter={(value) => `${formatCount(value)} waiting`}
                  />
                </ActivityInsightCard>
              </ScrollReveal>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <ScrollReveal direction="up" delayMs={150}>
                <ActivityInsightCard
                  eyebrow="Book Activity"
                  title="Borrow activity"
                  description="Borrow activity across the most active titles."
                  href="/admin/circulation"
                  actionLabel="Open Circulation"
                  icon={TrendingUp}
                >
                  <DashboardActivityContour
                    items={popularChartItems}
                    emptyTitle="No borrowing activity yet"
                    emptyMessage="Most-borrowed books will appear here when borrowing records are available."
                    valueFormatter={(value) => `${formatCount(value)} borrows`}
                  />
                </ActivityInsightCard>
              </ScrollReveal>

              <ScrollReveal direction="up" delayMs={170}>
                <ActivityInsightCard
                  eyebrow="Catalog Activity"
                  title="Most borrowed books"
                  description="Titles attracting the most borrowing volume after urgent workload is reviewed."
                  href="/admin/catalog"
                  actionLabel="Open Catalog"
                  icon={BookCopy}
                >
                  <DashboardBarChart
                    items={popularChartItems}
                    emptyTitle="No popular-book data yet"
                    emptyMessage="Borrow activity has not produced any ranked popular-book data yet."
                    valueFormatter={(value) => `${formatCount(value)} borrows`}
                  />
                </ActivityInsightCard>
              </ScrollReveal>
            </div>

            <ScrollReveal direction="up" delayMs={200}>
              <div className="space-y-4 pb-3">
                <div className="space-y-1 px-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-black tracking-tight text-foreground">
                      Quick Actions
                    </h2>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    Open the admin section that owns your next action.
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
