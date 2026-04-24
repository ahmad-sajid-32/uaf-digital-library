"use client";

import * as React from "react";
import Link from "next/link";
import {
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
  ChevronRight,
  LayoutGrid,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { DashboardQuickLinks } from "@/components/dashboard/dashboard-quick-links";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrarianMetrics } from "@/hooks/useLibrarianMetrics";
import { cn } from "@/lib/utils";

/**
 * Clean & Professional Librarian Terminal
 */

const QUICK_LINKS = [
  { title: "Catalog", href: "/librarian/catalog", icon: BookCopy },
  { title: "Circulation", href: "/librarian/circulation", icon: LibraryBig },
  { title: "Fines", href: "/librarian/fines", icon: CreditCard },
  { title: "Documents", href: "/librarian/documents", icon: FileText },
  {
    title: "AI Assistant",
    href: "/librarian/assistant",
    icon: BotMessageSquare,
  },
];

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: any;
  tone: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50 shadow-sm transition-colors hover:border-primary/30">
      <CardContent className="flex items-center gap-5 p-6">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            tone === "warning"
              ? "bg-orange-500/10 text-orange-500"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {formatCount(value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LibrarianDashboardScreen(): React.JSX.Element {
  const {
    metrics,
    loading,
    refreshing,
    lastLoadedAt,
    refresh,
    isOperationallyQuiet,
  } = useLibrarianMetrics({ autoLoad: true });

  if (loading && !metrics) {
    return (
      <PageContainer
        eyebrow="Overview"
        title="Librarian Dashboard"
        description="Fetching operational data..."
      >
        <div className="grid gap-6 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
          <Skeleton className="h-96 rounded-3xl md:col-span-3" />
          <Skeleton className="h-96 rounded-3xl md:col-span-1" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      eyebrow="Staff Terminal"
      title="Operational Overview"
      description="Monitor circulation pressure and document finalization queues."
      actions={
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground md:flex">
            <Clock3 className="h-3.5 w-3.5" />
            Sync:{" "}
            {lastLoadedAt
              ? new Date(lastLoadedAt).toLocaleTimeString()
              : "Never"}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg bg-background shadow-sm"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-8">
        {/* Row 1: Key Performance Indicators */}
        <ScrollReveal
          direction="up"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <MetricCard
            title="Active Loans"
            value={metrics?.activeLoanCount ?? 0}
            icon={LibraryBig}
            tone="primary"
          />
          <MetricCard
            title="Overdue"
            value={metrics?.overdueLoanCount ?? 0}
            icon={ShieldAlert}
            tone="warning"
          />
          <MetricCard
            title="Pending Fines"
            value={metrics?.pendingFineCount ?? 0}
            icon={CreditCard}
            tone="primary"
          />
          <MetricCard
            title="Doc Backlog"
            value={metrics?.documentsRequiringActionCount ?? 0}
            icon={FileText}
            tone="primary"
          />
        </ScrollReveal>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Main Workspace (8 Columns) */}
          <div className="space-y-8 lg:col-span-8">
            {/* Status Highlight */}
            <Card className="overflow-hidden border-primary/10 bg-gradient-to-r from-primary/5 to-transparent shadow-none">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-8 md:flex-row md:items-center">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {isOperationallyQuiet
                      ? "Systems are Nominal"
                      : "Staff Action Required"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isOperationallyQuiet
                      ? "The circulation queue is clear and no processing errors have been reported."
                      : "We've detected document processing records that require manual intervention."}
                  </p>
                </div>
                {!isOperationallyQuiet && (
                  <Button asChild size="sm" className="rounded-full px-6">
                    <Link href="/librarian/documents">Resolve Actions</Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Priority Documents List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Attention Required
                </h4>
                <Link
                  href="/librarian/documents"
                  className="text-sm font-semibold text-primary flex items-center hover:underline"
                >
                  View Full Queue <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {metrics?.documentAttention.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
                    No documents require attention.
                  </div>
                ) : (
                  metrics?.documentAttention.slice(0, 3).map((doc) => (
                    <Card
                      key={doc.documentId}
                      className="border-border/40 bg-background/50 transition-all hover:bg-card"
                    >
                      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-foreground">
                            {doc.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {doc.lifecycleNote}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <DocumentStatusBadge status={doc.processingStatus} />
                          {doc.requiresReupload && (
                            <Badge variant="destructive" className="rounded-md">
                              Stale
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="rounded-lg"
                          >
                            <Link href="/librarian/documents">
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Insights (4 Columns) */}
          <div className="space-y-8 lg:col-span-4">
            {/* Quick Access */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Quick Access
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.title}
                    href={link.href}
                    className="group flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-background p-4 text-center transition-all hover:border-primary/30 hover:shadow-sm"
                  >
                    <link.icon className="mb-2 h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-[11px] font-bold">{link.title}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Queue Pressures */}
            <Card className="border-none bg-muted/30 shadow-none">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold">Catalog Pressure</h4>
                </div>
                <div className="space-y-5">
                  {metrics?.queueHotspots.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <span className="text-xs font-black text-primary/40 mt-1">
                        0{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold tracking-tight text-foreground">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground">
                          {"waitingCount" in item ? item.waitingCount : 0}{" "}
                          Readers Waiting
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full rounded-xl text-xs font-bold"
                  asChild
                >
                  <Link href="/librarian/catalog">Audit Inventory</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
