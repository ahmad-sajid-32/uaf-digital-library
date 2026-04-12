"use client";

import * as React from "react";

import { PageContainer } from "@/components/app-shell";
import { LibrarianDashboardScreen } from "@/components/dashboard/librarian-dashboard-screen";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface RoleDashboardRootProps {
  role: "librarian" | "student";
}

export function RoleDashboardRoot({
  role,
}: RoleDashboardRootProps): React.JSX.Element {
  if (role === "librarian") {
    return <LibrarianDashboardScreen />;
  }

  return (
    <PageContainer
      eyebrow="Student Workspace"
      title="Dashboard"
      description="The student dashboard still stays intentionally light. Use the role-safe navigation that is already available in the shell."
      actions={
        <Badge
          variant="outline"
          className="rounded-full border-primary/20 bg-primary/10 text-primary"
        >
          Student Role
        </Badge>
      }
    >
      <ScrollReveal direction="up" delayMs={40}>
        <Card className="rounded-[2rem] border-border/60 bg-card/95 py-0 shadow-none">
          <CardHeader className="gap-2 border-b border-border/60 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Dashboard Placeholder
            </p>
            <CardTitle className="text-2xl font-black tracking-tight">
              Student dashboard remains out of scope in this phase.
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6">
              This route stays available so the student shell remains stable, but
              librarian shell completion does not introduce a new student module.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-6">
            <div className="rounded-[1.5rem] border border-border/60 bg-background/55 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">
                Use the existing student-safe shell entries from here.
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The assistant remains available where already permitted, while
                broader student dashboard work is intentionally deferred to a
                later phase.
              </p>
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>
    </PageContainer>
  );
}
