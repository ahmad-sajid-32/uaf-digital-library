// apps/web/src/components/dashboard/role-dashboard-placeholder.tsx
/**
 * Role-root dashboard landing shell.
 *
 * These landing pages are intentionally lightweight, but they are no longer
 * generic stubs. Each role now gets a scoped entry point that matches the
 * application's routing model and can expand into real modules later without
 * changing auth redirects again.
 */

"use client";

import * as React from "react";
import {
  BookOpenCheck,
  ClipboardList,
  FileText,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ProtectedRouteShell } from "@/components/auth/protected-route-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getStaggeredRevealDelay,
  getStaggeredRevealDirection,
  ScrollReveal,
} from "@/components/ui/scroll-reveal";
import { Separator } from "@/components/ui/separator";
import { useAuthSessionActions } from "@/hooks/use-auth-session-actions";
import { useAppAuth } from "@/hooks/use-app-auth";

interface RoleDashboardPlaceholderProps {
  role: "student" | "librarian" | "admin";
}

interface RoleDashboardCopy {
  label: string;
  summary: string;
  scope: string[];
  nextModules: string[];
  governanceNote: string;
}

const ROLE_DASHBOARD_COPY: Record<
  RoleDashboardPlaceholderProps["role"],
  RoleDashboardCopy
> = {
  student: {
    label: "Student",
    summary:
      "This role root is reserved for borrowing status, queue visibility, fines, and account-level library activity.",
    scope: [
      "View your current borrowing activity",
      "Track queue participation and item availability",
      "Review fines and account-specific obligations",
    ],
    nextModules: [
      "Borrowed items overview",
      "Fine and due-date panel",
      "Queue and hold status",
    ],
    governanceNote:
      "Student access remains limited to student-scoped records and self-service library features.",
  },
  librarian: {
    label: "Librarian",
    summary:
      "This role root is reserved for circulation workflows, catalog operations, and institution-approved document handling.",
    scope: [
      "Manage issue, return, and renewal operations",
      "Review queue movement and operational book status",
      "Handle approved catalog and document workflows",
    ],
    nextModules: [
      "Circulation command center",
      "Catalog maintenance panel",
      "Document operations queue",
    ],
    governanceNote:
      "Librarian access remains operational and library-scoped, not system-wide administrative control.",
  },
  admin: {
    label: "Admin",
    summary:
      "This role root is reserved for system-level management of users, documents, analytics, and platform control surfaces.",
    scope: [
      "Manage institution-controlled user accounts",
      "Oversee document indexing and monitoring surfaces",
      "Review administrative analytics and system controls",
    ],
    nextModules: [
      "User management dashboard",
      "Analytics and monitoring overview",
      "Document administration panel",
    ],
    governanceNote:
      "Admin access is broader, but it still depends on backend validation and database-enforced authorization.",
  },
};

export function RoleDashboardPlaceholder({
  role,
}: RoleDashboardPlaceholderProps): React.JSX.Element {
  const { auth } = useAppAuth();
  const { logout, logoutPending } = useAuthSessionActions();
  const copy = ROLE_DASHBOARD_COPY[role];

  const handleSignOut = async () => {
    await logout({
      redirectTo: "/login",
      successMessage: "Signed out successfully.",
      successToastId: `dashboard-${role}-signout`,
      errorToastId: `dashboard-${role}-signout-error`,
    });
  };

  return (
    <ProtectedRouteShell>
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <ScrollReveal direction="up" delayMs={40} className="w-full max-w-4xl">
        <Card className="w-full max-w-4xl border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardHeader className="space-y-4 px-5 pt-5 text-center sm:px-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpenCheck className="h-7 w-7" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/5 text-primary"
                >
                  Role Root
                </Badge>
                <Badge variant="secondary">Protected Surface</Badge>
              </div>
              <CardTitle className="font-display text-3xl font-black tracking-tight text-foreground">
                {copy.label} Dashboard
              </CardTitle>
            </div>
            <CardDescription className="mx-auto max-w-2xl px-0 text-sm leading-6 text-muted-foreground">
              {auth.email
                ? `Signed in as ${auth.email}. ${copy.summary}`
                : copy.summary}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-5 pb-5 sm:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <ScrollReveal
                direction={getStaggeredRevealDirection(0)}
                delayMs={getStaggeredRevealDelay(0, 80, 120)}
              >
              <Card className="border-border/60 bg-muted/60 shadow-none">
                <CardHeader className="space-y-2 px-4 pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Current Scope
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {copy.scope.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              </ScrollReveal>

              <ScrollReveal
                direction={getStaggeredRevealDirection(1)}
                delayMs={getStaggeredRevealDelay(1, 80, 120)}
              >
              <Card className="border-border/60 bg-muted/60 shadow-none">
                <CardHeader className="space-y-2 px-4 pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Next Modules
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {copy.nextModules.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              </ScrollReveal>

              <ScrollReveal
                direction={getStaggeredRevealDirection(2)}
                delayMs={getStaggeredRevealDelay(2, 80, 120)}
              >
              <Card className="border-border/60 bg-muted/60 shadow-none">
                <CardHeader className="space-y-2 px-4 pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    {role === "admin" ? (
                      <Users className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                    Governance
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {copy.governanceNote}
                  </p>
                </CardContent>
              </Card>
              </ScrollReveal>
            </div>

            <Separator />

            <p className="rounded-xl border border-border/60 bg-muted/70 px-4 py-3 text-sm text-foreground">
              This dashboard root is now an intentional protected entry point for
              the {copy.label.toLowerCase()} role. Middleware and server layouts
              already gate this route, and later passes can expand these cards
              into real modules without changing auth routing again.
            </p>
          </CardContent>

          <CardFooter className="justify-center border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
            <Button
              type="button"
              className="h-12 rounded-xl px-5 text-sm font-bold shadow-md shadow-primary/20"
              disabled={logoutPending}
              onClick={() => {
                void handleSignOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              {logoutPending ? "Signing Out..." : "Sign Out"}
            </Button>
          </CardFooter>
        </Card>
        </ScrollReveal>
      </main>
    </ProtectedRouteShell>
  );
}
