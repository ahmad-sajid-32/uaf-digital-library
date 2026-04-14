"use client";

import Link from "next/link";
import * as React from "react";
import { AlertCircle, CircleDollarSign, History, LoaderCircle, RefreshCw } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { StudentFineCard } from "@/components/student-fines/student-fine-card";
import { StudentFineHistoryCard } from "@/components/student-fines/student-fine-history-card";
import { StudentFinesSectionNav } from "@/components/student-fines/student-fines-section-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentFines } from "@/hooks/useStudentFines";

function StudentFinesLoadingState() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-80 rounded-3xl" />
      ))}
    </div>
  );
}

function StudentFinesFailureState(props: {
  heading: string;
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">{props.heading}</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The currently shown fine rows may be stale. Retry to fetch the
              latest records from the backend.
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

function StudentFinesEmptyState(props: {
  section: "current" | "history";
}) {
  const isCurrent = props.section === "current";

  return (
    <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
      <CardContent className="space-y-5 px-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isCurrent ? (
            <CircleDollarSign className="h-7 w-7" />
          ) : (
            <History className="h-7 w-7" />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {isCurrent ? "No Current Fines" : "No Fine History"}
          </p>
          <p className="text-2xl font-black tracking-tight text-foreground">
            {isCurrent
              ? "You do not currently have any unresolved fines."
              : "No resolved fine records are available yet."}
          </p>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
            {isCurrent
              ? "This current-fines view is read-only and only shows unresolved fine records after student-safe partitioning."
              : "Historical fines appear here once the backend has resolved records for your account."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-xl">
            <Link href="/student/borrows">View My Borrows</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/student/catalog">Back To Catalog</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentFinesScreen() {
  const fines = useStudentFines({
    autoLoad: true,
  });
  const activeSectionState =
    fines.section === "current" ? fines.current : fines.history;

  return (
    <PageContainer
      eyebrow="Student Fines"
      title="Fines"
      description="Review current fine visibility and historical resolution records without exposing unsupported settlement actions. Fine amounts and statuses remain backend-owned."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {fines.current.items.length} current
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {fines.history.items.length} history
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Read only
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void fines.refresh();
            }}
            disabled={
              fines.current.loading
              || fines.current.refreshing
              || fines.history.loading
              || fines.history.refreshing
            }
          >
            {fines.current.refreshing || fines.history.refreshing ? (
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
        <StudentFinesSectionNav
          section={fines.section}
          currentCount={fines.current.items.length}
          historyCount={fines.history.items.length}
          onSectionChange={fines.setSection}
        />

        {activeSectionState.error && !activeSectionState.hasData ? (
          <StudentFinesFailureState
            heading={
              fines.section === "current"
                ? "Unable to load your current fines."
                : "Unable to load your fine history."
            }
            hasStaleData={false}
            message={activeSectionState.error}
            onRetry={fines.retry}
          />
        ) : null}

        {activeSectionState.loading && !activeSectionState.hasData ? (
          <StudentFinesLoadingState />
        ) : (
          <>
            {activeSectionState.error && activeSectionState.hasData ? (
              <StudentFinesFailureState
                heading={
                  fines.section === "current"
                    ? "Current fines refresh failed."
                    : "Fine history refresh failed."
                }
                hasStaleData={activeSectionState.hasStaleData}
                message={activeSectionState.error}
                onRetry={fines.retry}
              />
            ) : null}

            {activeSectionState.isEmpty ? (
              <StudentFinesEmptyState section={fines.section} />
            ) : fines.section === "current" ? (
              <div className="grid gap-4">
                {fines.current.items.map((item) => (
                  <StudentFineCard key={item.fine_id} item={item} />
                ))}
              </div>
            ) : (
              <div className="grid gap-4">
                {fines.history.items.map((item) => (
                  <StudentFineHistoryCard key={item.fine_id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
