"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BotMessageSquare,
  BookCopy,
  Clock3,
  CreditCard,
  GraduationCap,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import {
  DashboardQuickLinks,
  type DashboardQuickLinkItem,
} from "@/components/dashboard/dashboard-quick-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { getStudentBorrowDuePresentation } from "@/lib/student-borrows";
import {
  formatStudentFineAmount,
  formatStudentFineDateTime,
  getStudentFineStatusPresentation,
} from "@/lib/student-fines";
import {
  formatStudentQueueDateTime,
  getStudentQueueStatusPresentation,
} from "@/lib/student-queue";
import { cn } from "@/lib/utils";

const STUDENT_DASHBOARD_QUICK_LINKS: DashboardQuickLinkItem[] = [
  {
    title: "Browse Catalog",
    summary: "Open discovery and selected-book details.",
    href: "/student/catalog",
    icon: LibraryBig,
  },
  {
    title: "View My Borrows",
    summary: "Manage renew and return actions from active loans.",
    href: "/student/borrows",
    icon: BookCopy,
  },
  {
    title: "View Queue",
    summary: "Monitor waiting and hold-ready queue entries.",
    href: "/student/queue",
    icon: ScrollText,
  },
  {
    title: "View Fines",
    summary: "Review pending and historical fine records.",
    href: "/student/fines",
    icon: CreditCard,
  },
  {
    title: "View Result",
    summary: "Open your result page.",
    href: "/student/result",
    icon: GraduationCap,
  },
  {
    title: "Ask Assistant",
    summary: "Get grounded university-information help.",
    href: "/student/assistant",
    icon: BotMessageSquare,
  },
  {
    title: "Open Profile",
    summary: "Review your account information and settings.",
    href: "/student/profile",
    icon: UserCircle2,
  },
];

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

function DashboardLoadingState(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-44 rounded-4xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-4xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-56 rounded-4xl" />
        <Skeleton className="h-56 rounded-4xl" />
        <Skeleton className="h-56 rounded-4xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-4xl" />
        <Skeleton className="h-80 rounded-4xl" />
        <Skeleton className="h-80 rounded-4xl" />
      </div>
      <Skeleton className="h-72 rounded-4xl" />
    </div>
  );
}

function DashboardFailureState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Card className="rounded-4xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Dashboard Read Failed
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load your student overview.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The previous dashboard information is still visible. Refresh to
              load the latest updates.
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

function SummaryMetricCard(props: {
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
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
      : props.tone === "neutral"
        ? "border-border/70 bg-background/70 text-muted-foreground"
        : "border-primary/20 bg-primary/10 text-primary";

  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
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

function QuietState(): React.JSX.Element {
  return (
    <Card className="rounded-4xl border-emerald-500/20 bg-emerald-500/5 py-0 shadow-none">
      <CardContent className="px-6 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge
              variant="outline"
              className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
            >
              All Clear
            </Badge>
            <p className="text-xl font-black tracking-tight text-foreground">
              Nothing needs attention right now.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              You currently have no overdue books, pending fines, waiting-list
              entries, or pickup-ready books.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/student/catalog">
              Browse Catalog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionCard(props: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  toneClassName?: string;
}): React.JSX.Element {
  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-2 border-b border-border/60 px-5 py-5">
        <Badge
          variant="outline"
          className={cn("w-fit rounded-full", props.toneClassName)}
        >
          {props.eyebrow}
        </Badge>
        <CardTitle className="text-xl font-black tracking-tight">
          {props.title}
        </CardTitle>
        <CardDescription className="px-0 text-sm leading-6">
          {props.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <Button
          asChild
          variant="outline"
          className="w-full justify-between rounded-xl"
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

function PreviewSection(props: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  emptyTitle: string;
  emptyMessage: string;
  children: React.ReactNode;
  hasItems: boolean;
}): React.JSX.Element {
  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
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
          <Button asChild variant="ghost" className="rounded-xl px-3">
            <Link href={props.href}>
              {props.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 px-6 py-6">
        {props.hasItems ? (
          props.children
        ) : (
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/55 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              {props.emptyTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {props.emptyMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultSummaryCard(props: {
  summary: {
    cgpa: number | string | null;
    latest_semester_label: string | null;
    latest_semester_gpa: number | string | null;
  } | null;
}): React.JSX.Element {
  if (!props.summary) {
    return (
      <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
        <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Result Overview
          </p>
          <CardTitle className="text-2xl font-black tracking-tight">
            Academic Result
          </CardTitle>
          <CardDescription className="px-0 text-sm leading-6">
            Open your result page to view academic details.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <Button
            asChild
            variant="outline"
            className="w-full justify-between rounded-xl"
          >
            <Link href="/student/result">
              Open Result
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Result Overview
        </p>
        <CardTitle className="text-2xl font-black tracking-tight">
          Academic summary
        </CardTitle>
        <CardDescription className="px-0 text-sm leading-6">
          Academic details from your result page.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 px-6 py-6 sm:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            CGPA
          </p>
          <p className="mt-2 text-xl font-black text-foreground">
            {props.summary.cgpa ?? "Not available"}
          </p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Latest Semester
          </p>
          <p className="mt-2 text-xl font-black text-foreground">
            {props.summary.latest_semester_label ?? "Not available"}
          </p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Latest GPA
          </p>
          <p className="mt-2 text-xl font-black text-foreground">
            {props.summary.latest_semester_gpa ?? "Not available"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentDashboardScreen(): React.JSX.Element {
  const dashboardState = useStudentDashboard({
    autoLoad: true,
  });
  const dashboard = dashboardState.dashboard;

  return (
    <PageContainer
      eyebrow="Student Dashboard"
      title="Dashboard"
      description="View your borrowed books, due dates, fines, waiting list, and pickup status."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void dashboardState.refresh();
            }}
            disabled={dashboardState.loading || dashboardState.refreshing}
          >
            {dashboardState.refreshing ? (
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
        {dashboardState.loading && !dashboardState.hasData ? (
          <DashboardLoadingState />
        ) : null}

        {!dashboardState.loading &&
        dashboardState.error &&
        !dashboardState.hasData ? (
          <DashboardFailureState
            hasStaleData={false}
            message={dashboardState.error}
            onRetry={dashboardState.retry}
          />
        ) : null}

        {!dashboardState.loading && dashboardState.hasData && dashboard ? (
          <>
            {dashboardState.error ? (
              <DashboardFailureState
                hasStaleData={dashboardState.hasStaleData}
                message={dashboardState.error}
                onRetry={dashboardState.retry}
              />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryMetricCard
                title="Borrowed Books"
                value={dashboard.summary.active_borrow_count}
                summary="Books currently borrowed by you."
                href="/student/borrows"
                actionLabel="Open Borrows"
                icon={BookCopy}
                tone="primary"
              />
              <SummaryMetricCard
                title="Overdue Books"
                value={dashboard.summary.overdue_borrow_count}
                summary="Active loans whose due date has already passed."
                href="/student/borrows"
                actionLabel="Review Overdue Loans"
                icon={Clock3}
                tone={
                  dashboard.summary.overdue_borrow_count > 0
                    ? "warning"
                    : "neutral"
                }
              />
              <SummaryMetricCard
                title="Pending Fines"
                value={dashboard.summary.pending_fine_count}
                summary="Unresolved fine records still visible in your account."
                href="/student/fines"
                actionLabel="Open Fines"
                icon={CreditCard}
                tone={
                  dashboard.summary.pending_fine_count > 0
                    ? "warning"
                    : "neutral"
                }
              />
              <SummaryMetricCard
                title="Waiting List"
                value={dashboard.summary.active_queue_count}
                summary="Books you are waiting for."
                href="/student/queue"
                actionLabel="Open Queue"
                icon={ScrollText}
                tone="primary"
              />
              <SummaryMetricCard
                title="Ready for Pickup"
                value={dashboard.summary.hold_assigned_count}
                summary="Books reserved for pickup."
                href="/student/queue"
                actionLabel="Review Holds"
                icon={ShieldCheck}
                tone={
                  dashboard.summary.hold_assigned_count > 0
                    ? "warning"
                    : "neutral"
                }
              />
            </div>

            {dashboardState.isQuiet ? <QuietState /> : null}

            {!dashboardState.isQuiet ? (
              <div className="grid gap-4 xl:grid-cols-3">
                <AttentionCard
                  eyebrow="Nearest Due"
                  title={
                    dashboard.next_due_borrow
                      ? dashboard.next_due_borrow.title
                      : "No active due date"
                  }
                  description={
                    dashboard.next_due_borrow
                      ? getStudentBorrowDuePresentation(
                          dashboard.next_due_borrow.due_date,
                        ).helper
                      : "You do not currently have an active borrow that needs due-date attention."
                  }
                  href="/student/borrows"
                  actionLabel="Open Borrows"
                  toneClassName={
                    dashboard.next_due_borrow
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }
                />
                <AttentionCard
                  eyebrow="Ready for Pickup"
                  title={
                    dashboard.current_hold
                      ? dashboard.current_hold.title
                      : "No active hold assignment"
                  }
                  description={
                    dashboard.current_hold
                      ? `Hold expires ${formatStudentQueueDateTime(dashboard.current_hold.hold_expires_at)}`
                      : "No books are currently ready for pickup."
                  }
                  href="/student/queue"
                  actionLabel="Open Queue"
                  toneClassName={
                    dashboard.current_hold
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                      : "border-border bg-muted text-muted-foreground"
                  }
                />
                <AttentionCard
                  eyebrow="Pending Fines"
                  title={
                    dashboard.summary.pending_fine_count > 0
                      ? formatStudentFineAmount(
                          dashboard.summary.pending_fine_amount,
                        )
                      : "No pending fines"
                  }
                  description={
                    dashboard.summary.pending_fine_count > 0
                      ? `${dashboard.summary.pending_fine_count} pending fine record${dashboard.summary.pending_fine_count === 1 ? "" : "s"} still require attention.`
                      : "No unresolved fine records are currently visible in your account."
                  }
                  href="/student/fines"
                  actionLabel="Open Fines"
                  toneClassName={
                    dashboard.summary.pending_fine_count > 0
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                      : "border-border bg-muted text-muted-foreground"
                  }
                />
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-3">
              <PreviewSection
                eyebrow="Current Borrows"
                title="Borrowed books"
                description="A quick view of books currently issued to you."
                href="/student/borrows"
                actionLabel="View all borrows"
                emptyTitle="No active borrows are visible."
                emptyMessage="Books you borrow will appear here."
                hasItems={dashboard.active_borrows_preview.length > 0}
              >
                {dashboard.active_borrows_preview.map((item) => {
                  const due = getStudentBorrowDuePresentation(item.due_date);

                  return (
                    <div
                      key={item.transaction_id}
                      className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full",
                                due.state === "overdue"
                                  ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                                  : due.state === "due_today"
                                    ? "border-primary/20 bg-primary/10 text-primary"
                                    : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {due.label}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full">
                              {item.renewal_count} renewal
                              {item.renewal_count === 1 ? "" : "s"}
                            </Badge>
                          </div>
                        </div>
                        <Link
                          href="/student/borrows"
                          className="text-sm font-semibold text-primary"
                        >
                          Open
                        </Link>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {due.helper}
                      </p>
                    </div>
                  );
                })}
              </PreviewSection>

              <PreviewSection
                eyebrow="Waiting List"
                title="Waiting list status"
                description="A quick view of books you are waiting for and books ready for pickup."
                href="/student/queue"
                actionLabel="View all queue entries"
                emptyTitle="No active queue entries are visible."
                emptyMessage="Waiting-list and pickup-ready books will appear here."
                hasItems={dashboard.queue_preview.length > 0}
              >
                {dashboard.queue_preview.map((item) => {
                  const status = getStudentQueueStatusPresentation(item.status);

                  return (
                    <div
                      key={`${item.book_id}-${item.status}`}
                      className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full",
                                status.toneClassName,
                              )}
                            >
                              {status.label}
                            </Badge>
                            {item.position ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full"
                              >
                                Position #{item.position}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <Link
                          href="/student/queue"
                          className="text-sm font-semibold text-primary"
                        >
                          Open
                        </Link>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {item.hold_expires_at
                          ? `Hold expires ${formatStudentQueueDateTime(item.hold_expires_at)}`
                          : status.description}
                      </p>
                    </div>
                  );
                })}
              </PreviewSection>

              <PreviewSection
                eyebrow="Fines"
                title="Pending fines"
                description="A quick view of fine records linked to your account."
                href="/student/fines"
                actionLabel="View all fines"
                emptyTitle="No pending fines are visible."
                emptyMessage="Fines will appear here when any are pending."
                hasItems={dashboard.fine_preview.length > 0}
              >
                {dashboard.fine_preview.map((item) => {
                  const status = getStudentFineStatusPresentation(item.status);

                  return (
                    <div
                      key={item.fine_id}
                      className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full",
                                status.toneClassName,
                              )}
                            >
                              {status.label}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full">
                              {formatStudentFineAmount(item.amount)}
                            </Badge>
                          </div>
                        </div>
                        <Link
                          href="/student/fines"
                          className="text-sm font-semibold text-primary"
                        >
                          Open
                        </Link>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Created{" "}
                        {formatStudentFineDateTime(item.fine_created_at)}
                      </p>
                    </div>
                  );
                })}
              </PreviewSection>
            </div>

            <ResultSummaryCard summary={dashboard.result_summary} />

            <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
              <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Quick Links
                </p>
                <CardTitle className="text-2xl font-black tracking-tight">
                  Open your next section
                </CardTitle>
                <CardDescription className="px-0 text-sm leading-6">
                  Use these shortcuts to open catalog, borrows, queue, fines,
                  results, assistant, or profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <DashboardQuickLinks items={STUDENT_DASHBOARD_QUICK_LINKS} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
