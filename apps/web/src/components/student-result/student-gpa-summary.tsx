"use client";

import { AlertTriangle, Calculator, Sigma } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatStudentResultNumber,
  getStudentResultCalculationPresentation,
  type StudentGPASummary,
} from "@/lib/student-result";
import { cn } from "@/lib/utils";

interface StudentGPASummaryProps {
  summary: StudentGPASummary;
}

export function StudentGPASummary({ summary }: StudentGPASummaryProps) {
  const calculationPresentation = getStudentResultCalculationPresentation(
    summary.calculation_status,
  );

  return (
    <Card className="rounded-3xl border border-border/70 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-3 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("rounded-full border", calculationPresentation.toneClassName)}
              >
                {calculationPresentation.label}
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                GPA Summary
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight text-foreground">
              Academic Summary
            </CardTitle>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              GPA, CGPA, credit hours, and quality points are rendered directly
              from backend output.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-center gap-2 text-primary">
              <Calculator className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                Calculation Status
              </p>
            </div>
            <p className="mt-3 text-lg font-black text-foreground">
              {calculationPresentation.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {calculationPresentation.helper}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <div className="flex items-center gap-2 text-primary">
              <Sigma className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                CGPA
              </p>
            </div>
            <p className="mt-3 text-lg font-black text-foreground">
              {formatStudentResultNumber(summary.cgpa, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Overall CGPA is shown as returned, without client-side grade math.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Total Credit Hours
            </p>
            <p className="mt-3 text-lg font-black text-foreground">
              {formatStudentResultNumber(summary.total_credit_hours)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Semester totals are aggregated by the backend result pipeline.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Total Quality Points
            </p>
            <p className="mt-3 text-lg font-black text-foreground">
              {formatStudentResultNumber(summary.total_quality_points, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Quality points come from the backend summary, not frontend
              recomputation.
            </p>
          </div>
        </div>

        {summary.skipped_courses.length > 0 ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-semibold">
                {summary.skipped_courses.length} skipped course
                {summary.skipped_courses.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {summary.skipped_courses.map((course) => (
                <div
                  key={`${course.row_identifier}-${course.reason}`}
                  className="rounded-2xl border border-amber-500/15 bg-background/80 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {course.row_identifier}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {course.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
