"use client";

import Link from "next/link";
import { AlertCircle, History, LoaderCircle, RefreshCw } from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { StudentBorrowHistoryCard } from "@/components/student-borrow-history/student-borrow-history-card";
import { StudentBorrowAreaNav } from "@/components/student-borrows/student-borrow-area-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentBorrowHistory } from "@/hooks/useStudentBorrowHistory";

function StudentBorrowHistoryLoadingState() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-80 rounded-3xl" />
      ))}
    </div>
  );
}

function StudentBorrowHistoryFailureState(props: {
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
              Borrow History Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load your borrow history.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The currently shown rows may be stale. Retry to fetch the latest
              history records from the backend.
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

export function StudentBorrowHistoryScreen() {
  const history = useStudentBorrowHistory({
    autoLoad: true,
  });

  return (
    <PageContainer
      eyebrow="Student Borrow History"
      title="Borrow History"
      description="Review completed borrowing records without mixing them into the active renew and return workspace. This module stays read-only and follows the existing history contract only."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {history.items.length} records
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Read only
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void history.refresh();
            }}
            disabled={history.loading || history.refreshing}
          >
            {history.refreshing ? (
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
        <StudentBorrowAreaNav />

        {history.error && !history.hasData ? (
          <StudentBorrowHistoryFailureState
            hasStaleData={false}
            message={history.error}
            onRetry={history.retry}
          />
        ) : null}

        {history.loading && !history.hasData ? (
          <StudentBorrowHistoryLoadingState />
        ) : (
          <>
            {history.error && history.hasData ? (
              <StudentBorrowHistoryFailureState
                hasStaleData={history.hasStaleData}
                message={history.error}
                onRetry={history.retry}
              />
            ) : null}

            {history.isEmpty ? (
              <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
                <CardContent className="space-y-5 px-6 py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <History className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                      No Borrow History
                    </p>
                    <p className="text-2xl font-black tracking-tight text-foreground">
                      Your completed borrow records are currently empty.
                    </p>
                    <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
                      Returned books will appear here once the backend has real
                      historical records for your account. Active renew and
                      return work still belongs in the current borrow workspace.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild className="rounded-xl">
                      <Link href="/student/borrows">Back To Active Borrows</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href="/student/catalog">Back To Catalog</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {history.items.map((item) => (
                  <StudentBorrowHistoryCard
                    key={item.transaction_id}
                    item={item}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
