"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatStudentResultNumber,
  type StudentSemesterGPASummary,
} from "@/lib/student-result";

interface StudentSemesterSummaryProps {
  semesters: StudentSemesterGPASummary[];
}

export function StudentSemesterSummary({
  semesters,
}: StudentSemesterSummaryProps) {
  if (semesters.length === 0) {
    return (
      <Card className="rounded-3xl border border-border/70 bg-card/95 py-0 shadow-none">
        <CardContent className="px-5 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Semester Summary
          </p>
          <p className="mt-2 text-lg font-black tracking-tight text-foreground">
            No semester aggregates were returned.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The academic result payload did not include semester-level GPA
            groups for this account. The screen preserves that truth instead of
            inventing missing academic values.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-border/70 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-3 px-5 py-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              Semester Summary
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {semesters.length} semester{semesters.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-foreground">
            Semester-Level GPA Breakdown
          </CardTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Semester aggregates are shown from backend-returned summary rows and
            are kept separate from the raw result table.
          </p>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 px-5 pb-5 xl:grid-cols-2">
        {semesters.map((semester) => (
          <div
            key={semester.semester_label}
            className="rounded-3xl border border-border/70 bg-background/80 px-5 py-5"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Semester
              </p>
              <p className="text-xl font-black tracking-tight text-foreground">
                {semester.semester_label}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {semester.courses.length} summarized course
                {semester.courses.length === 1 ? "" : "s"} contributed to this
                semester GPA.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-card/95 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  GPA
                </p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {formatStudentResultNumber(semester.gpa, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/95 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Credit Hours
                </p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {formatStudentResultNumber(semester.total_credit_hours)}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/95 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Quality Points
                </p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {formatStudentResultNumber(semester.total_quality_points, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
