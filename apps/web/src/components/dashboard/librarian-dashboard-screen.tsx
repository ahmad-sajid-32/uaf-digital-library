"use client";

// apps/web/src/components/dashboard/librarian-dashboard-screen.tsx
/**
 * Librarian operational dashboard screen.
 *
 * Purpose:
 * - Render the read-only operational overview for librarian work.
 * - Show truthful backend-backed pressure signals for circulation, fines,
 *   documents, and queue demand.
 * - Keep quick navigation focused on the shared owning modules rather than
 *   rebuilding those modules inside the dashboard.
 */

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BotMessageSquare,
  BookCopy,
  Clock3,
  CreditCard,
  FileText,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import {
  DashboardQuickLinks,
  type DashboardQuickLinkItem,
} from "@/components/dashboard/dashboard-quick-links";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrarianMetrics } from "@/hooks/useLibrarianMetrics";
import type {
  DocumentAttentionMetricItem,
  PopularBookMetricItem,
  QueueHotspotMetricItem,
} from "@/lib/api/librarian-metrics";
import { cn } from "@/lib/utils";

const LIBRARIAN_QUICK_LINKS: DashboardQuickLinkItem[] = [
  {
    title: "Catalog",
    summary: "Review inventory truth and queue-heavy titles.",
    href: "/librarian/catalog",
    icon: BookCopy,
  },
  {
    title: "Circulation",
    summary: "Supervise active and overdue loan pressure.",
    href: "/librarian/circulation",
    icon: LibraryBig,
  },
  {
    title: "Fines",
    summary: "Review pending fine records that still need action.",
    href: "/librarian/fines",
    icon: CreditCard,
  },
  {
    title: "Documents",
    summary: "Handle finalize, retry, and re-upload work.",
    href: "/librarian/documents",
    icon: FileText,
  },
  {
    title: "Assistant",
    summary: "Ask grounded questions against official documents.",
    href: "/librarian/assistant",
    icon: BotMessageSquare,
  },
];

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
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

function LibrarianDashboardLoadingState(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-44 rounded-[2rem]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-40 rounded-[2rem]" />
        <Skeleton className="h-40 rounded-[2rem]" />
        <Skeleton className="h-40 rounded-[2rem]" />
        <Skeleton className="h-40 rounded-[2rem]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
        <Skeleton className="h-96 rounded-[2rem]" />
        <Skeleton className="h-96 rounded-[2rem]" />
      </div>
      <Skeleton className="h-72 rounded-[2rem]" />
    </div>
  );
}

function DashboardErrorState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Card className="rounded-[2rem] border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Dashboard Read Failed
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load the librarian overview.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The previous data is still visible. Refresh to try loading the
              latest operational state.
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

function OverviewMetricCard(props: {
  title: string;
  value: number;
  summary: string;
  href: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "warning" | "neutral";
}): React.JSX.Element {
  const Icon = props.icon;
  const toneClassName =
    props.tone === "warning"
      ? "border-warning/20 bg-warning/10 text-warning"
      : props.tone === "neutral"
        ? "border-border/70 bg-background/70 text-muted-foreground"
        : "border-primary/20 bg-primary/10 text-primary";

  return (
    <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
      <CardContent className="flex h-full flex-col gap-5 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge
              variant="outline"
              className={cn("rounded-full", toneClassName)}
            >
              {props.title}
            </Badge>
            <p className="font-display text-3xl font-black tracking-tight text-foreground">
              {formatCount(props.value)}
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {props.summary}
        </p>
        <Button
          asChild
          variant="outline"
          className="mt-auto w-full justify-between rounded-xl"
        >
          <Link href={props.href}>
            {props.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function QuietOperationalState(): React.JSX.Element {
  return (
    <Card className="rounded-[2rem] border-success/20 bg-success/5 py-0 shadow-none">
      <CardContent className="px-6 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge
              variant="outline"
              className="rounded-full border-success/20 bg-success/10 text-success"
            >
              Quiet State
            </Badge>
            <p className="text-xl font-black tracking-tight text-foreground">
              No active pressure needs escalation right now.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              The current backend signals show no overdue spike, no pending fine
              review backlog, and no document-processing actions waiting for
              staff.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/librarian/circulation">
              Open Circulation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RankedBooksList(props: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  items: Array<QueueHotspotMetricItem | PopularBookMetricItem>;
  emptyTitle: string;
  emptyMessage: string;
  valueLabel: (item: QueueHotspotMetricItem | PopularBookMetricItem) => string;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {props.eyebrow}
          </p>
          <p className="text-lg font-black tracking-tight text-foreground">
            {props.title}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {props.description}
          </p>
        </div>
        <Button asChild variant="ghost" className="rounded-xl px-3">
          <Link href={props.href}>
            {props.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {props.items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/55 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">
            {props.emptyTitle}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {props.emptyMessage}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {props.items.map((item, index) => (
            <div
              key={"bookId" in item ? item.bookId : `${props.eyebrow}-${index}`}
              className="flex items-center gap-4 rounded-[1.5rem] border border-border/60 bg-background/55 px-4 py-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="text-sm font-bold">{index + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {props.valueLabel(item)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getDocumentAttentionLabel(item: DocumentAttentionMetricItem): {
  label: string;
  className: string;
} {
  if (item.requiresReupload) {
    return {
      label: "Re-upload required",
      className:
        "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    };
  }

  if (item.canRetryFinalize) {
    return {
      label: "Retry finalize",
      className: "border-warning/20 bg-warning/10 text-warning",
    };
  }

  return {
    label: "Ready to finalize",
    className: "border-primary/20 bg-primary/10 text-primary",
  };
}

function DocumentAttentionSection(props: {
  items: DocumentAttentionMetricItem[];
}): React.JSX.Element {
  return (
    <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Document Attention
            </p>
            <CardTitle className="text-2xl font-black tracking-tight">
              Records needing staff action
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6">
              Uploaded, failed, or stale document records appear here when staff
              needs to finalize, retry, or re-upload them.
            </CardDescription>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/librarian/documents">
              Open Documents
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 px-6 py-6">
        {props.items.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/55 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              No document-processing actions are waiting right now.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              When uploaded, failed, or stale records need intervention, they
              will appear here.
            </p>
          </div>
        ) : (
          props.items.map((item) => {
            const attentionLabel = getDocumentAttentionLabel(item);

            return (
              <div
                key={item.documentId}
                className="rounded-[1.5rem] border border-border/60 bg-background/55 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <DocumentStatusBadge
                      status={item.processingStatus}
                      isUploadStale={item.requiresReupload}
                    />
                    <Badge
                      variant="outline"
                      className={cn("rounded-full", attentionLabel.className)}
                    >
                      {attentionLabel.label}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.lifecycleNote}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function LibrarianDashboardScreen(): React.JSX.Element {
  const metricsQuery = useLibrarianMetrics({
    autoLoad: true,
  });
  const metrics = metricsQuery.metrics;

  return (
    <PageContainer
      eyebrow="Librarian Workspace"
      title="Dashboard"
      description="See current circulation, fines, queue, and document attention from one read-only operational overview."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={metricsQuery.loading || metricsQuery.refreshing}
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
      }
    >
      <div className="flex flex-1 flex-col gap-6">
        {metricsQuery.loading ? <LibrarianDashboardLoadingState /> : null}

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
              <Card className="rounded-[2rem] border-primary/15 bg-gradient-to-br from-primary/8 via-card to-card py-0 shadow-none">
                <CardContent className="space-y-5 px-6 py-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-2">
                      <h2 className="font-display text-3xl font-black tracking-tight text-foreground">
                        See what needs librarian attention now.
                      </h2>
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                        {metricsQuery.isOperationallyQuiet
                          ? "Operations are quiet right now. No immediate librarian pressure is open."
                          : metrics.overdueLoanCount > 0
                            ? "Overdue loans need attention first."
                            : metrics.documentsRequiringActionCount > 0
                              ? "Document processing has records that need action."
                              : metrics.pendingFineCount > 0
                                ? "Pending fine review is still open."
                                : "Circulation is active and should stay supervised."}
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] border border-border/60 bg-background/65 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Clock3 className="h-4 w-4 text-primary" />
                        Last refreshed{" "}
                        {formatRelativeTime(metricsQuery.lastLoadedAt)}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        This overview shows current circulation, fines,
                        documents, and queue pressure without exposing
                        admin-only analytics.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            <ScrollReveal direction="up" delayMs={55}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <OverviewMetricCard
                  title="Active Loans"
                  value={metrics.activeLoanCount}
                  summary={
                    metrics.activeLoanCount > 0
                      ? "Current circulation load is live and needs routine supervision."
                      : "No live loan workload is open right now."
                  }
                  href="/librarian/circulation"
                  actionLabel="Open circulation"
                  icon={LibraryBig}
                  tone="primary"
                />
                <OverviewMetricCard
                  title="Overdue Loans"
                  value={metrics.overdueLoanCount}
                  summary={
                    metrics.overdueLoanCount > 0
                      ? "These records need immediate circulation attention."
                      : "No overdue loans are currently open."
                  }
                  href="/librarian/circulation"
                  actionLabel="Review overdue"
                  icon={ShieldAlert}
                  tone="warning"
                />
                <OverviewMetricCard
                  title="Pending Fines"
                  value={metrics.pendingFineCount}
                  summary={
                    metrics.pendingFineCount > 0
                      ? "Pending fine records still need librarian review."
                      : "No fine records are currently waiting for review."
                  }
                  href="/librarian/fines"
                  actionLabel="Open fines"
                  icon={CreditCard}
                  tone="neutral"
                />
                <OverviewMetricCard
                  title="Documents Needing Action"
                  value={metrics.documentsRequiringActionCount}
                  summary={
                    metrics.documentsRequiringActionCount > 0
                      ? "Some documents still need finalize, retry, or re-upload action."
                      : "No document-processing actions are waiting right now."
                  }
                  href="/librarian/documents"
                  actionLabel="Open documents"
                  icon={FileText}
                  tone="primary"
                />
              </div>
            </ScrollReveal>

            {metricsQuery.isOperationallyQuiet ? (
              <ScrollReveal direction="up" delayMs={70}>
                <QuietOperationalState />
              </ScrollReveal>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
              <ScrollReveal direction="up" delayMs={85}>
                <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
                  <CardContent className="grid gap-6 px-6 py-6">
                    <RankedBooksList
                      eyebrow="Queue Pressure"
                      title="Highest-demand books"
                      description="These titles currently have the strongest waiting pressure and should guide inventory or circulation attention first."
                      href="/librarian/catalog"
                      actionLabel="Open catalog"
                      items={metricsQuery.queueHotspots}
                      emptyTitle="No books currently have waiting readers."
                      emptyMessage="Queue hotspots will appear here when reader demand starts to pile up around specific titles."
                      valueLabel={(item) =>
                        `${formatCount("waitingCount" in item ? item.waitingCount : 0)} waiting reader${"waitingCount" in item && item.waitingCount === 1 ? "" : "s"}`
                      }
                    />

                    <RankedBooksList
                      eyebrow="Circulation Context"
                      title="Most borrowed right now"
                      description="Secondary catalog context for titles drawing the most borrowing activity."
                      href="/librarian/circulation"
                      actionLabel="Open circulation"
                      items={metricsQuery.popularBooks}
                      emptyTitle="No popular-book ranking yet."
                      emptyMessage="Borrow activity has not produced a ranked popular-books list yet."
                      valueLabel={(item) =>
                        `${formatCount("borrowCount" in item ? item.borrowCount : 0)} borrow${"borrowCount" in item && item.borrowCount === 1 ? "" : "s"} recorded`
                      }
                    />
                  </CardContent>
                </Card>
              </ScrollReveal>

              <ScrollReveal direction="up" delayMs={100}>
                <DocumentAttentionSection
                  items={metricsQuery.documentAttention}
                />
              </ScrollReveal>
            </div>

            <ScrollReveal direction="up" delayMs={115}>
              <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
                <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Quick Access
                  </p>
                  <CardTitle className="text-2xl font-black tracking-tight">
                    Open the owning module
                  </CardTitle>
                  <CardDescription className="px-0 text-sm leading-6">
                    Move directly from the dashboard into the shared staff
                    workspace that owns the next action.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 py-6">
                  <DashboardQuickLinks items={LIBRARIAN_QUICK_LINKS} />
                </CardContent>
              </Card>
            </ScrollReveal>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
