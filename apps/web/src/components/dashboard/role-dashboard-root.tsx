// apps/web/src/components/dashboard/role-dashboard-root.tsx
/**
 * Role-root dashboard landing surface.
 *
 * Purpose:
 * - Replace the old placeholder-style dashboard card with a shell-native role
 *   workspace entry surface.
 * - Keep the role roots honest and lightweight while the deeper modules are
 *   still being built in later passes.
 * - Show real application state that is already true today instead of fake
 *   metrics or pretend feature availability.
 */

"use client";

import * as React from "react";
import {
  ArrowRight,
  BarChart3,
  BookCopy,
  BookOpenCheck,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileText,
  LibraryBig,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getStaggeredRevealDelay,
  getStaggeredRevealDirection,
  ScrollReveal,
} from "@/components/ui/scroll-reveal";
import { Separator } from "@/components/ui/separator";
import { useAppAuth } from "@/hooks/useAppAuth";
import { cn } from "@/lib/utils";

interface RoleDashboardRootProps {
  role: "student" | "librarian" | "admin";
}

interface DashboardCapability {
  title: string;
  summary: string;
  status: "active" | "planned";
}

interface DashboardHighlight {
  title: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface RoleDashboardCopy {
  label: string;
  headline: string;
  summary: string;
  nextDelivery: string;
  liveCapabilities: DashboardCapability[];
  upcomingCapabilities: DashboardCapability[];
  highlights: DashboardHighlight[];
  governanceNote: string;
}

const ROLE_DASHBOARD_COPY: Record<
  RoleDashboardRootProps["role"],
  RoleDashboardCopy
> = {
  student: {
    label: "Student",
    headline: "Your library account workspace is now running inside the authenticated app shell.",
    summary:
      "This dashboard is the stable entry point for student-scoped borrowing activity, queue visibility, and fine-aware account behavior.",
    nextDelivery: "Borrow and fines modules",
    liveCapabilities: [
      {
        title: "Protected session frame",
        summary:
          "Your role routing, authenticated shell, and account-state checks are already active.",
        status: "active",
      },
      {
        title: "Role-safe workspace",
        summary:
          "Student pages stay under student-only navigation and student route identity.",
        status: "active",
      },
    ],
    upcomingCapabilities: [
      {
        title: "Borrowed items view",
        summary: "Current loans, due dates, and account-level borrowing status.",
        status: "planned",
      },
      {
        title: "Queue and hold tracking",
        summary: "Item availability progress and queue participation visibility.",
        status: "planned",
      },
      {
        title: "Fine awareness",
        summary: "Outstanding charges and account obligations grounded in backend truth.",
        status: "planned",
      },
    ],
    highlights: [
      {
        title: "Account boundary",
        summary: "Only your own student-scoped library data belongs here.",
        icon: UserRoundCheck,
      },
      {
        title: "Borrowing runway",
        summary: "The next UI work turns this shell entry point into a real self-service desk.",
        icon: BookCopy,
      },
      {
        title: "Policy alignment",
        summary: "Access still depends on backend and database authorization, not UI trust.",
        icon: ShieldCheck,
      },
    ],
    governanceNote:
      "Student access remains limited to student-scoped records and self-service library features.",
  },
  librarian: {
    label: "Librarian",
    headline: "The operational workspace is now framed by the shared authenticated shell.",
    summary:
      "This dashboard is the stable starting point for circulation, catalog stewardship, and approved document workflows.",
    nextDelivery: "Circulation and catalog modules",
    liveCapabilities: [
      {
        title: "Protected operational shell",
        summary:
          "Role guards, normalized auth state, and logout behavior are now centralized.",
        status: "active",
      },
      {
        title: "Librarian route identity",
        summary:
          "The navigation and workspace framing now reflect librarian-owned application surfaces.",
        status: "active",
      },
    ],
    upcomingCapabilities: [
      {
        title: "Circulation command center",
        summary: "Issue, return, renewal, and item movement operations.",
        status: "planned",
      },
      {
        title: "Catalog maintenance",
        summary: "Library inventory updates and approved metadata maintenance.",
        status: "planned",
      },
      {
        title: "Document operations queue",
        summary: "Institution-approved document handling with workflow-safe states.",
        status: "planned",
      },
    ],
    highlights: [
      {
        title: "Operational focus",
        summary: "This role is about library workflows, not platform-wide administrative control.",
        icon: LibraryBig,
      },
      {
        title: "Workflow readiness",
        summary: "The shell is ready to host circulation and catalog screens without another routing rewrite.",
        icon: ClipboardList,
      },
      {
        title: "Controlled access",
        summary: "The backend remains the source of truth for what a librarian can actually do.",
        icon: LockKeyhole,
      },
    ],
    governanceNote:
      "Librarian access remains operational and library-scoped, not system-wide administrative control.",
  },
  admin: {
    label: "Admin",
    headline: "The administrative workspace now opens inside the real application frame instead of an auth-era placeholder.",
    summary:
      "This dashboard is the stable administrative entry point for user management, oversight surfaces, and system-level library operations.",
    nextDelivery: "Admin users module",
    liveCapabilities: [
      {
        title: "Admin-authenticated shell",
        summary:
          "Role guard, user identity, logout, and route-aware navigation are already live.",
        status: "active",
      },
      {
        title: "Backend-ready user management contract",
        summary:
          "List, detail, update, activation, delete, and account-status APIs are already implemented.",
        status: "active",
      },
    ],
    upcomingCapabilities: [
      {
        title: "User administration console",
        summary: "Frontend list, detail, create, update, activate, and delete flows.",
        status: "planned",
      },
      {
        title: "Analytics overview",
        summary: "Institution-level monitoring surfaces once the admin shell modules arrive.",
        status: "planned",
      },
      {
        title: "Document oversight",
        summary: "Administrative document control with truthful availability states.",
        status: "planned",
      },
    ],
    highlights: [
      {
        title: "Next module target",
        summary: "The very next concrete surface is admin user management inside this shell.",
        icon: Users,
      },
      {
        title: "Operational truth",
        summary: "The backend contract is ready, but the UI is not being faked before the module exists.",
        icon: ShieldAlert,
      },
      {
        title: "Expansion path",
        summary: "Analytics and documents remain planned, not silently implied.",
        icon: BarChart3,
      },
    ],
    governanceNote:
      "Admin access is broader, but it still depends on backend validation and database-enforced authorization.",
  },
};

function getCapabilityTone(status: DashboardCapability["status"]): string {
  return status === "active"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function RoleDashboardRoot({
  role,
}: RoleDashboardRootProps): React.JSX.Element {
  const { auth } = useAppAuth();
  const copy = ROLE_DASHBOARD_COPY[role];

  return (
    <PageContainer
      eyebrow={`${copy.label} Workspace`}
      title={`${copy.label} Dashboard`}
      description={
        auth.email
          ? `Signed in as ${auth.email}. ${copy.summary}`
          : copy.summary
      }
      actions={(
        <>
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/5 text-primary"
          >
            Authenticated Shell
          </Badge>
          <Badge variant="secondary">Protected Role Surface</Badge>
        </>
      )}
    >
      <div className="flex flex-1 flex-col gap-6">
        <ScrollReveal direction="up" delayMs={40}>
          <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-lg shadow-primary/10">
            <CardContent className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
              <div className="space-y-4">
                <Badge className="w-fit rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary shadow-none">
                  {copy.label} Command Surface
                </Badge>
                <div className="space-y-3">
                  <h2 className="font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                    {copy.headline}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {copy.summary}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Next Delivery
                      </p>
                      <p className="text-sm font-semibold text-foreground sm:text-base">
                        {copy.nextDelivery}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Card className="border-border/60 bg-background/85 py-0 shadow-none">
                  <CardContent className="space-y-2 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Access enforcement
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Role guard, authenticated shell, and protected navigation are already live.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-background/85 py-0 shadow-none">
                  <CardContent className="space-y-2 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ChartColumn className="h-4 w-4 text-primary" />
                      UI maturity
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      The shell is real. Deeper role modules are staged pass by pass instead of being faked.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <ScrollReveal
            direction={getStaggeredRevealDirection(0)}
            delayMs={getStaggeredRevealDelay(0, 90, 120)}
          >
            <Card className="h-full border-border/60 bg-card/95 py-0 shadow-none">
              <CardHeader className="space-y-2 border-b border-border/60 px-5 py-5 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <BookOpenCheck className="h-5 w-5 text-primary" />
                  What Is Already True
                </CardTitle>
                <CardDescription className="px-0 text-sm leading-6">
                  These are live application truths, not future promises.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 px-5 py-5 sm:px-6">
                {copy.liveCapabilities.map((capability) => (
                  <div
                    key={capability.title}
                    className="rounded-2xl border border-border/60 bg-muted/50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {capability.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full font-semibold",
                          getCapabilityTone(capability.status),
                        )}
                      >
                        Live
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {capability.summary}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal
            direction={getStaggeredRevealDirection(1)}
            delayMs={getStaggeredRevealDelay(1, 90, 120)}
          >
            <Card className="h-full border-border/60 bg-card/95 py-0 shadow-none">
              <CardHeader className="space-y-2 border-b border-border/60 px-5 py-5 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  Coming Next
                </CardTitle>
                <CardDescription className="px-0 text-sm leading-6">
                  These modules are intentionally staged and not exposed as fake ready links.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 px-5 py-5 sm:px-6">
                {copy.upcomingCapabilities.map((capability) => (
                  <div
                    key={capability.title}
                    className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {capability.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full font-semibold",
                          getCapabilityTone(capability.status),
                        )}
                      >
                        Planned
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {capability.summary}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {copy.highlights.map((highlight, index) => {
            const Icon = highlight.icon;

            return (
              <ScrollReveal
                key={highlight.title}
                direction={getStaggeredRevealDirection(index)}
                delayMs={getStaggeredRevealDelay(index, 80, 110)}
              >
                <Card className="h-full border-border/60 bg-muted/45 py-0 shadow-none">
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        {highlight.title}
                      </h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {highlight.summary}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            );
          })}
        </div>

        <Card className="border-border/60 bg-card/95 py-0 shadow-none">
          <CardContent className="px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {role === "admin" ? (
                  <Users className="h-4 w-4" />
                ) : role === "student" ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Governance boundary
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.governanceNote}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <p className="text-sm leading-6 text-muted-foreground">
              This role root now behaves like a real application entry surface inside the shared shell. It keeps the current state truthful, preserves route-aware navigation, and leaves deeper module delivery to later passes without inventing unsupported UI behavior.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
