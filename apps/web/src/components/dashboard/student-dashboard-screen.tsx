"use client";

// apps/web/src/components/dashboard/student-dashboard-screen.tsx
/**
 * Student dashboard screen.
 *
 * This screen presents the student's operational library status. The layout is
 * intentionally priority-first: overdue books, nearest due date, pending fines,
 * and pickup-ready holds appear before general overview cards and shortcuts.
 */

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BotMessageSquare,
  BookCopy,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  LibraryBig,
  ListChecks,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ScrollText,
  Sparkles,
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

type DashboardIcon = React.ComponentType<{ className?: string }>;

type CardTone = "primary" | "warning" | "danger" | "success" | "neutral";

type PriorityActionItem = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: DashboardIcon;
  tone: CardTone;
};

const STUDENT_DASHBOARD_QUICK_LINKS: DashboardQuickLinkItem[] = [
  {
    title: "Browse Catalog",
    summary: "Search books and check availability.",
    href: "/student/catalog",
    icon: LibraryBig,
  },
  {
    title: "My Borrows",
    summary: "Review active loans, due dates, and history.",
    href: "/student/borrows",
    icon: BookCopy,
  },
  {
    title: "My Queue",
    summary: "Track waiting-list and pickup-ready books.",
    href: "/student/queue",
    icon: ScrollText,
  },
  {
    title: "My Fines",
    summary: "Review pending and resolved fine records.",
    href: "/student/fines",
    icon: CreditCard,
  },
  {
    title: "My Result",
    summary: "Open your academic result view.",
    href: "/student/result",
    icon: GraduationCap,
  },
  {
    title: "Ask Assistant",
    summary: "Ask verified university-information questions.",
    href: "/student/assistant",
    icon: BotMessageSquare,
  },
  {
    title: "Profile",
    summary: "Review your student account details.",
    href: "/student/profile",
    icon: UserCircle2,
  },
];

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

function getToneClassName(tone: CardTone): string {
  if (tone === "danger") {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }

  if (tone === "warning") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700";
  }

  if (tone === "success") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  if (tone === "neutral") {
    return "border-border/70 bg-muted text-muted-foreground";
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

function DashboardLoadingState(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-64 rounded-4xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-4xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-4xl" />
        <Skeleton className="h-80 rounded-4xl" />
        <Skeleton className="h-80 rounded-4xl" />
      </div>
      <Skeleton className="h-60 rounded-4xl" />
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
              Dashboard Update Failed
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
  icon: DashboardIcon;
  tone: CardTone;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
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

function PriorityActionPanel(props: {
  items: PriorityActionItem[];
}): React.JSX.Element {
  const [featuredItem, ...secondaryItems] = props.items;

  if (!featuredItem) {
    return (
      <Card className="rounded-4xl border-emerald-500/20 bg-emerald-500/5 py-0 shadow-none">
        <CardContent className="grid gap-5 px-5 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <Badge
                variant="outline"
                className="rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
              >
                All Clear
              </Badge>
              <p className="text-2xl font-black tracking-tight text-foreground">
                Nothing needs immediate attention.
              </p>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                You currently have no overdue books, pending fines, waiting-list
                pressure, or pickup-ready books.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-emerald-500/20 bg-background/70 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpenCheck className="h-4 w-4 text-emerald-700" />
                Library status is healthy.
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Browse the catalog when you are ready to request another book.
              </p>
            </div>
            <DashboardLinkButton href="/student/catalog" className="w-full">
              Browse Catalog
            </DashboardLinkButton>
          </div>
        </CardContent>
      </Card>
    );
  }

  const FeaturedIcon = featuredItem.icon;

  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardContent className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className={cn(
            "rounded-4xl border px-5 py-5",
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
          {secondaryItems.length > 0 ? (
            secondaryItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group rounded-3xl border border-border/60 bg-background/55 px-4 py-4 transition hover:border-primary/30 hover:bg-primary/5"
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
                      <p className="text-sm font-bold text-foreground">
                        {item.title}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition group-hover:text-primary" />
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Next action is focused.
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with the highlighted item, then return here for the rest
                of your overview.
              </p>
            </div>
          )}
        </div>
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
  icon: DashboardIcon;
  children: React.ReactNode;
  hasItems: boolean;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
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

function PreviewItemCard(props: {
  title: string;
  icon: DashboardIcon;
  badges: React.ReactNode;
  description: React.ReactNode;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <p className="break-words text-sm font-semibold text-foreground">
              {props.title}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {props.badges}
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {props.description}
          </p>
        </div>
      </div>
    </div>
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
        <CardHeader className="gap-2 border-b border-border/60 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Result Overview
              </p>
              <CardTitle className="text-2xl font-black tracking-tight">
                Academic result
              </CardTitle>
              <CardDescription className="px-0 text-sm leading-6">
                Open your result page to view academic details.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
          <DashboardLinkButton href="/student/result" className="w-full">
            Open Result
          </DashboardLinkButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-2 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Result Overview
            </p>
            <CardTitle className="text-2xl font-black tracking-tight">
              Academic summary
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6">
              A compact view of your latest academic result.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6 sm:py-6">
        <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            CGPA
          </p>
          <p className="mt-2 break-words text-xl font-black text-foreground">
            {props.summary.cgpa ?? "Not available"}
          </p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Latest Semester
          </p>
          <p className="mt-2 break-words text-xl font-black text-foreground">
            {props.summary.latest_semester_label ?? "Not available"}
          </p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Latest GPA
          </p>
          <p className="mt-2 break-words text-xl font-black text-foreground">
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

  const priorityItems = React.useMemo<PriorityActionItem[]>(() => {
    if (!dashboard) {
      return [];
    }

    const items: PriorityActionItem[] = [];

    if (dashboard.summary.overdue_borrow_count > 0) {
      items.push({
        key: "overdue-borrows",
        eyebrow: "Needs Immediate Attention",
        title: `${formatCount(
          dashboard.summary.overdue_borrow_count,
        )} overdue ${
          dashboard.summary.overdue_borrow_count === 1 ? "book" : "books"
        }`,
        description:
          "Review overdue loans first. Overdue books can increase your fine balance until they are resolved.",
        href: "/student/borrows",
        actionLabel: "Review Overdue Books",
        icon: AlertTriangle,
        tone: "danger",
      });
    }

    if (dashboard.next_due_borrow) {
      const due = getStudentBorrowDuePresentation(
        dashboard.next_due_borrow.due_date,
      );

      items.push({
        key: "nearest-due",
        eyebrow: due.state === "due_today" ? "Due Today" : "Nearest Due Date",
        title: dashboard.next_due_borrow.title,
        description: due.helper,
        href: "/student/borrows",
        actionLabel: "Open Borrow Details",
        icon: CalendarClock,
        tone:
          due.state === "overdue"
            ? "danger"
            : due.state === "due_today"
              ? "warning"
              : "primary",
      });
    }

    if (dashboard.summary.pending_fine_count > 0) {
      items.push({
        key: "pending-fines",
        eyebrow: "Pending Fine",
        title: formatStudentFineAmount(dashboard.summary.pending_fine_amount),
        description: `${formatCount(
          dashboard.summary.pending_fine_count,
        )} fine ${
          dashboard.summary.pending_fine_count === 1
            ? "record needs"
            : "records need"
        } attention from your account.`,
        href: "/student/fines",
        actionLabel: "Review Fines",
        icon: CreditCard,
        tone: "warning",
      });
    }

    if (dashboard.current_hold) {
      items.push({
        key: "ready-for-pickup",
        eyebrow: "Ready for Pickup",
        title: dashboard.current_hold.title,
        description: `Your hold is assigned. Pick it up before ${formatStudentQueueDateTime(
          dashboard.current_hold.hold_expires_at,
        )}.`,
        href: "/student/queue",
        actionLabel: "Review Pickup",
        icon: PackageCheck,
        tone: "success",
      });
    }

    if (
      dashboard.summary.active_queue_count > 0 &&
      dashboard.summary.hold_assigned_count === 0
    ) {
      items.push({
        key: "waiting-list",
        eyebrow: "Waiting List",
        title: `${formatCount(
          dashboard.summary.active_queue_count,
        )} active queue ${
          dashboard.summary.active_queue_count === 1 ? "entry" : "entries"
        }`,
        description:
          "You are waiting for one or more books. Monitor your queue position and pickup status.",
        href: "/student/queue",
        actionLabel: "Open Queue",
        icon: ListChecks,
        tone: "primary",
      });
    }

    return items;
  }, [dashboard]);

  return (
    <PageContainer
      eyebrow="Student Dashboard"
      title="Dashboard"
      description="Start with overdue books, nearest due dates, pending fines, and pickup-ready holds."
      actions={
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

            <PriorityActionPanel items={priorityItems} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryMetricCard
                title="Overdue Books"
                value={dashboard.summary.overdue_borrow_count}
                summary="Books whose due date has already passed."
                href="/student/borrows"
                actionLabel="Review"
                icon={AlertTriangle}
                tone={
                  dashboard.summary.overdue_borrow_count > 0
                    ? "danger"
                    : "neutral"
                }
              />
              <SummaryMetricCard
                title="Pending Fines"
                value={dashboard.summary.pending_fine_count}
                summary="Fine records that still need attention."
                href="/student/fines"
                actionLabel="Open"
                icon={CreditCard}
                tone={
                  dashboard.summary.pending_fine_count > 0
                    ? "warning"
                    : "neutral"
                }
              />
              <SummaryMetricCard
                title="Ready Pickup"
                value={dashboard.summary.hold_assigned_count}
                summary="Books assigned and waiting for pickup."
                href="/student/queue"
                actionLabel="Check"
                icon={PackageCheck}
                tone={
                  dashboard.summary.hold_assigned_count > 0
                    ? "success"
                    : "neutral"
                }
              />
              <SummaryMetricCard
                title="Borrowed Books"
                value={dashboard.summary.active_borrow_count}
                summary="Books currently issued to your account."
                href="/student/borrows"
                actionLabel="Open"
                icon={BookCopy}
                tone="primary"
              />
              <SummaryMetricCard
                title="Waiting List"
                value={dashboard.summary.active_queue_count}
                summary="Books where you are waiting for availability."
                href="/student/queue"
                actionLabel="Open"
                icon={ScrollText}
                tone={
                  dashboard.summary.active_queue_count > 0
                    ? "primary"
                    : "neutral"
                }
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <PreviewSection
                eyebrow="Current Borrows"
                title="Borrowed books"
                description="Due-date status for books currently issued to you."
                href="/student/borrows"
                actionLabel="View all"
                emptyTitle="No active borrows are visible."
                emptyMessage="Books you borrow will appear here."
                icon={BookOpenCheck}
                hasItems={dashboard.active_borrows_preview.length > 0}
              >
                {dashboard.active_borrows_preview.map((item) => {
                  const due = getStudentBorrowDuePresentation(item.due_date);

                  return (
                    <PreviewItemCard
                      key={item.transaction_id}
                      title={item.title}
                      icon={
                        due.state === "overdue" ? AlertTriangle : CalendarClock
                      }
                      badges={
                        <>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full",
                              due.state === "overdue"
                                ? getToneClassName("danger")
                                : due.state === "due_today"
                                  ? getToneClassName("warning")
                                  : getToneClassName("neutral"),
                            )}
                          >
                            {due.label}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full">
                            {item.renewal_count} renewal
                            {item.renewal_count === 1 ? "" : "s"}
                          </Badge>
                        </>
                      }
                      description={due.helper}
                    />
                  );
                })}
              </PreviewSection>

              <PreviewSection
                eyebrow="Waiting List"
                title="Queue and pickup"
                description="Books you are waiting for and books assigned for pickup."
                href="/student/queue"
                actionLabel="View all"
                emptyTitle="No active queue entries are visible."
                emptyMessage="Waiting-list and pickup-ready books will appear here."
                icon={ListChecks}
                hasItems={dashboard.queue_preview.length > 0}
              >
                {dashboard.queue_preview.map((item) => {
                  const status = getStudentQueueStatusPresentation(item.status);
                  const hasHold = Boolean(item.hold_expires_at);

                  return (
                    <PreviewItemCard
                      key={`${item.book_id}-${item.status}-${
                        item.position ?? "no-position"
                      }-${item.hold_expires_at ?? "no-hold"}`}
                      title={item.title}
                      icon={hasHold ? PackageCheck : ScrollText}
                      badges={
                        <>
                          <Badge
                            variant="outline"
                            className={cn("rounded-full", status.toneClassName)}
                          >
                            {status.label}
                          </Badge>
                          {item.position ? (
                            <Badge variant="secondary" className="rounded-full">
                              Position #{item.position}
                            </Badge>
                          ) : null}
                        </>
                      }
                      description={
                        hasHold
                          ? `Hold expires ${formatStudentQueueDateTime(
                              item.hold_expires_at,
                            )}`
                          : status.description
                      }
                    />
                  );
                })}
              </PreviewSection>

              <PreviewSection
                eyebrow="Fines"
                title="Pending fines"
                description="Fine records currently linked to your account."
                href="/student/fines"
                actionLabel="View all"
                emptyTitle="No pending fines are visible."
                emptyMessage="Fines will appear here when any are pending."
                icon={CreditCard}
                hasItems={dashboard.fine_preview.length > 0}
              >
                {dashboard.fine_preview.map((item) => {
                  const status = getStudentFineStatusPresentation(item.status);

                  return (
                    <PreviewItemCard
                      key={item.fine_id}
                      title={item.title}
                      icon={CreditCard}
                      badges={
                        <>
                          <Badge
                            variant="outline"
                            className={cn("rounded-full", status.toneClassName)}
                          >
                            {status.label}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full">
                            {formatStudentFineAmount(item.amount)}
                          </Badge>
                        </>
                      }
                      description={
                        <>
                          Created{" "}
                          {formatStudentFineDateTime(item.fine_created_at)}
                        </>
                      }
                    />
                  );
                })}
              </PreviewSection>
            </div>

            <ResultSummaryCard summary={dashboard.result_summary} />

            <Card className="rounded-4xl border-border/60 bg-card/95 py-0 shadow-none">
              <CardHeader className="gap-2 border-b border-border/60 px-5 py-5 sm:px-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Quick Links
                    </p>
                    <CardTitle className="text-2xl font-black tracking-tight">
                      Open your next section
                    </CardTitle>
                    <CardDescription className="px-0 text-sm leading-6">
                      Use these shortcuts after reviewing the priority items
                      above.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                <DashboardQuickLinks items={STUDENT_DASHBOARD_QUICK_LINKS} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
