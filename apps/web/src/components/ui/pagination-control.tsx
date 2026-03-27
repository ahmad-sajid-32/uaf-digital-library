// apps/web/src/components/ui/pagination-control.tsx
/**
 * Reusable pagination control aligned with the current admin-table design.
 *
 * Purpose:
 * - Provide one shared pagination control for future table surfaces.
 * - Preserve the existing mobile and desktop pagination behavior already
 *   approved in the admin users list screen.
 */

"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationControlProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getVisiblePaginationPages(
  currentPage: number,
  totalPages: number,
): number[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));

  return [startPage, startPage + 1, startPage + 2];
}

export function PaginationControl({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationControlProps): React.JSX.Element {
  const visiblePages = getVisiblePaginationPages(page, totalPages);
  const lastVisiblePage = visiblePages[visiblePages.length - 1] ?? 1;
  const shouldShowEllipsis =
    totalPages > 3 && lastVisiblePage < totalPages - 1;
  const shouldShowTrailingLastPage =
    totalPages > 3 && lastVisiblePage < totalPages;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-8 rounded-xl px-2"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-xl border border-border/60 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-foreground">
          Page {page} of {totalPages}
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-8 rounded-xl px-2"
          disabled={page >= totalPages}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="rounded-xl"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {visiblePages.map((pageNumber) => {
          const isActive = pageNumber === page;

          return (
            <Button
              key={pageNumber}
              type="button"
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={cn(
                "min-w-10 rounded-xl px-3",
                isActive
                  ? "border-primary/80 bg-primary/10 text-foreground hover:bg-primary/15"
                  : "border-border/60 bg-background",
              )}
              onClick={() => {
                onPageChange(pageNumber);
              }}
            >
              {pageNumber}
            </Button>
          );
        })}

        {shouldShowEllipsis ? (
          <div className="flex min-w-10 items-center justify-center rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
            ...
          </div>
        ) : null}

        {shouldShowTrailingLastPage ? (
          <Button
            type="button"
            variant={page === totalPages ? "default" : "outline"}
            size="sm"
            className={cn(
              "min-w-10 rounded-xl px-3",
              page === totalPages
                ? "border-primary/80 bg-primary/10 text-foreground hover:bg-primary/15"
                : "border-border/60 bg-background",
            )}
            onClick={() => {
              onPageChange(totalPages);
            }}
          >
            {totalPages}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="default"
          size="sm"
          className="rounded-xl"
          disabled={page >= totalPages}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
