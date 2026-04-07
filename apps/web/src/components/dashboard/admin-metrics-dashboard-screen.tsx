"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  BotMessageSquare,
  BookCopy,
  Clock3,
  CreditCard,
  FileText,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";
import {
  DashboardQuickLinks,
  type DashboardQuickLinkItem,
} from "@/components/dashboard/dashboard-quick-links";
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

const QUICK_LINKS: DashboardQuickLinkItem[] = [
  {
    title: "Circulation",
    summary: "Inspect active, overdue, and returned loan supervision.",
    href: "/admin/circulation",
    icon: LibraryBig,
  },
  {
    title: "Fines",
    summary: "Review unsettled balances and overdue-linked fine records.",
    href: "/admin/fines",
    icon: CreditCard,
  },
  {
    title: "Catalog",
    summary: "Open the staff inventory workspace for book management.",
    href: "/admin/catalog",
    icon: BookCopy,
  },
  {
    title: "Users",
    summary: "Jump into the administrative user-management module.",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Documents",
    summary: "Review institutional documents and processing state.",
    href: "/admin/documents",
    icon: FileText,
  },
  {
    title: "Assistant",
    summary: "Ask grounded questions against official institutional documents.",
    href: "/admin/assistant",
    icon: BotMessageSquare,
  },
];

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
    return `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} days ago`;
}

function getSystemHeadline(
  metrics: NonNullable<ReturnType<typeof useAdminMetrics>["metrics"]>,
  isSystemQuiet: boolean,
): string {
  if (isSystemQuiet) {
    return "System load is currently quiet.";
  }

  if (metrics.overdueCount > 0) {
    return "Overdue loans are driving the current attention set.";
  }

  if (metrics.queuePressure.length > 0) {
    return "Reader demand is concentrating around a few titles.";
  }

  if (metrics.activeBorrowCount > 0) {
    return "Circulation is active without immediate escalation.";
  }

  return "The dashboard is ready for the next operational review.";
}

function getSystemSummary(
  metrics: NonNullable<ReturnType<typeof useAdminMetrics>["metrics"]>,
  isSystemQuiet: boolean,
): string {
  if (isSystemQuiet) {
    return "No active borrows, overdue loans, pending fines, or queue hotspots are currently present. This is a real zero-state.";
  }

  if (metrics.overdueCount > 0) {
    return "Start with circulation and fines. The overdue set is the fastest path to the records most likely to need intervention.";
  }

  if (metrics.queuePressure.length > 0) {
    return "Focus on the titles attracting the most waiting readers. Queue pressure is the current operational hotspot.";
  }

  return "Use this overview to move quickly into the owning module for record-level work.";
}

function DashboardErrorState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Card className="rounded-[2rem] border-danger/20 bg-danger/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load the admin dashboard.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The current overview may be stale. Refresh to request the latest
              backend metrics truth.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 self-start rounded-xl sm:self-auto"
          onClick={() => {
            void props.onRetry();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function OverviewMetricBlock(props: {
  title: string;
  value: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "warning" | "fine";
  prominent?: boolean;
}): React.JSX.Element {
  const Icon = props.icon;
  const toneClassName =
    props.tone === "warning"
      ? "border-danger/20 bg-danger/5"
      : props.tone === "fine"
        ? "border-warning/20 bg-warning/5"
        : "border-primary/20 bg-primary/5";
  const iconClassName =
    props.tone === "warning"
      ? "bg-danger/10 text-danger"
      : props.tone === "fine"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";
  const eyebrowClassName =
    props.tone === "warning"
      ? "text-danger"
      : props.tone === "fine"
        ? "text-warning"
        : "text-primary";

  return (
    <div
      className={cn(
        "rounded-[1.6rem] border px-4 py-4 shadow-none",
        toneClassName,
        props.prominent ? "sm:col-span-2" : "",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.18em]",
              eyebrowClassName,
            )}
          >
            {props.title}
          </p>
          <p
            className={cn(
              "font-display font-black tracking-tight text-foreground",
              props.prominent ? "text-4xl" : "text-2xl",
            )}
          >
            {props.value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            iconClassName,
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {props.summary}
      </p>
    </div>
  );
}

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
        tone:
          index === 0
            ? "primary"
            : index === 1
              ? "accent"
              : "muted",
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
        tone:
          index === 0
            ? "danger"
            : index === 1
              ? "warning"
              : "primary",
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

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col gap-4">
        {metricsQuery.loading ? <DashboardLoadingState /> : null}

        {!metricsQuery.loading && metricsQuery.error && !metricsQuery.hasData ? (
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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.9fr)]">
              <div className="grid gap-4">
                <ScrollReveal direction="up" delayMs={40}>
                  <Card className="overflow-hidden rounded-[2rem] border-primary/15 bg-gradient-to-br from-primary/8 via-card to-card py-0 shadow-none">
                    <CardContent className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
                      <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                              Admin Overview
                            </p>
                            <h1 className="font-display text-3xl font-black tracking-tight text-foreground">
                              Dashboard
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                              {getSystemSummary(
                                metrics,
                                metricsQuery.isSystemQuiet,
                              )}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <Badge
                              variant="outline"
                              className="rounded-full border-primary/20 bg-primary/10 text-primary"
                            >
                              Admin Only
                            </Badge>
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2 rounded-xl"
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

                        <div className="rounded-[1.6rem] border border-border/60 bg-background/55 px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="rounded-full border-primary/20 bg-primary/10 text-primary"
                            >
                              System Status
                            </Badge>
                            <p className="text-sm font-semibold text-foreground">
                              {getSystemHeadline(
                                metrics,
                                metricsQuery.isSystemQuiet,
                              )}
                            </p>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-primary" />
                              <span>
                                Refreshed {formatRelativeTime(metricsQuery.lastLoadedAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-primary" />
                              <span>
                                {metricsQuery.isSystemQuiet
                                  ? "No immediate operational hotspots."
                                  : "Use the highlighted surfaces to choose the next workspace."}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <OverviewMetricBlock
                            title="Active Borrows"
                            value={formatCount(metrics.activeBorrowCount)}
                            summary={
                              metrics.activeBorrowCount > 0
                                ? "Current circulation load still out with borrowers."
                                : "No live borrow workload is open right now."
                            }
                            icon={LibraryBig}
                            tone="primary"
                            prominent
                          />
                          <OverviewMetricBlock
                            title="Overdue Loans"
                            value={formatCount(metrics.overdueCount)}
                            summary={
                              metrics.overdueCount > 0
                                ? "Open circulation to inspect borrower and return state."
                                : "No overdue loans currently need intervention."
                            }
                            icon={ShieldAlert}
                            tone="warning"
                          />
                          <OverviewMetricBlock
                            title="Pending Fines"
                            value={formatMoney(metrics.totalPendingFines)}
                            summary={
                              metrics.totalPendingFines > 0
                                ? "Unsettled balance is still open across the system."
                                : "No pending fine balance is currently outstanding."
                            }
                            icon={CreditCard}
                            tone="fine"
                          />
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-border/60 bg-background/55 px-4 py-4">
                        <div className="mb-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                            Ranked Activity Contour
                          </p>
                          <h2 className="text-lg font-black tracking-tight text-foreground">
                            Current catalog momentum
                          </h2>
                          <p className="text-sm leading-6 text-muted-foreground">
                            This graph-like contour shows the current shape of
                            borrow activity across the top-ranked titles. It
                            reflects ranked volume, not time-series trend data.
                          </p>
                        </div>

                        <DashboardActivityContour
                          items={popularChartItems}
                          emptyTitle="No popular-book contour yet"
                          emptyMessage="Borrow activity has not yet produced a ranked contour of popular titles."
                          valueFormatter={(value) =>
                            `${formatCount(value)} borrows`
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                </ScrollReveal>

                <ScrollReveal direction="up" delayMs={90}>
                  <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
                    <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Catalog Activity
                      </p>
                      <CardTitle className="text-2xl font-black tracking-tight">
                        Most borrowed books
                      </CardTitle>
                      <CardDescription className="px-0 text-sm leading-6">
                        Use this bar chart to spot titles currently attracting
                        the most borrowing volume.
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

              <div className="grid gap-4">
                <ScrollReveal direction="up" delayMs={60}>
                  <Card className="rounded-[2rem] border-danger/15 bg-card/95 py-0 shadow-none">
                    <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-danger">
                        Operational Attention
                      </p>
                      <CardTitle className="text-2xl font-black tracking-tight">
                        Current pressure map
                      </CardTitle>
                      <CardDescription className="px-0 text-sm leading-6">
                        This block highlights where queue demand and overdue
                        pressure are clustering right now.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5 px-6 py-6">
                      <DashboardDonutChart
                        items={queueChartItems}
                        totalLabel="Waiting readers"
                        totalValue={formatCount(totalWaitingReaders)}
                        emptyLabel="No queue pressure currently"
                        valueFormatter={(value) =>
                          `${formatCount(value)} waiting`
                        }
                      />

                      <div className="grid gap-3">
                        <div className="rounded-[1.6rem] border border-danger/20 bg-danger/5 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-danger">
                            Overdue pressure
                          </p>
                          <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                            {formatCount(metrics.overdueCount)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {metrics.overdueCount > 0
                              ? "Open circulation first. The overdue set is the strongest immediate workload."
                              : "No overdue records currently need intervention."}
                          </p>
                        </div>

                        <div className="rounded-[1.6rem] border border-warning/20 bg-warning/5 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning">
                            Queue hotspot
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {metricsQuery.topQueuedBook?.title ?? "No queue hotspot"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {metricsQuery.topQueuedBook
                              ? `${formatCount(metricsQuery.topQueuedBook.waitingCount)} readers are currently waiting on the highest-pressure title.`
                              : "No titles currently have a waiting queue."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollReveal>

                <ScrollReveal direction="up" delayMs={110}>
                  <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
                    <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Queue Pressure
                      </p>
                      <CardTitle className="text-2xl font-black tracking-tight">
                        Highest-demand titles
                      </CardTitle>
                      <CardDescription className="px-0 text-sm leading-6">
                        Ranked queue load shown as a bar chart for direct
                        comparison of current demand hotspots.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 py-6">
                      <DashboardBarChart
                        items={queueChartItems}
                        emptyTitle="No queue pressure currently"
                        emptyMessage="There are currently no books with readers waiting in the queue."
                        valueFormatter={(value) =>
                          `${formatCount(value)} waiting`
                        }
                      />
                    </CardContent>
                  </Card>
                </ScrollReveal>

                <ScrollReveal direction="up" delayMs={150}>
                  <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
                    <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Quick Navigation
                      </p>
                      <CardTitle className="text-2xl font-black tracking-tight">
                        Go to the owning workspace
                      </CardTitle>
                      <CardDescription className="px-0 text-sm leading-6">
                        The dashboard stays read-only. Jump to the module that
                        owns the next operational step.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 py-6">
                      <DashboardQuickLinks items={QUICK_LINKS} />
                    </CardContent>
                  </Card>
                </ScrollReveal>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
