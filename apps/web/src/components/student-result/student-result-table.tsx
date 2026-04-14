"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatStudentResultLabel,
  resolveStudentResultRowValue,
  type StudentResultTable as StudentResultTableShape,
} from "@/lib/student-result";

interface StudentResultTableProps {
  resultTable: StudentResultTableShape;
}

export function StudentResultTable({ resultTable }: StudentResultTableProps) {
  if (resultTable.headers.length === 0 || resultTable.rows.length === 0) {
    return (
      <Card className="rounded-3xl border border-border/70 bg-card/95 py-0 shadow-none">
        <CardContent className="px-5 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Result Table
          </p>
          <p className="mt-2 text-lg font-black tracking-tight text-foreground">
            No tabular result rows were returned.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The academic result payload did not include a usable header-and-row
            table for this account. The screen preserves that sparse payload
            truth instead of fabricating transcript rows.
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
              Result Table
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {resultTable.rows.length} row{resultTable.rows.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-foreground">
            Course And Semester Rows
          </CardTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Headers and row values are rendered directly from the academic
            payload instead of hardcoding one transcript format.
          </p>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-5">
        <div className="px-5">
          <div className="rounded-3xl border border-border/70 bg-background/80">
            <Table>
              <TableHeader>
                <TableRow>
                  {resultTable.headers.map((header) => (
                    <TableHead
                      key={header}
                      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary"
                    >
                      {formatStudentResultLabel(header)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultTable.rows.map((row, rowIndex) => (
                  <TableRow key={`result-row-${rowIndex}`}>
                    {resultTable.headers.map((header) => (
                      <TableCell
                        key={`${rowIndex}-${header}`}
                        className="px-4 py-3 text-sm leading-6 text-foreground"
                      >
                        {resolveStudentResultRowValue(row, header)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
