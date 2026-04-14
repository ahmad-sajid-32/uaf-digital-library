"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlertCircle,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  Sigma,
  TableOfContents,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { StudentGPASummary } from "@/components/student-result/student-gpa-summary";
import { StudentResultHeader } from "@/components/student-result/student-result-header";
import { StudentResultTable } from "@/components/student-result/student-result-table";
import { StudentSemesterSummary } from "@/components/student-result/student-semester-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentResult } from "@/hooks/useStudentResult";

function StudentResultLoadingState() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-72 rounded-3xl" />
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}

function StudentResultFailureState(props: {
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
              The currently shown academic result may be stale. Retry to fetch
              the latest protected result payload from the backend.
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

function StudentResultEmptyState() {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
      <CardContent className="space-y-5 px-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            No Result Available
          </p>
          <p className="text-2xl font-black tracking-tight text-foreground">
            No protected academic result payload is available right now.
          </p>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
            This route only shows the authenticated student result. It does not
            fall back to public registration-number lookup or invent missing
            academic values.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-xl">
            <Link href="/student/catalog">Back To Catalog</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/student/borrows">View My Borrows</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentResultScreen() {
  const resultState = useStudentResult({
    autoLoad: true,
  });

  const result = resultState.result;
  const resultPayload = result?.result ?? null;
  const gpaSummary = result?.gpa_summary ?? null;

  return (
    <PageContainer
      eyebrow="Student Result"
      title="Result"
      description="Review your protected academic result, semester summaries, and GPA/CGPA output without exposing public lookup or client-side grade recalculation."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Protected
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Read only
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {result?.gpa_summary.semesters.length ?? 0} semester
            {(result?.gpa_summary.semesters.length ?? 0) === 1 ? "" : "s"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void resultState.refresh();
            }}
            disabled={resultState.loading || resultState.refreshing}
          >
            {resultState.refreshing ? (
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
        {resultState.error && !resultState.hasData ? (
          <StudentResultFailureState
            heading="Unable to load your protected result."
            hasStaleData={false}
            message={resultState.error}
            onRetry={resultState.retry}
          />
        ) : null}

        {resultState.loading && !resultState.hasData ? (
          <StudentResultLoadingState />
        ) : (
          <>
            {resultState.error && resultState.hasData ? (
              <StudentResultFailureState
                heading="Protected result refresh failed."
                hasStaleData={resultState.hasStaleData}
                message={resultState.error}
                onRetry={resultState.retry}
              />
            ) : null}

            {resultState.isEmpty || !resultPayload || !gpaSummary ? (
              <StudentResultEmptyState />
            ) : (
              <>
                <StudentResultHeader
                  result={resultPayload}
                  gpaSummary={gpaSummary}
                />

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="min-h-0">
                    <StudentGPASummary summary={gpaSummary} />
                  </div>

                  <Card className="rounded-3xl border border-border/70 bg-card/95 py-0 shadow-none">
                    <CardContent className="grid gap-3 px-5 py-5 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                        <div className="flex items-center gap-2 text-primary">
                          <Sigma className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                            Calculation Status
                          </p>
                        </div>
                        <p className="mt-3 text-lg font-black text-foreground">
                          {gpaSummary.calculation_status}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Status is shown exactly as returned by the backend.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                        <div className="flex items-center gap-2 text-primary">
                          <TableOfContents className="h-4 w-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                            Raw Table Rows
                          </p>
                        </div>
                        <p className="mt-3 text-lg font-black text-foreground">
                          {resultPayload.result_table.rows.length}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          The result table is rendered from payload headers and
                          rows without hardcoding one transcript shape.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <StudentSemesterSummary semesters={gpaSummary.semesters} />
                <StudentResultTable resultTable={resultPayload.result_table} />
              </>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
