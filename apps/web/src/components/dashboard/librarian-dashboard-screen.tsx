"use client";

// apps/web/src/components/dashboard/librarian-dashboard-screen.tsx
/**
 * Librarian operational dashboard screen.
 *
 * Purpose:
 * - Render the librarian's daily operational workbench.
 * - Prioritize overdue loans, pending fines, document-processing actions,
 *   and queue pressure before general circulation insights.
 * - Keep the dashboard read-only and route users into the owning modules
 *   instead of duplicating full management workflows here.
 */

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BotMessageSquare,
  BookCopy,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  FileWarning,
  LibraryBig,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UsersRound,
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

type DashboardIcon = React.ComponentType<{ className?: string }>;

type CardTone = "primary" | "warning" | "danger" | "success" | "neutral";

type AttentionItem = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: DashboardIcon;
  tone: CardTone;
};

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

function getToneClassName(tone: CardTone): string {
  if (tone === "danger") {
    return "border-destructive/25 bg-destructive/10 text-destructive";
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

function LibrarianDashboardLoadingState(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-64 rounded-[2rem]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-[2rem]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Skeleton className="h-96 rounded-[2rem]" />
        <Skeleton className="h-96 rounded-[2rem]" />
      </div>
      <Skeleton className="h-80 rounded-[2rem]" />
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
              Dashboard Update Failed
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
              The previous dashboard information is still visible. Refresh to
              load the latest operational state.
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

function AttentionPanel(props: {
  items: AttentionItem[];
  lastLoadedAt: number | null;
}): React.JSX.Element {
  const [featuredItem, ...secondaryItems] = props.items;

  if (!featuredItem) {
    return (
      <Card className="rounded-[2rem] border-success/20 bg-success/5 py-0 shadow-none">
        <CardContent className="grid gap-5 px-5 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <Badge
                variant="outline"
                className="rounded-full border-success/25 bg-success/10 text-success"
              >
                Quiet State
              </Badge>
              <p className="text-2xl font-black tracking-tight text-foreground">
                No immediate librarian pressure is open.
              </p>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                There are no overdue-loan spikes, no pending fine backlog, no
                document-processing actions, and no queue hotspots requiring
                immediate staff attention.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.5rem] border border-border/60 bg-background/65 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 className="h-4 w-4 text-primary" />
                Last refreshed {formatRelativeTime(props.lastLoadedAt)}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Continue routine supervision from circulation or catalog when
                new activity appears.
              </p>
            </div>
            <DashboardLinkButton
              href="/librarian/circulation"
              className="w-full"
            >
              Open Circulation
            </DashboardLinkButton>
          </div>
        </CardContent>
      </Card>
    );
  }

  const FeaturedIcon = featuredItem.icon;

  return (
    <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
      <CardContent className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className={cn(
            "rounded-[2rem] border px-5 py-5",
            getToneClassName(featuredItem.tone),
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-background/50">
              <FeaturedIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <Badge
                variant="outline"
                className="rounded-full border-current/20 bg-background/45 text-current"
              >
                {featuredItem.eyebrow}
              </Badge>
              <div className="space-y-2">
                <p className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {featuredItem.title}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {featuredItem.description}
                </p>
              </div>
              <DashboardLinkButton
                href={featuredItem.href}
                variant="default"
                className="w-full sm:w-fit"
              >
                {featuredItem.actionLabel}
              </DashboardLinkButton>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[1.5rem] border border-border/60 bg-background/65 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock3 className="h-4 w-4 text-primary" />
              Last refreshed {formatRelativeTime(props.lastLoadedAt)}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Handle the highest-priority item first, then clear the remaining
              staff workload below.
            </p>
          </div>

          {secondaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className="group rounded-[1.5rem] border border-border/60 bg-background/55 px-4 py-4 transition hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                      getToneClassName(item.tone),
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-foreground">
                        {item.title}
                      </p>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
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
  icon: DashboardIcon;
  tone: CardTone;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
      <CardContent className="flex h-full flex-col gap-5 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Badge
              variant="outline"
              className={cn("rounded-full", getToneClassName(props.tone))}
            >
              {props.title}
            </Badge>
            <p className="font-display text-3xl font-black tracking-tight text-foreground">
              {formatCount(props.value)}
            </p>
          </div>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
              getToneClassName(props.tone),
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {props.summary}
        </p>
        <DashboardLinkButton href={props.href} className="mt-auto w-full">
          {props.actionLabel}
        </DashboardLinkButton>
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
  icon: DashboardIcon;
  valueLabel: (item: QueueHotspotMetricItem | PopularBookMetricItem) => string;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-2 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {props.eyebrow}
              </p>
              <CardTitle className="text-2xl font-black tracking-tight">
                {props.title}
              </CardTitle>
              <CardDescription className="px-0 text-sm leading-6">
                {props.description}
              </CardDescription>
            </div>
          </div>
          <DashboardLinkButton
            href={props.href}
            variant="ghost"
            className="w-full px-3 sm:w-fit"
          >
            {props.actionLabel}
          </DashboardLinkButton>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 px-5 py-5 sm:px-6 sm:py-6">
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
          props.items.map((item, index) => (
            <div
              key={"bookId" in item ? item.bookId : `${props.eyebrow}-${index}`}
              className="rounded-[1.5rem] border border-border/60 bg-background/55 px-4 py-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="text-sm font-bold">{index + 1}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {props.valueLabel(item)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function getDocumentAttentionLabel(item: DocumentAttentionMetricItem): {
  label: string;
  className: string;
  icon: DashboardIcon;
} {
  if (item.requiresReupload) {
    return {
      label: "Re-upload required",
      className:
        "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      icon: FileWarning,
    };
  }

  if (item.canRetryFinalize) {
    return {
      label: "Retry finalize",
      className: "border-warning/20 bg-warning/10 text-warning",
      icon: RefreshCw,
    };
  }

  return {
    label: "Ready to finalize",
    className: "border-primary/20 bg-primary/10 text-primary",
    icon: CheckCircle2,
  };
}

function DocumentAttentionSection(props: {
  items: DocumentAttentionMetricItem[];
}): React.JSX.Element {
  return (
    <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-2 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Document Attention
              </p>
              <CardTitle className="text-2xl font-black tracking-tight">
                Records needing staff action
              </CardTitle>
              <CardDescription className="px-0 text-sm leading-6">
                Uploaded, failed, or stale document records appear here when
                staff needs to finalize, retry, or re-upload them.
              </CardDescription>
            </div>
          </div>
          <DashboardLinkButton
            href="/librarian/documents"
            variant="ghost"
            className="w-full px-3 sm:w-fit"
          >
            Open Documents
          </DashboardLinkButton>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 px-5 py-5 sm:px-6 sm:py-6">
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
            const AttentionIcon = attentionLabel.icon;

            return (
              <div
                key={item.documentId}
                className="rounded-[1.5rem] border border-border/60 bg-background/55 px-4 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <p className="break-words text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.lifecycleNote}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <DocumentStatusBadge
                      status={item.processingStatus}
                      isUploadStale={item.requiresReupload}
                    />
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 rounded-full",
                        attentionLabel.className,
                      )}
                    >
                      <AttentionIcon className="h-3.5 w-3.5" />
                      {attentionLabel.label}
                    </Badge>
                  </div>
                </div>
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

  const attentionItems = React.useMemo<AttentionItem[]>(() => {
    if (!metrics) {
      return [];
    }

    const items: AttentionItem[] = [];

    if (metrics.overdueLoanCount > 0) {
      items.push({
        key: "overdue-loans",
        eyebrow: "First Priority",
        title: `${formatCount(metrics.overdueLoanCount)} overdue ${
          metrics.overdueLoanCount === 1 ? "loan" : "loans"
        }`,
        description:
          "Start here. Overdue loans need direct circulation follow-up before normal review work.",
        href: "/librarian/circulation",
        actionLabel: "Review Overdue Loans",
        icon: AlertTriangle,
        tone: "danger",
      });
    }

    if (metrics.pendingFineCount > 0) {
      items.push({
        key: "pending-fines",
        eyebrow: "Fine Review",
        title: `${formatCount(metrics.pendingFineCount)} pending ${
          metrics.pendingFineCount === 1 ? "fine" : "fines"
        }`,
        description:
          "Fine records still need staff review before they are settled, waived, or resolved.",
        href: "/librarian/fines",
        actionLabel: "Open Fine Management",
        icon: CreditCard,
        tone: "warning",
      });
    }

    if (metrics.documentsRequiringActionCount > 0) {
      items.push({
        key: "document-actions",
        eyebrow: "Document Processing",
        title: `${formatCount(
          metrics.documentsRequiringActionCount,
        )} document ${
          metrics.documentsRequiringActionCount === 1 ? "action" : "actions"
        }`,
        description:
          "Some uploaded records need finalize, retry, or re-upload work before they are reliable for retrieval.",
        href: "/librarian/documents",
        actionLabel: "Review Documents",
        icon: FileWarning,
        tone: "primary",
      });
    }

    if (metricsQuery.queueHotspots.length > 0) {
      items.push({
        key: "queue-hotspots",
        eyebrow: "Queue Pressure",
        title: `${formatCount(metricsQuery.queueHotspots.length)} queue ${
          metricsQuery.queueHotspots.length === 1 ? "hotspot" : "hotspots"
        }`,
        description:
          "Reader demand is concentrating around specific books. Use this to guide circulation and catalog attention.",
        href: "/librarian/catalog",
        actionLabel: "Review Queue Pressure",
        icon: UsersRound,
        tone: "primary",
      });
    }

    return items;
  }, [metrics, metricsQuery.queueHotspots.length]);

  return (
    <PageContainer
      eyebrow="Librarian Workspace"
      title="Dashboard"
      description="Review overdue loans, fine workload, document actions, and queue pressure before routine circulation work."
      actions={
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
      }
    >
      <div className="flex flex-1 flex-col gap-6">
        {metricsQuery.loading && !metricsQuery.hasData ? (
          <LibrarianDashboardLoadingState />
        ) : null}

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
              <AttentionPanel
                items={attentionItems}
                lastLoadedAt={metricsQuery.lastLoadedAt}
              />
            </ScrollReveal>

            <ScrollReveal direction="up" delayMs={55}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <OverviewMetricCard
                  title="Overdue Loans"
                  value={metrics.overdueLoanCount}
                  summary={
                    metrics.overdueLoanCount > 0
                      ? "These records need circulation follow-up first."
                      : "No overdue loans are currently open."
                  }
                  href="/librarian/circulation"
                  actionLabel="Review"
                  icon={ShieldAlert}
                  tone={metrics.overdueLoanCount > 0 ? "danger" : "neutral"}
                />
                <OverviewMetricCard
                  title="Pending Fines"
                  value={metrics.pendingFineCount}
                  summary={
                    metrics.pendingFineCount > 0
                      ? "Fine records still need librarian review."
                      : "No fine records are currently waiting for review."
                  }
                  href="/librarian/fines"
                  actionLabel="Open"
                  icon={CreditCard}
                  tone={metrics.pendingFineCount > 0 ? "warning" : "neutral"}
                />
                <OverviewMetricCard
                  title="Documents"
                  value={metrics.documentsRequiringActionCount}
                  summary={
                    metrics.documentsRequiringActionCount > 0
                      ? "Documents need finalize, retry, or re-upload action."
                      : "No document-processing actions are waiting."
                  }
                  href="/librarian/documents"
                  actionLabel="Check"
                  icon={FileWarning}
                  tone={
                    metrics.documentsRequiringActionCount > 0
                      ? "primary"
                      : "neutral"
                  }
                />
                <OverviewMetricCard
                  title="Queue Hotspots"
                  value={metricsQuery.queueHotspots.length}
                  summary={
                    metricsQuery.queueHotspots.length > 0
                      ? "Specific titles have waiting-list pressure."
                      : "No books currently have waiting-reader pressure."
                  }
                  href="/librarian/catalog"
                  actionLabel="Review"
                  icon={UsersRound}
                  tone={
                    metricsQuery.queueHotspots.length > 0
                      ? "primary"
                      : "neutral"
                  }
                />
                <OverviewMetricCard
                  title="Active Loans"
                  value={metrics.activeLoanCount}
                  summary={
                    metrics.activeLoanCount > 0
                      ? "Current circulation load needs routine supervision."
                      : "No live loan workload is open right now."
                  }
                  href="/librarian/circulation"
                  actionLabel="Open"
                  icon={LibraryBig}
                  tone="primary"
                />
              </div>
            </ScrollReveal>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <ScrollReveal direction="up" delayMs={80}>
                <RankedBooksList
                  eyebrow="Queue Pressure"
                  title="Highest-demand books"
                  description="Titles with waiting pressure appear here so staff can review circulation and inventory attention first."
                  href="/librarian/catalog"
                  actionLabel="Open Catalog"
                  items={metricsQuery.queueHotspots}
                  emptyTitle="No books currently have waiting readers."
                  emptyMessage="Queue hotspots will appear here when reader demand starts to build around specific titles."
                  icon={ListChecks}
                  valueLabel={(item) =>
                    `${formatCount(
                      "waitingCount" in item ? item.waitingCount : 0,
                    )} waiting ${
                      "waitingCount" in item && item.waitingCount === 1
                        ? "reader"
                        : "readers"
                    }`
                  }
                />
              </ScrollReveal>

              <ScrollReveal direction="up" delayMs={95}>
                <DocumentAttentionSection
                  items={metricsQuery.documentAttention}
                />
              </ScrollReveal>
            </div>

            <ScrollReveal direction="up" delayMs={110}>
              <RankedBooksList
                eyebrow="Circulation Insight"
                title="Most borrowed titles"
                description="Secondary context for titles with the highest borrowing activity. This is useful after urgent work is reviewed."
                href="/librarian/circulation"
                actionLabel="Open Circulation"
                items={metricsQuery.popularBooks}
                emptyTitle="No popular-book ranking yet."
                emptyMessage="Borrow activity has not produced a ranked popular-books list yet."
                icon={TrendingUp}
                valueLabel={(item) =>
                  `${formatCount(
                    "borrowCount" in item ? item.borrowCount : 0,
                  )} ${
                    "borrowCount" in item && item.borrowCount === 1
                      ? "borrow"
                      : "borrows"
                  } recorded`
                }
              />
            </ScrollReveal>

            <ScrollReveal direction="up" delayMs={125}>
              <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
                <CardHeader className="gap-2 border-b border-border/60 px-5 py-5 sm:px-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Quick Access
                      </p>
                      <CardTitle className="text-2xl font-black tracking-tight">
                        Open the owning module
                      </CardTitle>
                      <CardDescription className="px-0 text-sm leading-6">
                        Move from the dashboard into the staff workspace that
                        owns the next action.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
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
