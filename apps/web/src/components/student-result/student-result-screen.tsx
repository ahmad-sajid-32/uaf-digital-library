"use client";

import Link from "next/link";
import * as React from "react";
import { GraduationCap, LoaderCircle, RefreshCw } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { AcademicResultViewer } from "@/components/result/academic-result-viewer";
import { ResultFailureState } from "@/components/result/result-failure-state";
import { ResultLoadingState } from "@/components/result/result-loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStudentResult } from "@/hooks/useStudentResult";

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
            No academic result is available right now.
          </p>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
            Your result will appear here when it is available.
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
      description="Review your academic result, semester summaries, and GPA/CGPA."
      actions={
        <div className="flex flex-wrap items-center gap-2">
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
          <ResultFailureState
            heading="Unable to load your result."
            message={resultState.error}
            onRetry={resultState.retry}
          />
        ) : null}

        {resultState.loading && !resultState.hasData ? (
          <ResultLoadingState
            title="Fetching academic result..."
            message="This can take some time while the protected result source is being checked."
          />
        ) : (
          <>
            {resultState.error && resultState.hasData ? (
              <ResultFailureState
                heading="Result refresh failed."
                hasStaleData={resultState.hasStaleData}
                message={resultState.error}
                onRetry={resultState.retry}
              />
            ) : null}

            {resultState.refreshing && resultState.hasData ? (
              <ResultLoadingState
                compact
                title="Refreshing result..."
                message="This can take some time while the protected result source is being checked."
              />
            ) : null}

            {resultState.isEmpty || !resultPayload || !gpaSummary ? (
              <StudentResultEmptyState />
            ) : (
              <AcademicResultViewer
                result={resultPayload}
                gpaSummary={gpaSummary}
                scopeBadgeLabel="Student result"
                registrationHelperText="Registration number from your result record."
                summaryScopeText="Your academic record and GPA summary."
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
