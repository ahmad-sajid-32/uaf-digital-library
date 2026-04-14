"use client";

import { Sigma, TableOfContents } from "lucide-react";

import { StudentGPASummary } from "@/components/student-result/student-gpa-summary";
import { StudentResultHeader } from "@/components/student-result/student-result-header";
import { StudentResultTable } from "@/components/student-result/student-result-table";
import { StudentSemesterSummary } from "@/components/student-result/student-semester-summary";
import { Card, CardContent } from "@/components/ui/card";
import type { StudentGPASummary as GPASummary, StudentResultPayload } from "@/lib/student-result";

interface AcademicResultViewerProps {
  result: StudentResultPayload;
  gpaSummary: GPASummary;
  scopeBadgeLabel?: string;
  identityHelperText?: string;
  registrationHelperText?: string;
  summaryScopeText?: string;
}

export function AcademicResultViewer({
  result,
  gpaSummary,
  scopeBadgeLabel,
  identityHelperText,
  registrationHelperText,
  summaryScopeText,
}: AcademicResultViewerProps) {
  return (
    <>
      <StudentResultHeader
        result={result}
        gpaSummary={gpaSummary}
        scopeBadgeLabel={scopeBadgeLabel}
        identityHelperText={identityHelperText}
        registrationHelperText={registrationHelperText}
        summaryHelperText={summaryScopeText}
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
                {result.result_table.rows.length}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The result table is rendered from payload headers and rows
                without hardcoding one transcript shape.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <StudentSemesterSummary semesters={gpaSummary.semesters} />
      <StudentResultTable resultTable={result.result_table} />
    </>
  );
}
