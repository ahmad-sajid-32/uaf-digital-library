"use client";

import * as React from "react";
import { GraduationCap, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { AcademicResultViewer } from "@/components/result/academic-result-viewer";
import { ResultFailureState } from "@/components/result/result-failure-state";
import { ResultLoadingState } from "@/components/result/result-loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStaffResult } from "@/hooks/useStaffResult";

function StaffResultIdleState() {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
      <CardContent className="space-y-4 px-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Lookup Ready
          </p>
          <p className="text-2xl font-black tracking-tight text-foreground">
            Enter a registration number to fetch an academic result.
          </p>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
            This tool uses the public registration-number lookup contract from a
            protected shell route. It does not preload a result record.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StaffResultEmptyState() {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
      <CardContent className="space-y-4 px-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            No Result Content
          </p>
          <p className="text-2xl font-black tracking-tight text-foreground">
            The lookup returned no usable academic result payload.
          </p>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
            The screen preserves sparse or empty result truth instead of
            fabricating missing GPA or transcript values.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StaffResultScreenProps {
  eyebrow: string;
  roleLabel: string;
}

export function StaffResultScreen({
  eyebrow,
  roleLabel,
}: StaffResultScreenProps) {
  const resultState = useStaffResult();
  const result = resultState.result;

  return (
    <PageContainer
      eyebrow={eyebrow}
      title="Result"
      description="Look up a student's academic result through the registration-number contract without recomputing GPA or transcript values in the frontend."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Protected shell
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Public lookup contract
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void resultState.refresh();
            }}
            disabled={
              !resultState.hasSubmitted ||
              resultState.loading ||
              resultState.refreshing
            }
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
        <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
          <CardHeader className="space-y-3 px-6 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {roleLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                UAF LMS format
              </Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="font-display text-2xl font-black tracking-tight">
                Registration Lookup
              </CardTitle>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Enter a registration number such as `2022-ag-9159`. This fetch
                can take time because the university result source is checked in
                real time.
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            <form
              className="flex flex-col gap-4 lg:flex-row lg:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void resultState.submit();
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={`${roleLabel.toLowerCase()}-result-reg-number`}>
                  Registration Number
                </Label>
                <Input
                  id={`${roleLabel.toLowerCase()}-result-reg-number`}
                  value={resultState.registrationNumber.value}
                  onChange={(event) => {
                    resultState.registrationNumber.setValue(event.target.value);
                  }}
                  placeholder="2022-ag-91XX"
                  className="h-12 rounded-xl"
                  disabled={resultState.loading || resultState.refreshing}
                />
              </div>

              <Button
                type="submit"
                className="gap-2 rounded-xl lg:min-w-45]"
                disabled={
                  Boolean(resultState.registrationNumber.validationError) ||
                  !resultState.registrationNumber.normalizedValue ||
                  resultState.loading ||
                  resultState.refreshing
                }
              >
                {resultState.loading || resultState.refreshing ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Fetch Result
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {resultState.error && !resultState.hasData ? (
          <ResultFailureState
            heading="Unable to fetch the academic result."
            message={resultState.error}
            onRetry={() => {
              void resultState.submit();
            }}
          />
        ) : null}

        {resultState.loading && !resultState.hasData ? (
          <ResultLoadingState
            title="Fetching academic result..."
            message="This can take a while because the university result source is being checked."
          />
        ) : null}

        {resultState.isIdle ? <StaffResultIdleState /> : null}

        {resultState.error && resultState.hasData ? (
          <ResultFailureState
            heading="Result refresh failed."
            message={resultState.error}
            hasStaleData={resultState.hasStaleData}
            onRetry={() => {
              void resultState.retry();
            }}
          />
        ) : null}

        {resultState.refreshing && resultState.hasData ? (
          <ResultLoadingState
            compact
            title="Fetching new result..."
            message="This can take some time while the result source is being checked."
          />
        ) : null}

        {resultState.isEmpty ? <StaffResultEmptyState /> : null}

        {result ? (
          <AcademicResultViewer
            result={result.result}
            gpaSummary={result.gpa_summary}
            scopeBadgeLabel="Lookup result"
            registrationHelperText="Registration is shown exactly as returned by the lookup payload."
            summaryScopeText="This result was fetched through the registration-number lookup contract and rendered without client-side recomputation."
          />
        ) : null}
      </div>
    </PageContainer>
  );
}
