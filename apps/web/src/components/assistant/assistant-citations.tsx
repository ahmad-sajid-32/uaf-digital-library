// apps/web/src/components/assistant/assistant-citations.tsx
/**
 * Compact citation attachments for assistant messages.
 *
 * Purpose:
 * - Keep citations visible without breaking the conversation rhythm.
 * - Present source metadata as attached source chips under assistant answers
 *   instead of as a second dashboard panel.
 * - Keep long source lists compact with a local expand/collapse treatment.
 */

"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AssistantCitationItem } from "@/lib/api/assistant";

const DEFAULT_VISIBLE_CITATIONS = 3;

function buildCitationMeta(citation: AssistantCitationItem): string {
  const parts: string[] = [];

  if (citation.page_number) {
    parts.push(`Page ${citation.page_number}`);
  }

  if (citation.section_label) {
    parts.push(citation.section_label);
  }

  parts.push(`Chunk ${citation.chunk_index}`);

  return parts.join(" | ");
}

export function AssistantCitations({
  citations,
}: {
  citations: AssistantCitationItem[];
}): React.JSX.Element | null {
  const [expanded, setExpanded] = React.useState(false);

  if (citations.length === 0) {
    return null;
  }

  const visibleCitations = expanded
    ? citations
    : citations.slice(0, DEFAULT_VISIBLE_CITATIONS);
  const hiddenCount = citations.length - visibleCitations.length;

  return (
    <div className="mt-3 flex max-w-4xl flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {visibleCitations.map((citation) => (
          <div
            key={`${citation.rank}-${citation.chunk_id ?? "no-chunk"}`}
            className="min-w-0 max-w-full rounded-2xl border border-border/60 bg-background/85 px-3 py-2 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {citation.document_title}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {buildCitationMeta(citation)}
                </p>
                <p className="mt-0.5 truncate text-[11px] leading-5 text-muted-foreground/90">
                  {citation.original_filename}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {citations.length > DEFAULT_VISIBLE_CITATIONS ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => {
              setExpanded((current) => !current);
            }}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
                Show fewer sources
              </>
            ) : (
              <>
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                Show {hiddenCount} more source{hiddenCount === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
