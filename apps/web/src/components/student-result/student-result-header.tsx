"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatStudentResultNumber,
  getStudentResultCalculationPresentation,
  getStudentResultRegistration,
  getStudentResultStudentName,
  type StudentGPASummary,
  type StudentResultPayload,
} from "@/lib/student-result";
import { cn } from "@/lib/utils";

interface StudentResultHeaderProps {
  result: StudentResultPayload;
  gpaSummary: StudentGPASummary;
  scopeBadgeLabel?: string;
  identityHelperText?: string;
  registrationHelperText?: string;
  summaryHelperText?: string;
}

export function StudentResultHeader({
  result,
  gpaSummary,
  scopeBadgeLabel = "Student result",
  identityHelperText = "Student details from your result record.",
  registrationHelperText = "Registration number from your result record.",
  summaryHelperText = "Academic summary from your available semesters.",
}: StudentResultHeaderProps) {
  const calculationPresentation = getStudentResultCalculationPresentation(
    gpaSummary.calculation_status,
  );

  return (
    <Card className="rounded-3xl border border-primary/10 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("rounded-full border", calculationPresentation.toneClassName)}
              >
                {calculationPresentation.label}
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {scopeBadgeLabel}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight text-foreground">
              {result.metadata.title}
            </CardTitle>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {calculationPresentation.helper}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              CGPA
            </p>
            <p className="mt-2 text-xl font-black text-foreground">
              {formatStudentResultNumber(gpaSummary.cgpa, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 px-5 pb-5 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Student Name
          </p>
          <p className="mt-2 text-base font-semibold text-foreground">
            {getStudentResultStudentName(result.student_info)}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {identityHelperText}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Registration
          </p>
          <p className="mt-2 text-base font-semibold text-foreground">
            {getStudentResultRegistration(result.student_info)}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {registrationHelperText}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Summary Scope
          </p>
          <p className="mt-2 text-base font-semibold text-foreground">
            {gpaSummary.semesters.length} semester
            {gpaSummary.semesters.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {summaryHelperText}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
